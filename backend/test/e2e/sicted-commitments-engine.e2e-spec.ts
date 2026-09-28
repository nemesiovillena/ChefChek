import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedSettingsService } from "../../src/modules/sicted/services/sicted-settings.service";
import { SictedCommitmentsService } from "../../src/modules/sicted/services/sicted-commitments.service";

/**
 * Panel de compromisos por fase: comprueba contra Postgres real que cada
 * compromiso cuenta solo lo registrado dentro de su ventana (fase, 12 meses
 * previos al comité para formación, 6 meses para la evaluación externa).
 */
describe("E2E - Compromisos SICTED por fase", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let settings: SictedSettingsService;
  let commitments: SictedCommitmentsService;
  let tenantId: string;

  const now = new Date("2026-10-01T10:00:00Z");
  const committee = new Date("2026-11-20T10:00:00Z");
  const phaseStart = new Date("2026-01-15T00:00:00Z");

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedSettingsService,
        SictedCommitmentsService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    settings = moduleRef.get(SictedSettingsService);
    commitments = moduleRef.get(SictedCommitmentsService);
    const tenant = await prisma.tenant.create({
      data: {
        name: "Compromisos E2E",
        slug: "e2e-sicted-compromisos",
        isActive: true,
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.sictedEvent.deleteMany({ where: { tenantId } });
      await tx.sictedTrainingAction.deleteMany({ where: { tenantId } });
      await tx.sictedTrainingPlan.deleteMany({ where: { tenantId } });
      await tx.sictedImprovementAction.deleteMany({ where: { tenantId } });
    });
    await prisma.sictedSettings.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it("sin fase configurada no devuelve compromisos", async () => {
    const r = await commitments.get(tenantId, now);
    expect(r.phase).toBeNull();
    expect(r.items).toHaveLength(0);
  });

  it("en Distinción cuenta solo ATI de la fase y la evaluación externa de los 6 meses previos al comité", async () => {
    await settings.updateCycle(tenantId, {
      cyclePhase: "DISTINCION",
      phaseStartedAt: phaseStart,
      nextCommitteeDate: committee,
    });
    const mk = (kind: string, eventDate: Date) =>
      prisma.sictedEvent.create({
        data: { tenantId, kind, title: kind, eventDate },
      });
    await mk("ATI", new Date("2025-12-01T10:00:00Z")); // antes de la fase: no cuenta
    await mk("ATI", new Date("2026-02-01T10:00:00Z"));
    await mk("ATI", new Date("2026-04-01T10:00:00Z"));
    await mk("ATI", new Date("2026-06-01T10:00:00Z"));
    await mk("EVALUACION_EXTERNA", new Date("2026-03-01T10:00:00Z")); // > 6 meses antes: no cuenta

    let r = await commitments.get(tenantId, now);
    const byKey = () => Object.fromEntries(r.items.map((i) => [i.key, i]));
    expect(byKey().ATI.status).toBe("DONE");
    expect(byKey().ATI.detail).toContain("3 de 3");
    expect(byKey().EVALUACION_EXTERNA.status).toBe("PENDING");
    expect(r.daysToCommittee).toBe(50);

    await mk("EVALUACION_EXTERNA", new Date("2026-09-15T10:00:00Z"));
    r = await commitments.get(tenantId, now);
    expect(byKey().EVALUACION_EXTERNA.status).toBe("DONE");
  });

  it("en Seguimiento suma horas de formación hechas en los 12 meses previos al comité", async () => {
    await settings.updateCycle(tenantId, { cyclePhase: "SEGUIMIENTO_1" });
    const plan = await prisma.sictedTrainingPlan.create({
      data: { tenantId, year: 2026 },
    });
    const action = (hours: number, doneAt: Date) =>
      prisma.sictedTrainingAction.create({
        data: {
          tenantId,
          planId: plan.id,
          topic: "OTRO",
          title: `Curso ${hours} h`,
          plannedDate: doneAt,
          hours,
          done: true,
          doneAt,
        },
      });
    await action(10, new Date("2025-09-01T10:00:00Z")); // > 12 meses antes del comité
    await action(3, new Date("2026-05-01T10:00:00Z"));

    let r = await commitments.get(tenantId, now);
    let formacion = r.items.find((i) => i.key === "FORMACION")!;
    expect(formacion.status).toBe("IN_PROGRESS");
    expect(formacion.detail).toContain("3 h de 4 h");

    await action(1, new Date("2026-08-01T10:00:00Z"));
    r = await commitments.get(tenantId, now);
    formacion = r.items.find((i) => i.key === "FORMACION")!;
    expect(formacion.status).toBe("DONE");
  });
});
