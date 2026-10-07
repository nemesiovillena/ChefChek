import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  Employee,
  PunchPinStatus,
  PunchSource,
  TimePunch,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreatePunchDto } from "../dto/punch.dto";
import { EmployeePinService } from "./employee-pin.service";
import { LegalAcksService } from "./legal-acks.service";
import { LegalTextsService } from "./legal-texts.service";
import { CheckInSettingsService } from "./check-in-settings.service";
import { GeoPoint, resolveGeofence } from "./geofence.util";
import { computePunchHash } from "./punch-hash.util";
import {
  EmployeeWorkStatus,
  allowedNextTypes,
  isAllowedTransition,
  statusAfter,
} from "./punch-state.util";

/** Sesión desde la que se ficha. */
export interface PunchActor {
  id: string;
  isSharedAccount: boolean;
}

const fullName = (employee: Pick<Employee, "firstName" | "lastName">) =>
  `${employee.firstName} ${employee.lastName}`.trim();

/** Ventana para buscar el último fichaje al pintar listados (no al validar). */
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Fichajes. Cada fichaje es una fila nueva e inalterable (trigger en BD),
 * numerada y encadenada por huella dentro del tenant.
 *
 * Quién ficha lo decide la sesión, no el cliente: una cuenta personal ficha
 * siempre por su propio empleado y sin PIN; una cuenta compartida (kiosco)
 * indica el empleado y debe acertar su PIN.
 */
