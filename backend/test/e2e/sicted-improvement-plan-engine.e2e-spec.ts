import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedPracticeCatalogService } from "../../src/modules/sicted/services/sicted-practice-catalog.service";
import { SictedAssessmentService } from "../../src/modules/sicted/services/sicted-assessment.service";
import { SictedImprovementActionService } from "../../src/modules/sicted/services/sicted-improvement-action.service";
import { SictedObjectiveService } from "../../src/modules/sicted/services/sicted-objective.service";

/**
 * Fase 9 SICTED (sub-PR 2) — Dirección: plan de mejora y objetivos anuales.
 * Contra Postgres real: el trigger `forbid_milestone_rewrite('closedAt')`
 * solo se dispara en la base de datos.
 */
describe("E2E - Plan de mejora y objetivos SICTED (fase 9, sub-PR 2)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let catalog: SictedPracticeCatalogService;
  let assessments: SictedAssessmentService;
  let actions: SictedImprovementActionService;
  let objectives: SictedObjectiveService;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedPracticeCatalogService,
        SictedAssessmentService,
        SictedImprovementActionService,
        SictedObjectiveService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    catalog = moduleRef.get(SictedPracticeCatalogService);
    assessments = moduleRef.get(SictedAssessmentService);
    actions = moduleRef.get(SictedImprovementActionService);
    objectives = moduleRef.get(SictedObjectiveService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Plan de mejora E2E Tenant",
        slug: "e2e-sicted-mejora",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Plan de mejora E2E Tenant (otro)",
        slug: "e2e-sicted-mejora-otro",
        isActive: true,
      },
    });
    otherTenantId = otherTenant.id;

    await catalog.seedCatalog(tenantId);
  });

  afterAll(async () => {
    await prisma.sictedImprovementAction.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.sictedObjective.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.sictedAssessmentScore.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedAssessment.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
    });
    await prisma.sictedPractice.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe("Acciones de mejora — correlativo y edición", () => {
    it("el código es correlativo por tenant (MAX+1)", async () => {
      const a1 = await actions.create(tenantId, {
        origin: "OTHER",
        title: "Primera acción",
      });
      const a2 = await actions.create(tenantId, {
        origin: "OTHER",
        title: "Segunda acción",
      });
      expect(a2.code).toBe(a1.code + 1);
    });

    it("una acción se puede editar (no es append-only puro)", async () => {
      const action = await actions.create(tenantId, {
        origin: "INCIDENT",
        title: "Aspecto crítico detectado",
      });
      const updated = await actions.update(tenantId, action.id, {
        action: "Solución propuesta",
        responsibleName: "Encargado de sala",
        status: "OPEN",
      });
      expect(updated.action).toBe("Solución propuesta");
      expect(updated.responsibleName).toBe("Encargado de sala");
    });
  });

  describe("closedAt — hito solo null→valor", () => {
    it("registrar la fecha de implantación una vez es aceptado; una segunda vez es rechazado", async () => {
      const action = await actions.create(tenantId, {
        origin: "OTHER",
        title: "Acción a cerrar",
      });
      const closedAt = new Date();
      const closed = await actions.update(tenantId, action.id, {
        status: "DONE",
        closedAt,
      });
      expect(closed.closedAt).toEqual(closedAt);

      await expect(
        actions.update(tenantId, action.id, { closedAt: new Date() }),
      ).rejects.toThrow(/no puede reescribirse/);
    });
  });

  describe("Generación desde autoevaluación", () => {
    it("genera una acción por cada obligatoria pendiente; reintentar no duplica", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo para plan de mejora",
      });
      const mandatoryPractices = (await catalog.list(tenantId)).filter(
        (p) => p.isMandatory,
      );
      // Deja 2 obligatorias sin puntuar y una con puntuación baja a propósito.
      await assessments.upsertScore(
        tenantId,
        assessment.id,
        mandatoryPractices[0].id,
        { score: 1 },
      );

      const generated = await actions.generateFromAssessment(
        tenantId,
        assessment.id,
      );
      expect(generated.length).toBeGreaterThan(0);
      expect(
        generated.every(
          (a) => a.origin === "ASSESSMENT" && a.sourceRef === assessment.id,
        ),
      ).toBe(true);

      // Reintentar sobre la misma evaluación no duplica las ya generadas.
      const regenerated = await actions.generateFromAssessment(
        tenantId,
        assessment.id,
      );
      expect(regenerated.length).toBe(0);
    });
  });

  describe("Objetivos anuales", () => {
    it("crea, lista filtrando por año y actualiza estado/progreso", async () => {
      await objectives.create(tenantId, {
        year: 2026,
        title: "Reducir quejas de sala",
        indicator: "Nº de quejas/mes",
        target: "< 2",
      });
      await objectives.create(tenantId, {
        year: 2025,
        title: "Objetivo del año pasado",
      });

      const of2026 = await objectives.list(tenantId, 2026);
      expect(of2026).toHaveLength(1);
      expect(of2026[0].title).toBe("Reducir quejas de sala");

      const updated = await objectives.update(tenantId, of2026[0].id, {
        currentValue: "1",
        status: "ACHIEVED",
      });
      expect(updated.currentValue).toBe("1");
      expect(updated.status).toBe("ACHIEVED");
    });
  });

  describe("Aislamiento de tenant", () => {
    it("acciones y objetivos de un tenant no aparecen en otro", async () => {
      const ownAction = await actions.create(tenantId, {
        origin: "OTHER",
        title: "Acción propia",
      });
      const otherAction = await actions.create(otherTenantId, {
        origin: "OTHER",
        title: "Acción ajena",
      });
      const myActions = await actions.list(tenantId);
      expect(myActions.some((a) => a.id === otherAction.id)).toBe(false);
      expect(myActions.some((a) => a.id === ownAction.id)).toBe(true);

      const ownObjective = await objectives.create(tenantId, {
        year: 2026,
        title: "Objetivo propio",
      });
      const otherObjective = await objectives.create(otherTenantId, {
        year: 2026,
        title: "Objetivo ajeno",
      });
      const myObjectives = await objectives.list(tenantId, 2026);
      expect(myObjectives.some((o) => o.id === otherObjective.id)).toBe(false);
      expect(myObjectives.some((o) => o.id === ownObjective.id)).toBe(true);
    });
  });
});
