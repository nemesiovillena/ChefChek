import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "../dto/employee.dto";
import { currentPositionTitles } from "../../users/current-position-titles";

const EMPLOYEE_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  locations: { select: { locationId: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: typeof EMPLOYEE_INCLUDE;
}>;

/**
 * Fichas laborales. Un empleado nunca se borra (el registro de jornada se
 * conserva 4 años): se da de baja con isActive=false y terminationDate.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeInactive = false) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      include: EMPLOYEE_INCLUDE,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return this.toViews(tenantId, employees);
  }

  /** Fichas listas para enviar, con el puesto vigente de su cuenta. */
  private async toViews(tenantId: string, employees: EmployeeWithRelations[]) {
    const titles = await currentPositionTitles(
      this.prisma,
      tenantId,
      employees.map((e) => e.userId),
    );
    return employees.map((e) =>
      toEmployeeView(e, (e.userId && titles.get(e.userId)) || null),
    );
  }

  async getOne(tenantId: string, id: string) {
    const [view] = await this.toViews(tenantId, [
      await this.findOwned(tenantId, id),
    ]);
    return view;
  }

  /**
   * Cuentas personales del tenant que aún no están vinculadas a un empleado,
   * con el puesto que tengan asignado en SICTED (si lo hay) como sugerencia.
   */
  async listLinkableUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, isSharedAccount: false, employee: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    if (users.length === 0) {
      return [];
    }

    // Lectura directa de las fichas de puesto de SICTED, sin depender de que
    // el módulo esté activo: si no hay datos, simplemente no hay sugerencia.
    const assignments = await this.prisma.sictedJobAssignment.findMany({
      where: { tenantId, until: null, userId: { in: users.map((u) => u.id) } },
      select: { userId: true, profile: { select: { title: true } } },
      orderBy: { since: "desc" },
    });
    const jobTitleByUser = new Map<string, string>();
    for (const assignment of assignments) {
      if (!jobTitleByUser.has(assignment.userId)) {
        jobTitleByUser.set(assignment.userId, assignment.profile.title);
      }
    }
    return users.map((user) => ({
      ...user,
      suggestedJobTitle: jobTitleByUser.get(user.id) ?? null,
    }));
  }

  /**
   * Crea de una vez las fichas de las cuentas indicadas, con nombre y puesto
   * tomados de lo que ya existe (Equipo y SICTED). El resto de datos (DNI,
   * Seguridad Social, contrato) se completa después en cada ficha.
   */
  async importFromUsers(tenantId: string, userIds: string[]) {
    const linkable = await this.listLinkableUsers(tenantId);
    const wanted = new Set(userIds);
    const selected = linkable.filter((user) => wanted.has(user.id));
    if (selected.length !== wanted.size) {
      throw new BadRequestException(
        "Alguna de las cuentas no existe o ya tiene ficha de empleado.",
      );
    }
    const created = [];
    for (const user of selected) {
      created.push(
        await this.create(tenantId, {
          ...splitFullName(user.name),
          userId: user.id,
          jobTitle: user.suggestedJobTitle ?? undefined,
        }),
      );
    }
    return created;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    const account = dto.userId
      ? await this.assertUserLinkable(tenantId, dto.userId)
      : null;
    const name = account ? splitFullName(account.name) : dto;
    const locationIds = await this.resolveLocationIds(
      tenantId,
      dto.locationIds,
      dto.defaultLocationId,
    );
    const defaultLocationId = pickDefaultLocation(
      dto.defaultLocationId,
      locationIds,
    );

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        userId: dto.userId ?? null,
        firstName: name.firstName.trim(),
        lastName: name.lastName.trim(),
        nationalId: dto.nationalId,
        socialSecurityNumber: dto.socialSecurityNumber,
        jobTitle: dto.jobTitle,
        section: dto.section,
        contractType: dto.contractType,
        weeklyHours: dto.weeklyHours,
        hourlyCost: dto.hourlyCost,
        defaultLocationId,
        hireDate: dto.hireDate,
        terminationDate: dto.terminationDate,
        isActive: dto.isActive ?? true,
        locations: {
          create: locationIds.map((locationId) => ({ tenantId, locationId })),
        },
      },
      include: EMPLOYEE_INCLUDE,
    });
    const [view] = await this.toViews(tenantId, [employee]);
    return view;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const current = await this.findOwned(tenantId, id);

    // Con cuenta vinculada el nombre es el de Equipo: se copia al vincular y
    // se ignora el que llegue en el formulario.
    const linkedUserId = dto.userId === undefined ? current.userId : dto.userId;
    let name: { firstName?: string; lastName?: string } = dto;
    if (dto.userId && dto.userId !== current.userId) {
      name = splitFullName(
        (await this.assertUserLinkable(tenantId, dto.userId)).name,
      );
    } else if (linkedUserId) {
      name = {};
    }

    const replaceLocations =
      dto.locationIds !== undefined || dto.defaultLocationId !== undefined;
    const currentLocationIds = current.locations.map((l) => l.locationId);
    const locationIds = replaceLocations
      ? await this.resolveLocationIds(
          tenantId,
          dto.locationIds ?? currentLocationIds,
          dto.defaultLocationId,
        )
      : currentLocationIds;
    const defaultLocationId = replaceLocations
      ? pickDefaultLocation(
          dto.defaultLocationId === undefined
            ? current.defaultLocationId
            : dto.defaultLocationId,
          locationIds,
        )
      : current.defaultLocationId;

    const employee = await this.prisma.$transaction(async (tx) => {
      if (replaceLocations) {
        await tx.employeeLocation.deleteMany({ where: { employeeId: id } });
        await tx.employeeLocation.createMany({
          data: locationIds.map((locationId) => ({
            tenantId,
            employeeId: id,
            locationId,
          })),
        });
      }
      return tx.employee.update({
        where: { id },
        data: {
          userId: dto.userId,
          firstName: name.firstName?.trim(),
          lastName: name.lastName?.trim(),
          nationalId: dto.nationalId,
          socialSecurityNumber: dto.socialSecurityNumber,
          jobTitle: dto.jobTitle,
          section: dto.section,
          contractType: dto.contractType,
          weeklyHours: dto.weeklyHours,
          hourlyCost: dto.hourlyCost,
          defaultLocationId,
          hireDate: dto.hireDate,
          terminationDate: dto.terminationDate,
          isActive: dto.isActive,
        },
        include: EMPLOYEE_INCLUDE,
      });
    });
    const [view] = await this.toViews(tenantId, [employee]);
    return view;
  }

  private async findOwned(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return employee;
  }

  /** La cuenta debe ser del tenant, personal (no compartida) y estar libre. */
  private async assertUserLinkable(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        name: true,
        isSharedAccount: true,
        employee: { select: { id: true } },
      },
    });
    if (!user) {
      throw new BadRequestException("La cuenta de usuario no existe.");
    }
    if (user.isSharedAccount) {
      throw new BadRequestException(
        "Una cuenta compartida no puede vincularse a un empleado.",
      );
    }
    if (user.employee) {
      throw new ConflictException(
        "Esa cuenta ya está vinculada a otro empleado.",
      );
    }
    return user;
  }

  /**
   * Centros del empleado: los indicados (validados contra el tenant) o, si no
   * se indican, el centro por defecto pedido o el del tenant.
   */
  private async resolveLocationIds(
    tenantId: string,
    requested: string[] | undefined,
    defaultLocationId: string | null | undefined,
  ): Promise<string[]> {
    const wanted = new Set(requested ?? []);
    if (defaultLocationId) {
      wanted.add(defaultLocationId);
    }

    if (wanted.size === 0) {
      return resolveFallbackLocationIds(this.prisma, tenantId);
    }

    const found = await this.prisma.location.findMany({
      where: { tenantId, id: { in: [...wanted] } },
      select: { id: true },
    });
    if (found.length !== wanted.size) {
      throw new BadRequestException("Alguno de los centros no existe.");
    }
    return [...wanted];
  }
}

