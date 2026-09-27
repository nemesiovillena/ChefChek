import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  ChecklistFrequency,
  computePeriodKey,
  isGenerationDay,
  madridCalendarDay,
} from "../../checklists/util/checklist-period.util";

export interface CoverageGap {
  templateId: string;
  templateName: string;
  area: string;
  periodKey: string;
  /** Sin fila (cron caído / plantilla creada después) o generada pero incompleta. */
  status: "MISSING" | "INCOMPLETE";
  /** Solo en INCOMPLETE — la hoja existe, se puede enlazar a su detalle. MISSING no tiene fila que enlazar. */
  runId?: string;
}

export interface CoverageReport {
  from: string;
  to: string;
  expected: number;
  completed: number;
  validated: number;
  gaps: CoverageGap[];
}

/**
 * "¿Qué días/tareas no están registrados?" — antes de que lo pregunte el
 * auditor. `expected` se define plantilla a plantilla recorriendo cada día
 * natural (Europe/Madrid) del rango y usando `isGenerationDay` (la misma
 * regla que decide cuándo el cron genera una hoja, fase 2) — así "esperado"
 * nunca se desincroniza de "cuándo se genera de verdad". Una plantilla
 * archivada a mitad de rango, o creada a mitad de rango, solo cuenta desde/
 * hasta que existió (filtro por `createdAt`/`archivedAt`).
 */
@Injectable()
export class SictedCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async coverage(
    tenantId: string,
    from: Date,
    to: Date,
    now: Date = new Date(),
  ): Promise<CoverageReport> {
    // Un día futuro no es un "hueco" — todavía no le tocaba generarse. Sin
    // este tope, pedir la cobertura del mes en curso a mitad de mes marcaba
    // como "sin generar" todos los días que aún no habían llegado.
    const effectiveTo = to > now ? now : to;
    const templates = await this.prisma.checklistTemplate.findMany({
      where: {
        tenantId,
        usedByModules: { has: "sicted" },
        createdAt: { lt: effectiveTo },
        OR: [{ archivedAt: null }, { archivedAt: { gt: from } }],
      },
      select: {
        id: true,
        name: true,
        area: true,
        frequency: true,
        weekday: true,
        dayOfMonth: true,
        createdAt: true,
        archivedAt: true,
      },
    });

    const gaps: CoverageGap[] = [];
    let expected = 0;
    let completed = 0;
    let validated = 0;

    for (const template of templates) {
      const periodKeys = this.expectedPeriodKeys(template, from, effectiveTo);
      if (periodKeys.size === 0) {
        continue;
      }

      const runs = await this.prisma.checklistRun.findMany({
        where: {
          tenantId,
          templateId: template.id,
          periodKey: { in: [...periodKeys] },
        },
        select: { id: true, periodKey: true, status: true, supervisedAt: true },
      });
      const runByPeriod = new Map(runs.map((r) => [r.periodKey, r]));

      for (const periodKey of periodKeys) {
        expected += 1;
        const run = runByPeriod.get(periodKey);
        if (!run) {
          gaps.push({
            templateId: template.id,
            templateName: template.name,
            area: template.area,
            periodKey,
            status: "MISSING",
          });
          continue;
        }
        if (run.status === "INCOMPLETE") {
          gaps.push({
            templateId: template.id,
            templateName: template.name,
            area: template.area,
            periodKey,
            status: "INCOMPLETE",
            runId: run.id,
          });
          continue;
        }
        if (run.status === "COMPLETED") {
          completed += 1;
          if (run.supervisedAt) {
            validated += 1;
          }
        }
      }
    }

    gaps.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      expected,
      completed,
      validated,
      gaps,
    };
  }

  /**
   * Días naturales (Madrid) en [from,to) donde `isGenerationDay` dice que
   * toca generar, convertidos a periodKeys únicos. `to` es EXCLUSIVO — se
   * compara el instante (mediodía UTC del día candidato) contra `to`
   * directamente, no el día natural de `to` (que por el desfase Madrid/UTC
   * podía incluir un día de más: `to`="2026-05-11T00:00:00Z" cae ya en el 11
   * de mayo en Madrid, y compararlo por día natural colaba ese día entero
   * como "esperado" aunque el rango pedido terminara a medianoche).
   */
  private expectedPeriodKeys(
    template: {
      frequency: string;
      weekday: number | null;
      dayOfMonth: number | null;
      createdAt: Date;
      archivedAt: Date | null;
    },
    from: Date,
    to: Date,
  ): Set<string> {
    const frequency = template.frequency as ChecklistFrequency;
    const keys = new Set<string>();
    const start = template.createdAt > from ? template.createdAt : from;
    const end =
      template.archivedAt && template.archivedAt < to
        ? template.archivedAt
        : to;

    const startDay = madridCalendarDay(start);
    let probe = new Date(Date.UTC(startDay.y, startDay.m - 1, startDay.d, 12));

    while (probe.getTime() < end.getTime()) {
      if (
        isGenerationDay(probe, frequency, template.weekday, template.dayOfMonth)
      ) {
        keys.add(computePeriodKey(probe, frequency));
      }
      // +24h en UTC desde mediodía nunca cruza una medianoche local (ni en
      // Madrid ni en ningún huso razonable) → el día natural Madrid avanza
      // exactamente uno, estable frente al cambio de hora.
      probe = new Date(probe.getTime() + 86_400_000);
    }
    return keys;
  }
}
