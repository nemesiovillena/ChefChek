import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Employee,
  PunchPinStatus,
  PunchSource,
  TimePunch,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreatePunchDto, SyncPunchItemDto } from "../dto/punch.dto";
import { KioskKeyService } from "./kiosk-key.service";
import { EmployeePinService } from "./employee-pin.service";
import { LegalAcksService } from "./legal-acks.service";
import { LegalTextsService } from "./legal-texts.service";
import { CheckInSettingsService } from "./check-in-settings.service";
import { GeoPoint, GeofenceResult, resolveGeofence } from "./geofence.util";
import { computePunchHash } from "./punch-hash.util";
import { STATUS_WINDOW_MS, loadEffectivePunches } from "./effective-punches";
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

/** Motivos por los que un fichaje queda marcado para que gerencia lo revise. */
export type ReviewReason =
  | "PIN"
  | "SECUENCIA"
  | "FUERA_DE_ZONA"
  | "RELOJ"
  | "TARDIO";

export type SyncStatus = "ACCEPTED" | "DUPLICATE" | "FLAGGED" | "REJECTED";

export interface SyncResult {
  id: string;
  status: SyncStatus;
  /** Motivos de revisión (FLAGGED) o causa del rechazo (REJECTED). */
  detail?: string;
}

/** Margen de adelanto del reloj del dispositivo que se tolera sin marcar. */
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Antigüedad a partir de la cual un fichaje sin conexión se marca: una cola
 * puede tardar un turno en enviarse, pero no días. Sin esto, cualquiera podría
 * fechar un fichaje en el pasado sin que nadie lo revisara.
 */
const OFFLINE_MAX_DELAY_MS = 24 * 60 * 60 * 1000;

interface AppendInput {
  id: string;
  type: CreatePunchDto["type"];
  occurredAt: Date;
  deviceTime: Date | null;
  source: PunchSource;
  actorId: string;
  geofence: GeofenceResult;
  point: (GeoPoint & { accuracyM?: number }) | null;
  pinStatus: PunchPinStatus;
  wasOffline: boolean;
  deviceId?: string;
  userAgent?: string;
  /** true: una secuencia imposible lanza 409. false: se guarda y se marca. */
  enforceSequence: boolean;
  review: ReviewReason[];
  /**
   * Siguiente fichaje de la misma persona dentro del mismo lote, aún sin
   * guardar: cuenta como "el siguiente" al comprobar que este encaja.
   */
  nextInBatch?: { type: CreatePunchDto["type"]; occurredAt: Date };
}

