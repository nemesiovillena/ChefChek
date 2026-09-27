import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedFeedbackService } from "../../src/modules/sicted/services/sicted-feedback.service";
import { SictedSatisfactionService } from "../../src/modules/sicted/services/sicted-satisfaction.service";
import { SictedLostItemService } from "../../src/modules/sicted/services/sicted-lost-item.service";

/**
 * Fase 8 SICTED — Cliente y sostenibilidad. Contra Postgres real: los
 * triggers de inalterabilidad solo se disparan en la base de datos.
 */
describe("E2E - Cliente y sostenibilidad SICTED (fase 8)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let feedback: SictedFeedbackService;
  let satisfaction: SictedSatisfactionService;
  let lostItems: SictedLostItemService;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedFeedbackService,
        SictedSatisfactionService,
        SictedLostItemService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    feedback = moduleRef.get(SictedFeedbackService);
    satisfaction = moduleRef.get(SictedSatisfactionService);
    lostItems = moduleRef.get(SictedLostItemService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Cliente E2E Tenant",
        slug: "e2e-sicted-cliente",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Cliente E2E Tenant (otro)",
        slug: "e2e-sicted-cliente-otro",
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
      await tx.sictedFeedback.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedSatisfactionSample.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedLostItem.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe("Feedback (quejas/sugerencias/felicitaciones) — hitos no reescribibles", () => {
    it("respondedAt/closedAt no se pueden reescribir una vez puestos", async () => {
      const created = await feedback.create(tenantId, {
        kind: "QUEJA",
        channel: "SALA",
        receivedByName: "Ana",
        summary: "La sopa estaba fría",
      });
      await feedback.respond(tenantId, created.id, {
        response: "Disculpas, se ha repuesto el plato",
        respondedByName: "Encargado",
      });

      await expect(
        prisma.sictedFeedback.update({
          where: { id: created.id },
          data: { respondedAt: new Date("2020-01-01") },
        }),
      ).rejects.toThrow();
    });

    it("responder dos veces a nivel de servicio es rechazado por la capa de aplicación", async () => {
      const created = await feedback.create(tenantId, {
        kind: "SUGERENCIA",
        channel: "WEB",
        receivedByName: "Bea",
        summary: "Más opciones veganas",
      });
      await feedback.respond(tenantId, created.id, {
        response: "Gracias, lo valoramos",
        respondedByName: "Encargado",
      });

      await expect(
        feedback.respond(tenantId, created.id, {
          response: "Segunda respuesta",
          respondedByName: "Encargado",
        }),
      ).rejects.toThrow(/Ya tiene respuesta/);
    });

    it("tiempo de respuesta: una queja sin respuesta que supera el umbral aparece en overdue()", async () => {
      const created = await feedback.create(tenantId, {
        kind: "QUEJA",
        channel: "TELEFONO",
        receivedByName: "Carla",
        summary: "Reserva perdida",
      });
      // Retrasar receivedAt manualmente para simular una queja de hace 4 días (> 72h por defecto).
      await prisma.sictedFeedback.update({
        where: { id: created.id },
        data: { receivedAt: new Date(Date.now() - 4 * 24 * 3_600_000) },
      });

      const report = await feedback.overdue(tenantId);
      expect(report.slaHours).toBe(72);
      expect(report.items.some((i) => i.id === created.id)).toBe(true);
    });

    it("una queja respondida dentro del umbral no aparece en overdue()", async () => {
      const created = await feedback.create(tenantId, {
        kind: "QUEJA",
        channel: "SALA",
        receivedByName: "Dani",
        summary: "Mesa sucia",
      });
      await feedback.respond(tenantId, created.id, {
        response: "Se limpió al momento",
        respondedByName: "Encargado",
      });

      const report = await feedback.overdue(tenantId);
      expect(report.items.some((i) => i.id === created.id)).toBe(false);
    });
  });

  describe("Satisfacción — append-only, resumen mensual", () => {
    it("una muestra registrada no se puede reescribir", async () => {
      const created = await satisfaction.create(tenantId, {
        score: 5,
        channel: "SALA",
        recordedByName: "Elena",
      });
      await expect(
        prisma.sictedSatisfactionSample.update({
          where: { id: created.id },
          data: { score: 1 },
        }),
      ).rejects.toThrow();
    });

    it("el resumen mensual calcula la media y la tendencia contra el mes anterior", async () => {
      // Mayo 2027 (mes anterior): media 3.
      const may = await satisfaction.create(tenantId, {
        score: 3,
        channel: "SALA",
        recordedByName: "F",
      });
      // Junio 2027: media 5.
      const june = await satisfaction.create(tenantId, {
        score: 5,
        channel: "SALA",
        recordedByName: "G",
      });
      // `sampledAt` es append-only (trigger `forbid_mutation`); retrasarlo
      // para el fixture necesita el mismo escape controlado que usa el
      // restore de tenant, no un UPDATE normal.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
        );
        await tx.sictedSatisfactionSample.update({
          where: { id: may.id },
          data: { sampledAt: new Date("2027-05-15T10:00:00Z") },
        });
        await tx.sictedSatisfactionSample.update({
          where: { id: june.id },
          data: { sampledAt: new Date("2027-06-15T10:00:00Z") },
        });
      });

      const summary = await satisfaction.monthlySummary(tenantId, 2027, 6);
      expect(summary.sampleCount).toBe(1);
      expect(summary.averageScore).toBe(5);
      expect(summary.previousAverageScore).toBe(3);
      expect(summary.trend).toBe("up");
    });
  });

  describe("Objetos perdidos — append-only con hito", () => {
    it("returnedAt/returnedTo no se pueden reescribir una vez puestos", async () => {
      const created = await lostItems.create(tenantId, {
        itemName: "Bufanda azul",
        foundByName: "Hugo",
      });
      await lostItems.markReturned(tenantId, created.id, {
        returnedTo: "Cliente mesa 4",
      });

      await expect(
        prisma.sictedLostItem.update({
          where: { id: created.id },
          data: { returnedTo: "Otro nombre" },
        }),
      ).rejects.toThrow();
    });

    it("marcar devuelto dos veces es rechazado por la capa de aplicación", async () => {
      const created = await lostItems.create(tenantId, {
        itemName: "Gafas de sol",
        foundByName: "Irene",
      });
      await lostItems.markReturned(tenantId, created.id, {
        returnedTo: "Cliente",
      });

      await expect(
        lostItems.markReturned(tenantId, created.id, { returnedTo: "Otro" }),
      ).rejects.toThrow(/Ya estaba marcado/);
    });
  });

  describe("Aislamiento de tenant", () => {
    it("feedback/satisfacción/objetos perdidos de un tenant no aparecen en otro", async () => {
      await feedback.create(otherTenantId, {
        kind: "QUEJA",
        channel: "SALA",
        receivedByName: "Ajeno",
        summary: "Queja de otro tenant",
      });
      await satisfaction.create(otherTenantId, {
        score: 1,
        channel: "SALA",
        recordedByName: "Ajeno",
      });
      await lostItems.create(otherTenantId, {
        itemName: "Objeto ajeno",
        foundByName: "Ajeno",
      });

      const [feedbackList, satisfactionList, lostList] = await Promise.all([
        feedback.list(tenantId),
        satisfaction.list(tenantId),
        lostItems.list(tenantId),
      ]);
      expect(feedbackList.every((f) => f.tenantId === tenantId)).toBe(true);
      expect(satisfactionList.every((s) => s.tenantId === tenantId)).toBe(true);
      expect(lostList.every((l) => l.tenantId === tenantId)).toBe(true);
    });
  });
});
