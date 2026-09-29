import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  SICTED_COMMITMENT_MINIMUMS as MIN,
  SictedCyclePhase,
} from "../constants/sicted-cycle-commitments";
import { evaluateSictedCommitments } from "../util/sicted-commitments-evaluator";
import { SictedSettingsService } from "./sicted-settings.service";

const DAY_MS = 24 * 60 * 60 * 1000;

function monthsBefore(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Minúsculas y sin tildes, para reconocer «Declaración responsable» en etiquetas libres. */
function fold(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Panel de compromisos por fase (Chefchek no se integra con la web SICTED:
 * espeja su «visor de cumplimiento» con lo que ya se registra aquí). Solo
 * lectura, sin tabla propia.
 *
 * Ventanas: la fase va de `phaseStartedAt` (o 12 meses antes del comité) al
 * comité (o hoy si no hay comité fijado); la formación cuenta en los 12
 * meses previos al comité y la evaluación externa en los 6 previos.
 */
@Injectable()
export class SictedCommitmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SictedSettingsService,
  ) {}

  async get(tenantId: string, now = new Date()) {
    const settings = await this.settings.get(tenantId);
    const phase = settings.cyclePhase as SictedCyclePhase | null;
    const committee = settings.nextCommitteeDate;
    const end = committee ?? now;
    const phaseStart = settings.phaseStartedAt ?? monthsBefore(end, 12);
    const trainingStart = monthsBefore(end, 12);
    const evaluationStart = monthsBefore(
      end,
      MIN.externalEvaluationMonthsBeforeCommittee,
    );
    const inPhase = { gte: phaseStart, lte: end };

    const header = {
      phase,
      phaseStartedAt: settings.phaseStartedAt,
      nextCommitteeDate: committee,
      daysToCommittee: committee
        ? Math.ceil((committee.getTime() - now.getTime()) / DAY_MS)
        : null,
    };
    if (!phase) {
      return { ...header, items: [] };
    }

    const [training, events, assessments, actions, legalDocs] =
      await Promise.all([
        this.prisma.sictedTrainingAction.findMany({
          where: {
            tenantId,
            done: true,
            doneAt: { gte: trainingStart, lte: end },
          },
          select: { hours: true },
        }),
        this.prisma.sictedEvent.findMany({
          where: {
            tenantId,
            attended: true,
            eventDate: {
              gte: phaseStart < evaluationStart ? phaseStart : evaluationStart,
              lte: end,
            },
          },
          select: { kind: true, eventDate: true },
        }),
        this.prisma.sictedAssessment.findMany({
          where: { tenantId, createdAt: inPhase },
          select: { status: true },
        }),
        this.prisma.sictedImprovementAction.findMany({
          where: { tenantId, status: { not: "CANCELLED" } },
          select: { status: true, responsibleName: true, dueDate: true },
        }),
        this.prisma.sictedComplianceDoc.findMany({
          where: { tenantId, archivedAt: null, createdAt: inPhase },
          select: { label: true, title: true },
        }),
      ]);

    const eventsInPhase = events.filter((e) => e.eventDate >= phaseStart);
    const countKind = (kind: string) =>
      eventsInPhase.filter((e) => e.kind === kind).length;

    const items = evaluateSictedCommitments(phase, {
      trainingHours: training.reduce((sum, t) => sum + (t.hours ?? 0), 0),
      atiCount: countKind("ATI"),
      atcCount: countKind("ATC"),
      groupMeetings: countKind("GRUPO_MEJORA"),
      assessmentClosedInPhase: assessments.some((a) => a.status === "CLOSED"),
      assessmentDraftInPhase: assessments.some((a) => a.status === "DRAFT"),
      activeImprovementActions: actions.length,
      plannedImprovementActions: actions.filter(
        (a) => a.responsibleName && a.dueDate,
      ).length,
      doneImprovementActions: actions.filter((a) => a.status === "DONE").length,
      externalEvaluationInWindow: events.some(
        (e) =>
          e.kind === "EVALUACION_EXTERNA" && e.eventDate >= evaluationStart,
      ),
      responsibleDeclarationInPhase: legalDocs.some((d) =>
        fold(`${d.label} ${d.title}`).includes("declaracion responsable"),
      ),
    });
    return { ...header, items };
  }
}
