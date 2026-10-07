import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PunchAdjustmentKind,
  PunchAdjustmentStatus,
  TimePunchAdjustment,
  TimePunchAdjustmentDecision,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateAdjustmentDto } from "../dto/workday.dto";

export interface Actor {
  id: string;
  name: string;
}

export type AdjustmentWithDecision = TimePunchAdjustment & {
  decision: TimePunchAdjustmentDecision | null;
};

const NEEDS_TARGET: PunchAdjustmentKind[] = [
  PunchAdjustmentKind.VOID,
  PunchAdjustmentKind.REPLACE,
  PunchAdjustmentKind.CONFIRM,
];
const NEEDS_NEW_PUNCH: PunchAdjustmentKind[] = [
  PunchAdjustmentKind.ADD,
  PunchAdjustmentKind.REPLACE,
];

/**
 * Correcciones de fichajes. El fichaje original nunca se modifica: una
 * corrección es una fila nueva (motivo y autor) y su aprobación o rechazo,
 * otra. Ambas tablas son append-only en Postgres.
 */
@Injectable()
export class AdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Solicitud del propio empleado: queda pendiente de decisión. */
  async request(
    tenantId: string,
    employee: { id: string; name: string },
    dto: CreateAdjustmentDto,
    requester: Actor,
  ): Promise<AdjustmentWithDecision> {
    if (dto.kind === PunchAdjustmentKind.CONFIRM) {
      throw new BadRequestException(
        "Solo un responsable puede dar por bueno un fichaje.",
      );
    }
    await this.assertValid(tenantId, employee.id, dto);
    const adjustment = await this.prisma.timePunchAdjustment.create({
      data: this.toData(tenantId, employee, dto, requester),
    });
    return { ...adjustment, decision: null };
  }

  /** Corrección hecha por gerencia: se registra ya aprobada, con su motivo. */
  async createApproved(
    tenantId: string,
    employee: { id: string; name: string },
    dto: CreateAdjustmentDto,
    manager: Actor,
  ): Promise<AdjustmentWithDecision> {
    await this.assertNotOwnRecord(tenantId, employee.id, manager.id);
    await this.assertValid(tenantId, employee.id, dto);
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.timePunchAdjustment.create({
        data: this.toData(tenantId, employee, dto, manager),
      });
      const decision = await tx.timePunchAdjustmentDecision.create({
        data: {
          tenantId,
          adjustmentId: adjustment.id,
          status: PunchAdjustmentStatus.APPROVED,
          decidedByUserId: manager.id,
          decidedByName: manager.name,
        },
      });
      return { ...adjustment, decision };
    });
  }

  async decide(
    tenantId: string,
    adjustmentId: string,
    approve: boolean,
    note: string | undefined,
    manager: Actor,
  ): Promise<AdjustmentWithDecision> {
    const adjustment = await this.prisma.timePunchAdjustment.findFirst({
      where: { id: adjustmentId, tenantId },
    });
    if (!adjustment) {
      throw new NotFoundException("Solicitud no encontrada");
    }
    await this.assertNotOwnRecord(tenantId, adjustment.employeeId, manager.id);
    if (!approve && !note?.trim()) {
      throw new BadRequestException("Indica por qué se rechaza.");
    }
    try {
      const decision = await this.prisma.timePunchAdjustmentDecision.create({
        data: {
          tenantId,
          adjustmentId,
          status: approve
            ? PunchAdjustmentStatus.APPROVED
            : PunchAdjustmentStatus.REJECTED,
          note: note?.trim() || null,
          decidedByUserId: manager.id,
          decidedByName: manager.name,
        },
      });
      return { ...adjustment, decision };
    } catch (error) {
      // unique(adjustmentId): otra persona ya la decidió.
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Esta solicitud ya está resuelta.");
      }
      throw error;
    }
  }

  async list(
    tenantId: string,
    filter: { employeeId?: string; onlyPending?: boolean } = {},
  ): Promise<AdjustmentWithDecision[]> {
    const adjustments = await this.prisma.timePunchAdjustment.findMany({
      where: { tenantId, employeeId: filter.employeeId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const withDecision = await this.attachDecisions(tenantId, adjustments);
    return filter.onlyPending
      ? withDecision.filter((a) => a.decision === null)
      : withDecision;
  }

  /**
   * Todas las correcciones de una persona, sin tope. El cómputo de la jornada
   * y los informes necesitan el historial completo: con un límite, las más
   * antiguas dejarían de aplicarse.
   */
  async listAllForEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<AdjustmentWithDecision[]> {
    const adjustments = await this.prisma.timePunchAdjustment.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: "desc" },
    });
    return this.attachDecisions(tenantId, adjustments);
  }

  /** Correcciones aprobadas de una persona: las que cambian su jornada. */
  async listApproved(
    tenantId: string,
    employeeId: string,
  ): Promise<TimePunchAdjustment[]> {
    const all = await this.listAllForEmployee(tenantId, employeeId);
    return all.filter(
      (a) => a.decision?.status === PunchAdjustmentStatus.APPROVED,
    );
  }

  async attachDecisions(
    tenantId: string,
    adjustments: TimePunchAdjustment[],
  ): Promise<AdjustmentWithDecision[]> {
    if (adjustments.length === 0) {
      return [];
    }
    const decisions = await this.prisma.timePunchAdjustmentDecision.findMany({
      where: { tenantId, adjustmentId: { in: adjustments.map((a) => a.id) } },
    });
    const byAdjustment = new Map(decisions.map((d) => [d.adjustmentId, d]));
    return adjustments.map((a) => ({
      ...a,
      decision: byAdjustment.get(a.id) ?? null,
    }));
  }

  /**
   * Nadie corrige ni aprueba su propia jornada: tiene que hacerlo otro
   * responsable. Quien gestiona el módulo puede pedir la corrección desde su
   * cuenta como cualquier empleado.
   */
  async assertNotOwnRecord(
    tenantId: string,
    employeeId: string,
    managerUserId: string,
  ) {
    const own = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, userId: managerUserId },
      select: { id: true },
    });
    if (own) {
      throw new ForbiddenException(
        "No puedes corregir ni aprobar tu propia jornada. Tiene que hacerlo otro responsable.",
      );
    }
  }

  private toData(
    tenantId: string,
    employee: { id: string; name: string },
    dto: CreateAdjustmentDto,
    requester: Actor,
  ) {
    const needsNew = NEEDS_NEW_PUNCH.includes(dto.kind);
    return {
      tenantId,
      employeeId: employee.id,
      employeeName: employee.name,
      kind: dto.kind,
      targetPunchId: NEEDS_TARGET.includes(dto.kind)
        ? (dto.targetPunchId ?? null)
        : null,
      type: needsNew ? (dto.type ?? null) : null,
      occurredAt: needsNew ? (dto.occurredAt ?? null) : null,
      reason: dto.reason.trim(),
      requestedByUserId: requester.id,
      requestedByName: requester.name,
    };
  }

  private async assertValid(
    tenantId: string,
    employeeId: string,
    dto: CreateAdjustmentDto,
  ) {
    if (NEEDS_NEW_PUNCH.includes(dto.kind)) {
      if (!dto.type || !dto.occurredAt) {
        throw new BadRequestException("Indica el tipo y la hora del fichaje.");
      }
      if (dto.occurredAt.getTime() > Date.now() + 60_000) {
        throw new BadRequestException(
          "No se puede registrar un fichaje en el futuro.",
        );
      }
    }
    if (NEEDS_TARGET.includes(dto.kind)) {
      if (!dto.targetPunchId) {
        throw new BadRequestException("Indica a qué fichaje afecta.");
      }
      // El objetivo puede ser un fichaje real o uno añadido por una corrección.
      const [punch, added] = await Promise.all([
        this.prisma.timePunch.findFirst({
          where: { id: dto.targetPunchId, tenantId, employeeId },
          select: { id: true },
        }),
        this.prisma.timePunchAdjustment.findFirst({
          where: { id: dto.targetPunchId, tenantId, employeeId },
          select: { id: true },
        }),
      ]);
      if (!punch && !added) {
        throw new BadRequestException("El fichaje indicado no existe.");
      }
    }
  }
}
