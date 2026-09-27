import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedFeedbackService } from "../../src/modules/sicted/services/sicted-feedback.service";
import { SictedAssessmentService } from "../../src/modules/sicted/services/sicted-assessment.service";
import { SictedPracticeCatalogService } from "../../src/modules/sicted/services/sicted-practice-catalog.service";
import { SictedAnnualReportService } from "../../src/modules/sicted/services/sicted-annual-report.service";

/**
 * Fase 9 SICTED (sub-PR 4) — informe anual: agregación de solo lectura de
 * fases 2/4/6/7/8/9. Sin tabla nueva — se inserta directamente vía Prisma
 * en cada tabla de dominio (ya testeadas en su propia fase) para verificar
 * que el agregado las cuenta y filtra por año correctamente.
 */
describe("E2E - Informe anual SICTED (fase 9, sub-PR 4)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let catalog: SictedPracticeCatalogService;
  let assessments: SictedAssessmentService;
  let report: SictedAnnualReportService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedPracticeCatalogService,
        SictedAssessmentService,
        SictedFeedbackService,
        SictedAnnualReportService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    catalog = moduleRef.get(SictedPracticeCatalogService);
    assessments = moduleRef.get(SictedAssessmentService);
    report = moduleRef.get(SictedAnnualReportService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Informe Anual E2E Tenant",
        slug: "e2e-sicted-informe-anual",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    await catalog.seedCatalog(tenantId);
  });

  afterAll(async () => {
    await prisma.sictedTrainingAction.deleteMany({ where: { tenantId } });
    await prisma.sictedTrainingPlan.deleteMany({ where: { tenantId } });
    await prisma.sictedComplianceDoc.deleteMany({ where: { tenantId } });
    await prisma.sictedImprovementAction.deleteMany({ where: { tenantId } });
    await prisma.sictedObjective.deleteMany({ where: { tenantId } });
    // Tablas evidencia (forbid_mutation / forbid_*_delete) — requieren el
    // escape explícito para limpiar datos de prueba desechables.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.sictedSupplierIncident.deleteMany({ where: { tenantId } });
      await tx.sictedFeedback.deleteMany({ where: { tenantId } });
      await tx.sictedSatisfactionSample.deleteMany({ where: { tenantId } });
      await tx.sictedEvent.deleteMany({ where: { tenantId } });
      await tx.sictedAssessmentScore.deleteMany({ where: { tenantId } });
      await tx.sictedAssessment.deleteMany({ where: { tenantId } });
    });
    await prisma.sictedPractice.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it("agrega objetivos, eventos, legal, proveedores, formación, cliente y autoevaluación del año pedido, sin mezclar otros años", async () => {
    // Año actual real (no un literal fijo): `assessments.close()` pone
    // `closedAt` en "ahora", así que el año de prueba debe coincidir con el
    // año del reloj del sistema para que la autoevaluación quede dentro del
    // rango agregado.
    const year = new Date().getFullYear();
    const yearInside = new Date(Date.UTC(year, 5, 1));
    const yearOutside = new Date(Date.UTC(year - 1, 5, 1));

    await prisma.sictedObjective.create({
      data: { tenantId, year, title: "Objetivo del año" },
    });
    await prisma.sictedObjective.create({
      data: { tenantId, year: year - 1, title: "Objetivo del año pasado" },
    });

    await prisma.sictedEvent.create({
      data: {
        tenantId,
        kind: "GRUPO_MEJORA",
        title: "Reunión",
        eventDate: yearInside,
      },
    });
    await prisma.sictedEvent.create({
      data: {
        tenantId,
        kind: "GRUPO_MEJORA",
        title: "Reunión año pasado",
        eventDate: yearOutside,
      },
    });

    await prisma.sictedComplianceDoc.create({
      data: { tenantId, label: "Extintores", title: "Doc vigente" },
    });

    await prisma.sictedSupplierIncident.create({
      data: {
        tenantId,
        supplierId: "sup-1",
        supplierName: "Proveedor E2E",
        description: "Incidencia de prueba",
        reportedByName: "Tester",
        occurredAt: yearInside,
        resolution: "Resuelta",
        resolvedAt: yearInside,
      },
    });
    await prisma.sictedSupplierIncident.create({
      data: {
        tenantId,
        supplierId: "sup-1",
        supplierName: "Proveedor E2E",
        description: "Incidencia año pasado",
        reportedByName: "Tester",
        occurredAt: yearOutside,
      },
    });

    const plan = await prisma.sictedTrainingPlan.create({
      data: { tenantId, year },
    });
    await prisma.sictedTrainingAction.create({
      data: {
        tenantId,
        planId: plan.id,
        topic: "ALERGENOS",
        title: "Curso alérgenos",
        plannedDate: yearInside,
        done: true,
        doneAt: yearInside,
      },
    });
    await prisma.sictedTrainingAction.create({
      data: {
        tenantId,
        planId: plan.id,
        topic: "IDIOMAS",
        title: "Curso idiomas",
        plannedDate: yearInside,
        done: false,
      },
    });

    await prisma.sictedFeedback.create({
      data: {
        tenantId,
        kind: "QUEJA",
        channel: "SALA",
        receivedByName: "Tester",
        summary: "Queja de prueba",
        receivedAt: yearInside,
        status: "OPEN",
      },
    });
    await prisma.sictedFeedback.create({
      data: {
        tenantId,
        kind: "QUEJA",
        channel: "SALA",
        receivedByName: "Tester",
        summary: "Queja del año pasado",
        receivedAt: yearOutside,
        status: "OPEN",
      },
    });
    await prisma.sictedSatisfactionSample.create({
      data: {
        tenantId,
        score: 4,
        channel: "SALA",
        recordedByName: "Tester",
        sampledAt: yearInside,
      },
    });
    await prisma.sictedSatisfactionSample.create({
      data: {
        tenantId,
        score: 5,
        channel: "SALA",
        recordedByName: "Tester",
        sampledAt: yearInside,
      },
    });

    // Cerrar (no solo poner closedAt a mano): `close()` también pasa
    // status a CLOSED, que es lo que filtra la agregación. `closedAt` queda
    // en "ahora" (hoy es dentro de 2026, el año del test).
    const assessment = await assessments.create(tenantId, {
      label: `Ciclo ${year}`,
    });
    await assessments.close(tenantId, assessment.id);

    const result = await report.aggregate(tenantId, year);

    expect(result.objectives).toHaveLength(1);
    expect(result.objectives[0].title).toBe("Objetivo del año");

    expect(result.events).toEqual([{ kind: "GRUPO_MEJORA", count: 1 }]);

    expect(result.legalDocs.some((d) => d.title === "Doc vigente")).toBe(true);

    expect(result.supplierIncidents).toEqual({ count: 1, resolvedCount: 1 });

    expect(result.training).toEqual({
      plansCount: 1,
      actionsTotal: 2,
      actionsDone: 1,
    });

    expect(result.feedback.total).toBe(1);
    expect(result.satisfaction).toEqual({ samplesCount: 2, averageScore: 4.5 });

    expect(result.assessment?.label).toBe(`Ciclo ${year}`);
  });

  it("un año sin datos devuelve un informe vacío, no un error", async () => {
    const result = await report.aggregate(tenantId, 2099);
    expect(result.objectives).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.assessment).toBeNull();
    expect(result.satisfaction).toEqual({
      samplesCount: 0,
      averageScore: null,
    });
  });
});
