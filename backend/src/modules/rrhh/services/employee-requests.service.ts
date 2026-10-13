import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Employee,
  EmployeeRequest,
  EmployeeRequestKind,
  EmployeeRequestStatus,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { AdjustmentsService } from "../../check-in/services/adjustments.service";
import { ModulesService } from "../../modules/modules.service";
import { AbsencesService } from "../../turnos/services/absences.service";
import {
  CreateEmployeeRequestDto,
  DecideEmployeeRequestDto,
} from "../dto/employee-request.dto";
import {
  EMPLOYEE_DATA_FIELDS,
  PERSONAL_DATA_FIELDS,
  PERSONAL_DATA_LABELS,
  PersonalDataField,
  USER_DATA_FIELDS,
} from "./employee-self.service";

export interface Actor {
  id: string;
  name: string;
}

type PersonalDataChanges = Partial<Record<PersonalDataField, string>>;

/** Una solicitud del empleado, venga del flujo que venga. */
export interface OwnRequestItem {
  source: "REQUEST" | "ADJUSTMENT" | "ABSENCE";
  id: string;
  title: string;
  detail: string | null;
  status: EmployeeRequestStatus;
  decisionNote: string | null;
  createdAt: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10-05" -> "05/10/2026". */
const shortDate = (iso: string) => iso.split("-").reverse().join("/");
const dateOf = (instant: Date) =>
  `${pad(instant.getUTCDate())}/${pad(instant.getUTCMonth() + 1)}/${instant.getUTCFullYear()}`;

/**
 * Solicitudes del empleado a gerencia. Aquí viven el cambio de datos
 * personales y las peticiones libres; las correcciones de fichaje y las
 * ausencias siguen en sus módulos y aquí solo se listan juntas.
 */
@Injectable()
export class EmployeeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adjustments: AdjustmentsService,
    private readonly absences: AbsencesService,
    private readonly modules: ModulesService,
  ) {}

  async create(
    tenantId: string,
    employee: Employee,
    dto: CreateEmployeeRequestDto,
  ) {
    const message = dto.message?.trim() || null;
    let payload: PersonalDataChanges | undefined;
    if (dto.kind === "DATA_CHANGE") {
      payload = {};
      for (const field of PERSONAL_DATA_FIELDS) {
        const value = dto.changes?.[field]?.trim();
        if (value) {
          payload[field] = value;
        }
      }
      if (Object.keys(payload).length === 0) {
        throw new BadRequestException("Indica al menos un dato que cambiar.");
      }
      const pending = await this.prisma.employeeRequest.findFirst({
        where: {
          tenantId,
          employeeId: employee.id,
          kind: EmployeeRequestKind.DATA_CHANGE,
          status: EmployeeRequestStatus.PENDING,
        },
        select: { id: true },
      });
      if (pending) {
        throw new ConflictException(
          "Ya tienes un cambio de datos pendiente de respuesta.",
        );
      }
    } else if (!message) {
      throw new BadRequestException("Escribe tu solicitud.");
    }

    const created = await this.prisma.employeeRequest.create({
      data: {
        tenantId,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        kind: dto.kind,
        payload,
        message,
      },
    });
    return toView(created);
  }

  /** Retirar una solicitud propia que aún no tiene respuesta. */
  async cancelOwn(tenantId: string, employee: Employee, id: string) {
    const request = await this.findOwned(tenantId, id);
    if (request.employeeId !== employee.id) {
      throw new NotFoundException("Solicitud no encontrada");
    }
    return toView(
      await this.close(request, { status: EmployeeRequestStatus.CANCELLED }),
    );
  }

  /**
   * Todas mis solicitudes en una lista: cambios de datos y peticiones libres,
   * correcciones de fichaje y, si el tenant usa turnos, ausencias.
   */
  async listOwn(
    tenantId: string,
    employee: Employee,
  ): Promise<OwnRequestItem[]> {
    const year = new Date().getUTCFullYear();
    const [requests, adjustments, absences] = await Promise.all([
      this.prisma.employeeRequest.findMany({
        where: { tenantId, employeeId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.adjustments.list(tenantId, { employeeId: employee.id }),
      (await this.modules.isModuleEnabled(tenantId, "turnos"))
        ? this.absences.list(tenantId, {
            employeeId: employee.id,
            from: new Date(Date.UTC(year - 1, 0, 1)),
            to: new Date(Date.UTC(year + 1, 11, 31)),
          })
        : [],
    ]);

    const items: OwnRequestItem[] = [
      ...requests.map((request) => ({
        source: "REQUEST" as const,
        id: request.id,
        title:
          request.kind === EmployeeRequestKind.DATA_CHANGE
            ? "Cambio de datos personales"
            : "Otra solicitud",
        detail: describe(request),
        status: request.status,
        decisionNote: request.decisionNote,
        createdAt: request.createdAt,
      })),
      ...adjustments.map((adjustment) => ({
        source: "ADJUSTMENT" as const,
        id: adjustment.id,
        title: adjustment.occurredAt
          ? `Corrección de fichaje del ${dateOf(adjustment.occurredAt)}`
          : "Corrección de fichaje",
        detail: adjustment.reason,
        status: (adjustment.decision?.status ??
          EmployeeRequestStatus.PENDING) as EmployeeRequestStatus,
        decisionNote: adjustment.decision?.note ?? null,
        createdAt: adjustment.createdAt,
      })),
      ...absences.map((absence) => ({
        source: "ABSENCE" as const,
        id: absence.id,
        title:
          absence.startDate === absence.endDate
            ? `${absence.type.name}: ${shortDate(absence.startDate)}`
            : `${absence.type.name}: ${shortDate(absence.startDate)} – ${shortDate(absence.endDate)}`,
        detail: absence.note,
        status: absence.status as EmployeeRequestStatus,
        decisionNote: absence.decisionNote,
        createdAt: absence.createdAt,
      })),
    ];
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Bandeja de gerencia: cambios de datos y peticiones libres. */
  async listForManagers(tenantId: string, onlyPending: boolean) {
    const requests = await this.prisma.employeeRequest.findMany({
      where: {
        tenantId,
        status: onlyPending ? EmployeeRequestStatus.PENDING : undefined,
      },
      orderBy: { createdAt: onlyPending ? "asc" : "desc" },
      take: 200,
    });
    return requests.map(toView);
  }

  /**
   * Aprobar o rechazar. Al aprobar un cambio de datos se aplica a la cuenta
   * y a la ficha en la misma transacción. Nadie decide su propia solicitud.
   */
  async decide(
    tenantId: string,
    id: string,
    dto: DecideEmployeeRequestDto,
    by: Actor,
  ) {
    const request = await this.findOwned(tenantId, id);
    const note = dto.note?.trim() || null;
    if (!dto.approve && !note) {
      throw new BadRequestException("Explica por qué se rechaza.");
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: request.employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    if (employee.userId === by.id) {
      throw new ForbiddenException(
        "No puedes decidir tu propia solicitud: tiene que hacerlo otro responsable.",
      );
    }
    const decided = await this.close(
      request,
      {
        status: dto.approve
          ? EmployeeRequestStatus.APPROVED
          : EmployeeRequestStatus.REJECTED,
        decisionNote: note,
        decidedByUserId: by.id,
        decidedByName: by.name,
        decidedAt: new Date(),
      },
      dto.approve && request.kind === EmployeeRequestKind.DATA_CHANGE
        ? employee
        : undefined,
    );
    return toView(decided);
  }

  // ──────────────────────────────────────────────────────────── Internos

  /**
   * Cierra una solicitud pendiente. El `updateMany` con el estado en el
   * filtro evita que dos respuestas simultáneas la decidan dos veces.
   */
  private async close(
    request: EmployeeRequest,
    data: Partial<EmployeeRequest> & { status: EmployeeRequestStatus },
    applyTo?: Employee,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeeRequest.updateMany({
        where: { id: request.id, status: EmployeeRequestStatus.PENDING },
        data: { ...data, payload: undefined },
      });
      if (count === 0) {
        throw new ConflictException("Esta solicitud ya tiene respuesta.");
      }
      if (applyTo) {
        const changes = (request.payload ?? {}) as PersonalDataChanges;
        const pick = (fields: readonly PersonalDataField[]) =>
          Object.fromEntries(
            fields
              .filter((field) => changes[field] !== undefined)
              .map((field) => [field, changes[field]]),
          );
        const userData = pick(USER_DATA_FIELDS);
        if (applyTo.userId && Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: applyTo.userId },
            data: userData,
          });
        }
        const employeeData = pick(EMPLOYEE_DATA_FIELDS);
        if (Object.keys(employeeData).length > 0) {
          await tx.employee.update({
            where: { id: applyTo.id },
            data: employeeData,
          });
        }
      }
      return tx.employeeRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
    });
  }

  private async findOwned(tenantId: string, id: string) {
    const request = await this.prisma.employeeRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) {
      throw new NotFoundException("Solicitud no encontrada");
    }
    return request;
  }
}

/** "Teléfono: 600 000 000 · Población: Elche", o el texto libre. */
function describe(request: EmployeeRequest): string | null {
  if (request.kind !== EmployeeRequestKind.DATA_CHANGE) {
    return request.message;
  }
  const changes = (request.payload ?? {}) as PersonalDataChanges;
  const fields = PERSONAL_DATA_FIELDS.filter(
    (field) => changes[field] !== undefined,
  ).map((field) => `${PERSONAL_DATA_LABELS[field]}: ${changes[field]}`);
  return [...fields, request.message].filter(Boolean).join(" · ");
}

function toView(request: EmployeeRequest) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    kind: request.kind,
    changes: (request.payload ?? null) as PersonalDataChanges | null,
    message: request.message,
    summary: describe(request),
    status: request.status,
    decisionNote: request.decisionNote,
    decidedByName: request.decidedByName,
    decidedAt: request.decidedAt,
    createdAt: request.createdAt,
  };
}