/** Ventana de los "últimos fichajes" que se enseñan en pantalla. */
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
    private readonly kioskKeys: KioskKeyService,
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
        // 403 y no 401: un 401 hace que el cliente intente renovar la sesión
        // y repita la petición, lo que contaría dos fallos de PIN por intento.
        throw new ForbiddenException("PIN incorrecto.");
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

    return this.append(tenantId, employee, {
      id: dto.id,
      type: dto.type,
      // Con conexión manda el reloj del servidor; el del dispositivo se
      // guarda aparte.
      occurredAt: new Date(),
      deviceTime: dto.deviceTime ?? null,
      source,
      actorId: actor.id,
      geofence,
      point: pointOf(dto),
      pinStatus,
      wasOffline: false,
      deviceId: dto.deviceId,
      userAgent,
      enforceSequence: true,
      review: [],
    });
  }

  /**
   * Fichajes hechos sin conexión. Ya ocurrieron, así que la prioridad es no
   * perderlos: lo que con conexión se rechazaría (PIN que no cuadra, secuencia
   * imposible, fuera de una zona con bloqueo) aquí se guarda marcado para que
   * gerencia lo revise. Solo se rechaza lo que no puede atribuirse a nadie.
   */
  async sync(
    tenantId: string,
    actor: PunchActor,
    items: SyncPunchItemDto[],
    userAgent?: string,
  ): Promise<SyncResult[]> {
    const readiness = await this.legalTexts.getReadiness(tenantId);
    const ordered = [...items].sort(
      (a, b) => a.deviceTime.getTime() - b.deviceTime.getTime(),
    );
    const results: SyncResult[] = [];
    for (const [index, item] of ordered.entries()) {
      if (!readiness.ready) {
        results.push({
          id: item.id,
          status: "REJECTED",
          detail: "El fichaje no está habilitado en esta empresa.",
        });
        continue;
      }
      try {
        // En kiosco el lote mezcla personas; en cuenta personal es una sola.
        const next = ordered
          .slice(index + 1)
          .find(
            (later) =>
              !actor.isSharedAccount || later.employeeId === item.employeeId,
          );
        results.push(
          await this.syncOne(tenantId, actor, item, userAgent, next),
        );
      } catch (error) {
        results.push({
          id: item.id,
          status: "REJECTED",
          detail: error instanceof Error ? error.message : "Error",
        });
      }
    }
    return results;
  }

  private async syncOne(
    tenantId: string,
    actor: PunchActor,
    item: SyncPunchItemDto,
    userAgent?: string,
    nextInBatch?: SyncPunchItemDto,
  ): Promise<SyncResult> {
    const source = actor.isSharedAccount
      ? PunchSource.KIOSK
      : PunchSource.PERSONAL;
    const employee =
      source === PunchSource.KIOSK
        ? await this.findKioskEmployee(tenantId, item.employeeId)
        : await this.findOwnEmployee(tenantId, actor.id);

    const existing = await this.prisma.timePunch.findUnique({
      where: { id: item.id },
    });
    if (existing) {
      if (
        existing.tenantId !== tenantId ||
        existing.employeeId !== employee.id
      ) {
        throw new ConflictException("Identificador de fichaje ya utilizado.");
      }
      return { id: item.id, status: "DUPLICATE" };
    }
    if (!employee.isActive) {
      throw new ForbiddenException("Este empleado está dado de baja.");
    }

    const review: ReviewReason[] = [];
    let pinStatus: PunchPinStatus = PunchPinStatus.NOT_REQUIRED;
    if (source === PunchSource.KIOSK) {
      pinStatus = (await this.verifyOfflinePin(tenantId, employee.id, item))
        ? PunchPinStatus.VERIFIED
        : PunchPinStatus.PENDING_REVIEW;
      if (pinStatus === PunchPinStatus.PENDING_REVIEW) {
        review.push("PIN");
      }
    }

    const geofence = await this.resolveCenter(tenantId, employee, source, item);
    if (geofence.blocked) {
      review.push("FUERA_DE_ZONA");
    }

    // Un reloj adelantado no puede fechar un fichaje en el futuro.
    const now = new Date();
    let occurredAt = item.deviceTime;
    if (occurredAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) {
      occurredAt = now;
      review.push("RELOJ");
    } else if (occurredAt.getTime() < now.getTime() - OFFLINE_MAX_DELAY_MS) {
      review.push("TARDIO");
    }

    const saved = await this.append(tenantId, employee, {
      id: item.id,
      type: item.type,
      occurredAt,
      deviceTime: item.deviceTime,
      source,
      actorId: actor.id,
      geofence,
      point: pointOf(item),
      pinStatus,
      wasOffline: true,
      deviceId: item.deviceId,
      userAgent,
      enforceSequence: false,
      review,
      nextInBatch: nextInBatch && {
        type: nextInBatch.type,
        occurredAt: nextInBatch.deviceTime,
      },
    });
    return saved.needsReview
      ? { id: item.id, status: "FLAGGED", detail: saved.reviewReason ?? "" }
      : { id: item.id, status: "ACCEPTED" };
  }

  /** PIN de un fichaje sin conexión: cualquier fallo lo deja "a revisar". */
  private async verifyOfflinePin(
    tenantId: string,
    employeeId: string,
    item: SyncPunchItemDto,
  ): Promise<boolean> {
    if (!item.encryptedPin) {
      return false;
    }
    const pin = await this.kioskKeys.decryptPin(
      tenantId,
      item.id,
      item.encryptedPin,
    );
    if (!pin) {
      return false;
    }
    try {
      return await this.pins.verifyPin(tenantId, employeeId, pin);
    } catch {
      return false; // sin PIN asignado o bloqueado
    }
  }

  /** Inserta el fichaje: numeración, huella y comprobación de secuencia. */
  private async append(
    tenantId: string,
    employee: Employee,
    input: AppendInput,
  ): Promise<TimePunch> {
    return this.prisma.$transaction(async (tx) => {
      // Serializa los fichajes del tenant: la numeración y la huella dependen
      // del anterior, y la validación de secuencia no debe ver un estado viejo
      // si la misma persona pulsa dos veces.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

      // El fichaje inmediatamente anterior en el tiempo (no el último en
      // llegar: uno hecho sin conexión puede llegar después de otro posterior).
      // La situación sale de los fichajes que cuentan (con las correcciones
      // aprobadas aplicadas), no solo de los originales.
      const timeline =
        (
          await loadEffectivePunches(
            tx,
            tenantId,
            [employee.id],
            new Date(input.occurredAt.getTime() - STATUS_WINDOW_MS),
          )
        ).get(employee.id) ?? [];
      const previous = [...timeline]
        .reverse()
        .find((entry) => entry.occurredAt <= input.occurredAt);
      const status = statusAfter(previous?.type);
      const review = [...input.review];
      if (!isAllowedTransition(status, input.type)) {
        if (input.enforceSequence) {
          throw new ConflictException(transitionMessage(status));
        }
        review.push("SECUENCIA");
      } else if (!input.enforceSequence) {
        // Un fichaje que llega tarde también debe encajar con el siguiente
        // que ya estaba registrado (p. ej. no dejar dos salidas seguidas).
        const stored = timeline.find(
          (entry) => entry.occurredAt > input.occurredAt,
        );
        const pending = input.nextInBatch;
        const next =
          pending && (!stored || pending.occurredAt < stored.occurredAt)
            ? pending
            : stored;
        if (next && !isAllowedTransition(statusAfter(input.type), next.type)) {
          review.push("SECUENCIA");
        }
      }

      const lastOfTenant = await tx.timePunch.findFirst({
        where: { tenantId },
        orderBy: { seq: "desc" },
        select: { seq: true, hash: true },
      });
      const seq = (lastOfTenant?.seq ?? 0) + 1;
      const prevHash = lastOfTenant?.hash ?? null;

      const data = {
        id: input.id,
        tenantId,
        employeeId: employee.id,
        employeeName: fullName(employee),
        type: input.type,
        occurredAt: input.occurredAt,
        deviceTime: input.deviceTime,
        source: input.source,
        recordedByUserId: input.actorId,
        locationId: input.geofence.center?.id ?? null,
        locationName: input.geofence.center?.name ?? null,
        latitude: input.point?.latitude ?? null,
        longitude: input.point?.longitude ?? null,
        accuracyM: input.point?.accuracyM ?? null,
        distanceM: input.geofence.distanceM,
        geofenceStatus: input.geofence.status,
        pinStatus: input.pinStatus,
        wasOffline: input.wasOffline,
        deviceId: input.deviceId ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        needsReview: review.length > 0,
        reviewReason: review.length > 0 ? review.join(",") : null,
        seq,
        prevHash,
      };
      return tx.timePunch.create({
        data: { ...data, hash: computePunchHash(prevHash, data) },
      });
    });
  }

  /** Fichajes marcados para revisión (los más recientes primero). */
  async listForReview(tenantId: string) {
    const flagged = await this.prisma.timePunch.findMany({
      where: { tenantId, needsReview: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    // Un fichaje deja de estar "a revisar" cuando una corrección aprobada lo
    // da por bueno, lo anula o lo sustituye. La marca original no se toca.
    const corrections = await this.prisma.timePunchAdjustment.findMany({
      where: { tenantId, targetPunchId: { in: flagged.map((p) => p.id) } },
      select: { id: true, targetPunchId: true },
    });
    const approved = await this.prisma.timePunchAdjustmentDecision.findMany({
      where: {
        tenantId,
        status: "APPROVED",
        adjustmentId: { in: corrections.map((c) => c.id) },
      },
      select: { adjustmentId: true },
    });
    const approvedIds = new Set(approved.map((d) => d.adjustmentId));
    const resolved = new Set(
      corrections
        .filter((c) => approvedIds.has(c.id))
        .map((c) => c.targetPunchId),
    );
    const punches = flagged.filter((p) => !resolved.has(p.id)).slice(0, 100);
    return punches.map((punch) => ({
      ...toPunchView(punch),
      employeeId: punch.employeeId,
      employeeName: punch.employeeName,
      reviewReason: punch.reviewReason,
      wasOffline: punch.wasOffline,
      receivedAt: punch.receivedAt,
    }));
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
      orderBy: [{ occurredAt: "desc" }, { seq: "desc" }],
      take: 12,
    });
    const last = await this.lastEffective(tenantId, employee.id);
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
    const [readiness, settings, centers, legalTexts, pinPublicKey] =
      await Promise.all([
        this.legalTexts.getReadiness(tenantId),
        this.settings.get(tenantId),
        this.prisma.location.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, name: true, isDefault: true },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        }),
        this.legalAcks.listCurrent(tenantId),
        this.kioskKeys.getPublicKey(tenantId),
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
      // Para cifrar el PIN de los fichajes que se hagan sin conexión.
      pinPublicKey,
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

    const effective = await loadEffectivePunches(
      this.prisma,
      tenantId,
      employees.map((e) => e.id),
      new Date(Date.now() - STATUS_WINDOW_MS),
    );
    // Último fichaje real de cada empleado, para mostrar dónde y cómo fichó.
    const recent = await this.prisma.timePunch.findMany({
      where: {
        tenantId,
        employeeId: { in: employees.map((e) => e.id) },
        occurredAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) },
      },
      orderBy: [{ occurredAt: "desc" }, { seq: "desc" }],
    });
    const lastByEmployee = new Map<string, TimePunch>();
    for (const punch of recent) {
      if (!lastByEmployee.has(punch.employeeId)) {
        lastByEmployee.set(punch.employeeId, punch);
      }
    }

    return employees.map((employee) => {
      const last = lastByEmployee.get(employee.id);
      const lastEffective = effective.get(employee.id)?.at(-1);
      return {
        id: employee.id,
        name: fullName(employee),
        jobTitle: employee.jobTitle,
        section: employee.section,
        hasPin: employee.pinHash !== null,
        status: statusAfter(lastEffective?.type),
        since: lastEffective?.occurredAt ?? null,
        lastPunch: last ? toPunchView(last) : null,
      };
    });
  }

  /** Último fichaje que cuenta de una persona (o nada si lleva días sin fichar). */
  private async lastEffective(tenantId: string, employeeId: string) {
    const timeline = await loadEffectivePunches(
      this.prisma,
      tenantId,
      [employeeId],
      new Date(Date.now() - STATUS_WINDOW_MS),
    );
    return timeline.get(employeeId)?.at(-1);
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
    dto: Pick<CreatePunchDto, "latitude" | "longitude" | "locationId">,
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

function pointOf(dto: {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
}): (GeoPoint & { accuracyM?: number }) | null {
  return dto.latitude !== undefined && dto.longitude !== undefined
    ? {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyM: dto.accuracyM,
      }
    : null;
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
    needsReview: punch.needsReview,
  };
}