@Injectable()
export class PunchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pins: EmployeePinService,
    private readonly legalTexts: LegalTextsService,
    private readonly legalAcks: LegalAcksService,
    private readonly settings: CheckInSettingsService,
  ) {}

  async record(
    tenantId: string,
    actor: PunchActor,
    dto: CreatePunchDto,
    userAgent?: string,
  ): Promise<TimePunch> {
    const readiness = await this.legalTexts.getReadiness(tenantId);
    if (!readiness.ready) {
      throw new ConflictException(
        "El fichaje aún no está disponible: faltan textos legales por validar en Ajustes de fichaje.",
      );
    }

    const source = actor.isSharedAccount
      ? PunchSource.KIOSK
      : PunchSource.PERSONAL;
    const employee =
      source === PunchSource.KIOSK
        ? await this.findKioskEmployee(tenantId, dto.employeeId)
        : await this.findOwnEmployee(tenantId, actor.id);

    // Reintento del mismo fichaje (doble envío, respuesta perdida): se
    // devuelve el ya guardado sin volver a pedir PIN ni duplicar.
    const existing = await this.prisma.timePunch.findUnique({
      where: { id: dto.id },
    });
    if (existing) {
      if (
        existing.tenantId !== tenantId ||
        existing.employeeId !== employee.id
      ) {
        throw new ConflictException("Identificador de fichaje ya utilizado.");
      }
      return existing;
    }

    if (!employee.isActive) {
      throw new ForbiddenException("Este empleado está dado de baja.");
    }

    let pinStatus: PunchPinStatus = PunchPinStatus.NOT_REQUIRED;
    if (source === PunchSource.KIOSK) {
      if (!dto.pin) {
        throw new BadRequestException("Introduce tu PIN para fichar.");
      }
      const ok = await this.pins.verifyPin(tenantId, employee.id, dto.pin);
      if (!ok) {
        throw new UnauthorizedException("PIN incorrecto.");
      }
      pinStatus = PunchPinStatus.VERIFIED;
    } else {
      const pending = await this.legalAcks.listPending(tenantId, employee.id);
      if (pending.length > 0) {
        throw new ConflictException(
          "Antes de fichar tienes que leer y aceptar la información sobre el registro de jornada.",
        );
      }
    }

    const geofence = await this.resolveCenter(tenantId, employee, source, dto);
    if (geofence.blocked) {
      throw new ForbiddenException(
        `Estás fuera de la zona de ${geofence.center?.name ?? "tu centro"} (a ${geofence.distanceM} m). Acércate para fichar.`,
      );
    }

    const hasPoint = dto.latitude !== undefined && dto.longitude !== undefined;
    const occurredAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Serializa los fichajes del tenant: la numeración y la huella dependen
      // del anterior, y la validación de secuencia no debe ver un estado viejo
      // si la misma persona pulsa dos veces.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

      const lastOfEmployee = await tx.timePunch.findFirst({
        where: { tenantId, employeeId: employee.id },
        orderBy: { seq: "desc" },
        select: { type: true },
      });
      const status = statusAfter(lastOfEmployee?.type);
      if (!isAllowedTransition(status, dto.type)) {
        throw new ConflictException(transitionMessage(status));
      }

      const lastOfTenant = await tx.timePunch.findFirst({
        where: { tenantId },
        orderBy: { seq: "desc" },
        select: { seq: true, hash: true },
      });
      const seq = (lastOfTenant?.seq ?? 0) + 1;
      const prevHash = lastOfTenant?.hash ?? null;

      const data = {
        id: dto.id,
        tenantId,
        employeeId: employee.id,
        employeeName: fullName(employee),
        type: dto.type,
        occurredAt,
        deviceTime: dto.deviceTime ?? null,
        source,
        recordedByUserId: actor.id,
        locationId: geofence.center?.id ?? null,
        locationName: geofence.center?.name ?? null,
        latitude: hasPoint ? (dto.latitude as number) : null,
        longitude: hasPoint ? (dto.longitude as number) : null,
        accuracyM: hasPoint ? (dto.accuracyM ?? null) : null,
        distanceM: geofence.distanceM,
        geofenceStatus: geofence.status,
        pinStatus,
        wasOffline: false,
        deviceId: dto.deviceId ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
        seq,
        prevHash,
      };
      return tx.timePunch.create({
        data: { ...data, hash: computePunchHash(prevHash, data) },
      });
    });
  }

  /** Estado de la cuenta personal: situación, últimos fichajes y textos por leer. */
  async getOwnState(tenantId: string, actor: PunchActor) {
    const readiness = await this.legalTexts.getReadiness(tenantId);
    const employee = actor.isSharedAccount
      ? null
      : await this.prisma.employee.findFirst({
          where: { tenantId, userId: actor.id },
        });
    if (!employee) {
      return {
        readiness,
        isSharedAccount: actor.isSharedAccount,
        employee: null,
        status: null,
        allowedTypes: [],
        recentPunches: [],
        pendingLegalTexts: [],
      };
    }

    const recentPunches = await this.prisma.timePunch.findMany({
      where: {
        tenantId,
        employeeId: employee.id,
        occurredAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) },
      },
      orderBy: { seq: "desc" },
      take: 12,
    });
    const last =
      recentPunches[0] ??
      (await this.prisma.timePunch.findFirst({
        where: { tenantId, employeeId: employee.id },
        orderBy: { seq: "desc" },
      }));
    const status = statusAfter(last?.type);

    return {
      readiness,
      isSharedAccount: false,
      employee: {
        id: employee.id,
        name: fullName(employee),
        isActive: employee.isActive,
      },
      status,
      since: last?.occurredAt ?? null,
      allowedTypes: allowedNextTypes(status),
      recentPunches: recentPunches.map(toPunchView),
      pendingLegalTexts: await this.legalAcks.listPending(
        tenantId,
        employee.id,
      ),
    };
  }

  async ackOwnLegalTexts(tenantId: string, actor: PunchActor) {
    const employee = await this.findOwnEmployee(tenantId, actor.id);
    const count = await this.legalAcks.ackPending(tenantId, {
      id: employee.id,
      name: fullName(employee),
    });
    return { acknowledged: count };
  }

  /** Datos que necesita la pantalla de kiosco de un centro. */
  async getKioskState(tenantId: string, locationId: string | undefined) {
    const [readiness, settings, centers, legalTexts] = await Promise.all([
      this.legalTexts.getReadiness(tenantId),
      this.settings.get(tenantId),
      this.prisma.location.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, isDefault: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      this.legalAcks.listCurrent(tenantId),
    ]);
    const center = centers.find((c) => c.id === locationId) ?? null;
    const employees = center
      ? await this.listWithStatus(tenantId, {
          isActive: true,
          locations: { some: { locationId: center.id } },
        })
      : [];
    return {
      readiness,
      pinLength: settings.pinLength,
      centers,
      center,
      // En el kiosco solo hace falta el nombre y si está dentro o fuera.
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        hasPin: e.hasPin,
        status: e.status,
        allowedTypes: allowedNextTypes(e.status),
      })),
      legalTexts,
    };
  }

  /** Quién está trabajando ahora mismo (panel de gerencia). */
  async getPresence(tenantId: string) {
    return this.listWithStatus(tenantId, { isActive: true });
  }

  private async listWithStatus(
    tenantId: string,
    where: { isActive: boolean; locations?: object },
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, ...where },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    if (employees.length === 0) {
      return [];
    }

    // Último fichaje de cada empleado dentro de la ventana reciente.
    const recent = await this.prisma.timePunch.findMany({
      where: {
        tenantId,
        employeeId: { in: employees.map((e) => e.id) },
        occurredAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) },
      },
      orderBy: { seq: "desc" },
    });
    const lastByEmployee = new Map<string, TimePunch>();
    for (const punch of recent) {
      if (!lastByEmployee.has(punch.employeeId)) {
        lastByEmployee.set(punch.employeeId, punch);
      }
    }

    return employees.map((employee) => {
      const last = lastByEmployee.get(employee.id);
      return {
        id: employee.id,
        name: fullName(employee),
        jobTitle: employee.jobTitle,
        section: employee.section,
        hasPin: employee.pinHash !== null,
        status: statusAfter(last?.type),
        since: last?.occurredAt ?? null,
        lastPunch: last ? toPunchView(last) : null,
      };
    });
  }

  private async findOwnEmployee(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId },
    });
    if (!employee) {
      throw new ForbiddenException(
        "Tu cuenta no está vinculada a una ficha de empleado. Pídeselo a un administrador.",
      );
    }
    return employee;
  }

  private async findKioskEmployee(tenantId: string, employeeId?: string) {
    if (!employeeId) {
      throw new BadRequestException("Indica quién ficha.");
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return employee;
  }

  /**
   * Centro y geovalla del fichaje. En kiosco el centro es el del dispositivo y
   * el empleado debe estar asignado a él; en sesión personal se elige entre
   * los centros del empleado según la ubicación.
   */
  private async resolveCenter(
    tenantId: string,
    employee: Employee,
    source: PunchSource,
    dto: CreatePunchDto,
  ) {
    const assigned = await this.prisma.location.findMany({
      where: {
        tenantId,
        isActive: true,
        employeeLocations: { some: { employeeId: employee.id } },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        geofenceRadiusM: true,
        geofenceMode: true,
      },
    });
    const point: GeoPoint | null =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { latitude: dto.latitude, longitude: dto.longitude }
        : null;

    if (source === PunchSource.KIOSK) {
      const center = assigned.find((c) => c.id === dto.locationId);
      if (!center) {
        throw new ForbiddenException(
          "Este empleado no está asignado a este centro.",
        );
      }
      return resolveGeofence([center], point, center.id);
    }
    return resolveGeofence(assigned, point, employee.defaultLocationId);
  }
}

function transitionMessage(status: EmployeeWorkStatus): string {
  switch (status) {
    case "OUT":
      return "No tienes una entrada abierta: ficha primero la entrada.";
    case "IN":
      return "Ya tienes una entrada abierta: ficha la salida o una pausa.";
    case "ON_BREAK":
      return "Estás en pausa: ficha primero el fin de la pausa.";
  }
}

/** Vista de un fichaje para las pantallas (sin huellas ni datos de dispositivo). */
function toPunchView(punch: TimePunch) {
  return {
    id: punch.id,
    type: punch.type,
    occurredAt: punch.occurredAt,
    source: punch.source,
    locationName: punch.locationName,
    geofenceStatus: punch.geofenceStatus,
    distanceM: punch.distanceM,
  };
}
