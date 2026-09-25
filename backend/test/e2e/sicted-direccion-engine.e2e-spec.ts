import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedPracticeCatalogService } from "../../src/modules/sicted/services/sicted-practice-catalog.service";
import { SictedAssessmentService } from "../../src/modules/sicted/services/sicted-assessment.service";
import { SICTED_PRACTICE_CATALOG_SEED } from "../../src/modules/sicted/constants/sicted-practice-catalog-seed";

/**
 * Fase 9 SICTED (sub-PR 1) — Dirección: catálogo de buenas prácticas y
 * autoevaluación. Contra Postgres real: el trigger de inalterabilidad
 * condicional (`forbid_score_update_if_assessment_closed`) solo se dispara
 * en la base de datos.
 */
describe("E2E - Dirección SICTED (fase 9, catálogo y autoevaluación)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let catalog: SictedPracticeCatalogService;
  let assessments: SictedAssessmentService;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedPracticeCatalogService,
        SictedAssessmentService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    catalog = moduleRef.get(SictedPracticeCatalogService);
    assessments = moduleRef.get(SictedAssessmentService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Dirección E2E Tenant",
        slug: "e2e-sicted-direccion",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Dirección E2E Tenant (otro)",
        slug: "e2e-sicted-direccion-otro",
        isActive: true,
      },
    });
    otherTenantId = otherTenant.id;
  });

  afterAll(async () => {
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

  describe("Catálogo — siembra idempotente", () => {
    it("siembra las 144 prácticas reales del manual; reimportar no duplica", async () => {
      const first = await catalog.seedCatalog(tenantId);
      expect(first).toHaveLength(SICTED_PRACTICE_CATALOG_SEED.length);
      expect(first.length).toBe(144);

      const second = await catalog.seedCatalog(tenantId);
      expect(second).toHaveLength(144);

      const count = await prisma.sictedPractice.count({ where: { tenantId } });
      expect(count).toBe(144);
    });

    it("reimportar respeta ediciones del tenant (no pisa un título ya editado)", async () => {
      const practices = await catalog.list(tenantId);
      const target = practices.find((p) => p.code === "1.1");
      await catalog.update(tenantId, target!.id, {
        title: "Título editado por el tenant",
      });

      await catalog.seedCatalog(tenantId);

      const reloaded = await catalog.getOneVisible(tenantId, target!.id);
      expect(reloaded.title).toBe("Título editado por el tenant");
    });
  });

  describe("Escala — rechaza valores fuera de {1,2,3,4,5}", () => {
    it("acepta 1-5 y notApplicable como alternativa, no como valor de score", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo test escala",
      });
      const practice = (await catalog.list(tenantId))[0];

      const withScore = await assessments.upsertScore(
        tenantId,
        assessment.id,
        practice.id,
        { score: 4 },
      );
      expect(withScore.score).toBe(4);
      expect(withScore.notApplicable).toBe(false);

      const na = await assessments.upsertScore(
        tenantId,
        assessment.id,
        practice.id,
        { notApplicable: true },
      );
      expect(na.score).toBeNull();
      expect(na.notApplicable).toBe(true);
    });
  });

  describe("Cierre de autoevaluación — inmutable", () => {
    it("una puntuación no se puede modificar tras cerrar el ciclo (trigger condicional)", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo a cerrar",
      });
      const practice = (await catalog.list(tenantId))[1];
      const score = await assessments.upsertScore(
        tenantId,
        assessment.id,
        practice.id,
        { score: 5 },
      );

      await assessments.close(tenantId, assessment.id);

      await expect(
        prisma.sictedAssessmentScore.update({
          where: { id: score.id },
          data: { score: 1 },
        }),
      ).rejects.toThrow(/cerrada/);
    });

    it("upsertScore rechaza a nivel de aplicación tocar una autoevaluación cerrada", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo cerrado 2",
      });
      await assessments.close(tenantId, assessment.id);
      const practice = (await catalog.list(tenantId))[2];

      await expect(
        assessments.upsertScore(tenantId, assessment.id, practice.id, {
          score: 3,
        }),
      ).rejects.toThrow(/cerrada/);
    });

    it("cerrar dos veces es rechazado", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo doble cierre",
      });
      await assessments.close(tenantId, assessment.id);
      await expect(assessments.close(tenantId, assessment.id)).rejects.toThrow(
        /Ya está cerrada/,
      );
    });
  });

  describe("Obligatorias sin evidencia y <3", () => {
    it("una obligatoria sin puntuar y otra con puntuación 1 aparecen en pendingMandatory; una con 4 no", async () => {
      const assessment = await assessments.create(tenantId, {
        label: "Ciclo cobertura",
      });
      const mandatoryPractices = (await catalog.list(tenantId)).filter(
        (p) => p.isMandatory,
      );
      const [low, high] = mandatoryPractices;

      await assessments.upsertScore(tenantId, assessment.id, low.id, {
        score: 1,
      });
      await assessments.upsertScore(tenantId, assessment.id, high.id, {
        score: 4,
      });

      const pending = await assessments.pendingMandatory(
        tenantId,
        assessment.id,
      );
      const pendingIds = pending.map((p) => p.practice.id);
      expect(pendingIds).toContain(low.id);
      expect(pendingIds).not.toContain(high.id);
      // Al menos una obligatoria sin puntuar en absoluto también debe aparecer.
      const unscored = mandatoryPractices.find(
        (p) => p.id !== low.id && p.id !== high.id,
      );
      expect(pendingIds).toContain(unscored!.id);
    });
  });

  describe("Aislamiento de tenant", () => {
    it("el catálogo y las autoevaluaciones de un tenant no aparecen en otro", async () => {
      await catalog.seedCatalog(otherTenantId);
      const otherAssessment = await assessments.create(otherTenantId, {
        label: "Ajeno",
      });

      const myPractices = await catalog.list(tenantId);
      const myAssessments = await assessments.list(tenantId);
      expect(myPractices.every((p) => p.tenantId === tenantId)).toBe(true);
      expect(myAssessments.some((a) => a.id === otherAssessment.id)).toBe(
        false,
      );
    });
  });
});
