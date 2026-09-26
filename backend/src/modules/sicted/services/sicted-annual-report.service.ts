import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { SictedAssessmentService } from "./sicted-assessment.service";
import { SictedFeedbackService } from "./sicted-feedback.service";

export interface SictedAnnualReport {
  year: number;
  objectives: {
    id: string;
    title: string;
    status: string;
    indicator: string | null;
    target: string | null;
    currentValue: string | null;
  }[];
  improvementActions: {
    openCount: number;
    closedThisYearCount: number;
    closedThisYear: { code: number; title: string; closedAt: string }[];
  };
  events: { kind: string; count: number }[];
  legalDocs: { label: string; title: string; expiresAt: string | null }[];
  supplierIncidents: { count: number; resolvedCount: number };
  training: { plansCount: number; actionsTotal: number; actionsDone: number };
  feedback: { total: number; open: number; overdue: number };
  satisfaction: { samplesCount: number; averageScore: number | null };
  assessment: {
    label: string;
    closedAt: string;
    pendingMandatoryCount: number;
  } | null;
}

/**
 * Informe anual de calidad (DIR.10, fase 9, sub-PR 4/4): export agregado, no
 * un formulario manual. Compagina datos que ya viven en fases anteriores
 * (2/4/6/7/8/9) — solo lectura, sin tabla nueva. Un botón "Generar informe
 * anual" en la UI en vez de rellenar un documento aparte.
 */
@Injectable()
export class SictedAnnualReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: SictedAssessmentService,
    private readonly feedback: SictedFeedbackService,
  ) {}

  async aggregate(tenantId: string, year: number): Promise<SictedAnnualReport> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [
      objectives,
      openActions,
      closedThisYear,
      eventsByKind,
      legalDocs,
      supplierIncidents,
      trainingPlans,
      feedbackItems,
      satisfaction,
      lastClosedAssessment,
      overdueFeedback,
    ] = await Promise.all([
      this.prisma.sictedObjective.findMany({
        where: { tenantId, year },
        select: {
          id: true,
          title: true,
          status: true,
          indicator: true,
          target: true,
          currentValue: true,
        },
      }),
      this.prisma.sictedImprovementAction.count({
        where: { tenantId, status: "OPEN" },
      }),
      this.prisma.sictedImprovementAction.findMany({
        where: { tenantId, closedAt: { gte: yearStart, lt: yearEnd } },
        select: { code: true, title: true, closedAt: true },
        orderBy: { closedAt: "asc" },
      }),
      this.prisma.sictedEvent.groupBy({
        by: ["kind"],
        where: { tenantId, eventDate: { gte: yearStart, lt: yearEnd } },
        _count: { _all: true },
      }),
      this.prisma.sictedComplianceDoc.findMany({
        where: { tenantId, archivedAt: null },
        select: { label: true, title: true, expiresAt: true },
        orderBy: { expiresAt: "asc" },
      }),
      this.prisma.sictedSupplierIncident.findMany({
        where: { tenantId, occurredAt: { gte: yearStart, lt: yearEnd } },
        select: { resolvedAt: true },
      }),
      this.prisma.sictedTrainingPlan.findMany({
        where: { tenantId, year },
        include: { actions: { select: { done: true } } },
      }),
      this.prisma.sictedFeedback.findMany({
        where: { tenantId, receivedAt: { gte: yearStart, lt: yearEnd } },
        select: { status: true, receivedAt: true, respondedAt: true },
      }),
      this.prisma.sictedSatisfactionSample.findMany({
        where: { tenantId, sampledAt: { gte: yearStart, lt: yearEnd } },
        select: { score: true },
      }),
      this.prisma.sictedAssessment.findFirst({
        where: {
          tenantId,
          status: "CLOSED",
          closedAt: { gte: yearStart, lt: yearEnd },
        },
        orderBy: { closedAt: "desc" },
      }),
      // Umbral de SLA configurable por tenant (fase 8, `SictedFeedbackService`)
      // — no se duplica ese cálculo aquí; se filtra al año del informe abajo.
      this.feedback.overdue(tenantId),
    ]);
    const overdueThisYear = overdueFeedback.items.filter(
      (i) => i.receivedAt >= yearStart && i.receivedAt < yearEnd,
    ).length;

    let assessment: SictedAnnualReport["assessment"] = null;
    if (lastClosedAssessment) {
      const pending = await this.assessments.pendingMandatory(
        tenantId,
        lastClosedAssessment.id,
      );
      assessment = {
        label: lastClosedAssessment.label,
        closedAt: lastClosedAssessment.closedAt!.toISOString(),
        pendingMandatoryCount: pending.length,
      };
    }

    const actionsTotal = trainingPlans.reduce(
      (sum, p) => sum + p.actions.length,
      0,
    );
    const actionsDone = trainingPlans.reduce(
      (sum, p) => sum + p.actions.filter((a) => a.done).length,
      0,
    );
    const scores = satisfaction.map((s) => s.score);

    return {
      year,
      objectives,
      improvementActions: {
        openCount: openActions,
        closedThisYearCount: closedThisYear.length,
        closedThisYear: closedThisYear.map((a) => ({
          code: a.code,
          title: a.title,
          closedAt: a.closedAt!.toISOString(),
        })),
      },
      events: eventsByKind.map((e) => ({ kind: e.kind, count: e._count._all })),
      legalDocs: legalDocs.map((d) => ({
        label: d.label,
        title: d.title,
        expiresAt: d.expiresAt?.toISOString() ?? null,
      })),
      supplierIncidents: {
        count: supplierIncidents.length,
        resolvedCount: supplierIncidents.filter((i) => i.resolvedAt).length,
      },
      training: { plansCount: trainingPlans.length, actionsTotal, actionsDone },
      feedback: {
        total: feedbackItems.length,
        open: feedbackItems.filter((f) => f.status === "OPEN").length,
        overdue: overdueThisYear,
      },
      satisfaction: {
        samplesCount: scores.length,
        averageScore:
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null,
      },
      assessment,
    };
  }
}