/**
 * Centros de una ficha a la que no se le ha indicado ninguno: el principal del
 * tenant o, si no hay principal marcado, el único centro activo (sin
 * ambigüedad). Con varios centros y ninguno principal, se queda sin centro.
 */
export async function resolveFallbackLocationIds(
  prisma: Pick<PrismaService, "location">,
  tenantId: string,
): Promise<string[]> {
  const tenantDefault = await prisma.location.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  if (tenantDefault) {
    return [tenantDefault.id];
  }
  const active = await prisma.location.findMany({
    where: { tenantId, isActive: true, deletedAt: null },
    select: { id: true },
    take: 2,
  });
  return active.length === 1 ? [active[0].id] : [];
}

/** "Marta Ruiz García" -> nombre "Marta", apellidos "Ruiz García". */
export function splitFullName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function pickDefaultLocation(
  requested: string | null | undefined,
  locationIds: string[],
): string | null {
  if (requested && locationIds.includes(requested)) {
    return requested;
  }
  return locationIds[0] ?? null;
}

/** Vista pública: nunca expone el hash del PIN ni los contadores de bloqueo. */
/**
 * `jobTitle` es el puesto vigente de la cuenta (Empleados → Puestos), no el
 * texto antiguo de la ficha, que ya no se edita.
 */
function toEmployeeView(
  employee: EmployeeWithRelations,
  positionTitle: string | null,
) {
  const {
    pinHash,
    pinFailedAttempts: _attempts,
    pinLockedUntil,
    locations,
    ...rest
  } = employee;
  return {
    ...rest,
    jobTitle: positionTitle,
    hasPin: pinHash !== null,
    // Con cuenta de Equipo se identifica con esa contraseña, no con PIN.
    usesAccountPassword: employee.userId !== null,
    pinLocked: pinLockedUntil !== null && pinLockedUntil > new Date(),
    locationIds: locations.map((l) => l.locationId),
  };
}
