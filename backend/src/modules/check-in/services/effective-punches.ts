import { Prisma, PunchType } from "@prisma/client";

/** Cliente Prisma o transacción: basta con poder leer estas tres tablas. */
type Reader = Pick<
  Prisma.TransactionClient,
  "timePunch" | "timePunchAdjustment" | "timePunchAdjustmentDecision"
>;

export interface TimelineEntry {
  id: string;
  type: PunchType;
  occurredAt: Date;
}

/**
 * Tiempo hacia atrás que se mira para saber en qué situación está alguien.
 * Una entrada abierta desde hace más ya no cuenta como "está trabajando": es
 * un olvido que aparece como incidencia en su jornada, y no debe obligarle a
 * fichar una salida días después.
 */
export const STATUS_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Fichajes que cuentan, por empleado y en orden temporal: los reales que no
 * estén anulados más los añadidos por correcciones aprobadas.
 *
 * Es la única fuente para decidir la situación de alguien (dentro, fuera, en
 * pausa): si gerencia añade la salida que se olvidó ayer, hoy tiene que poder
 * fichar la entrada.
 */
export async function loadEffectivePunches(
  db: Reader,
  tenantId: string,
  employeeIds: string[],
  from: Date,
): Promise<Map<string, TimelineEntry[]>> {
  const timeline = new Map<string, TimelineEntry[]>(
    employeeIds.map((id) => [id, []]),
  );
  if (employeeIds.length === 0) {
    return timeline;
  }

  const [punches, adjustments] = await Promise.all([
    db.timePunch.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        occurredAt: { gte: from },
      },
      select: { id: true, employeeId: true, type: true, occurredAt: true },
    }),
    db.timePunchAdjustment.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        OR: [{ occurredAt: { gte: from } }, { targetPunchId: { not: null } }],
      },
    }),
  ]);
  const decisions =
    adjustments.length === 0
      ? []
      : await db.timePunchAdjustmentDecision.findMany({
          where: {
            tenantId,
            status: "APPROVED",
            adjustmentId: { in: adjustments.map((a) => a.id) },
          },
          select: { adjustmentId: true },
        });
  const approvedIds = new Set(decisions.map((d) => d.adjustmentId));
  const approved = adjustments.filter((a) => approvedIds.has(a.id));

  const voided = new Set(
    approved
      .filter((a) => a.kind === "VOID" || a.kind === "REPLACE")
      .map((a) => a.targetPunchId as string),
  );

  for (const punch of punches) {
    if (!voided.has(punch.id)) {
      timeline.get(punch.employeeId)?.push({
        id: punch.id,
        type: punch.type,
        occurredAt: punch.occurredAt,
      });
    }
  }
  for (const adjustment of approved) {
    const adds = adjustment.kind === "ADD" || adjustment.kind === "REPLACE";
    if (
      adds &&
      adjustment.type &&
      adjustment.occurredAt &&
      adjustment.occurredAt >= from &&
      !voided.has(adjustment.id)
    ) {
      timeline.get(adjustment.employeeId)?.push({
        id: adjustment.id,
        type: adjustment.type,
        occurredAt: adjustment.occurredAt,
      });
    }
  }
  for (const entries of timeline.values()) {
    entries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
  return timeline;
}
