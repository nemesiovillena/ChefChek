import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../../src/common/services/prisma.service";
import { BunnyStorageService } from "../../src/common/bunny/bunny-storage.service";
import { SictedEventService } from "../../src/modules/sicted/services/sicted-event.service";
import { SictedComplianceDocService } from "../../src/modules/sicted/services/sicted-compliance-doc.service";

/**
 * Fase 9 SICTED (sub-PR 3) — Dirección: eventos y documentos legales. Contra
 * Postgres real: el trigger `forbid_mutation` de `sicted_events` solo se
 * dispara en la base de datos.
 */
describe("E2E - Eventos y documentos legales SICTED (fase 9, sub-PR 3)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let events: SictedEventService;
  let complianceDocs: SictedComplianceDocService;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        BunnyStorageService,
        SictedEventService,
        SictedComplianceDocService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    events = moduleRef.get(SictedEventService);
    complianceDocs = moduleRef.get(SictedComplianceDocService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Eventos/Legal E2E Tenant",
        slug: "e2e-sicted-legal",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Eventos/Legal E2E Tenant (otro)",
        slug: "e2e-sicted-legal-otro",
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
      await tx.sictedEvent.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
    });
    await prisma.sictedComplianceDoc.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe("Eventos — evidencia append-only", () => {
    it("crea un evento y lo lista ordenado por fecha desc", async () => {
      await events.create(
        tenantId,
        {
          kind: "GRUPO_MEJORA",
          title: "Reunión mensual",
          eventDate: new Date("2026-01-15"),
        },
        undefined,
      );
      await events.create(
        tenantId,
        {
          kind: "FORMACION_DESTINO",
          title: "Curso de idiomas",
          eventDate: new Date("2026-03-01"),
        },
        undefined,
      );
      const list = await events.list(tenantId);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].eventDate.getTime()).toBeGreaterThan(
        list[1].eventDate.getTime(),
      );
    });

    it("un evento no se puede modificar ni borrar (trigger forbid_mutation)", async () => {
      const event = await events.create(
        tenantId,
        {
          kind: "EVALUACION_EXTERNA",
          title: "Auditoría SICTED",
          eventDate: new Date("2026-05-01"),
        },
        undefined,
      );
      await expect(
        prisma.sictedEvent.update({
          where: { id: event.id },
          data: { title: "Editado" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.sictedEvent.delete({ where: { id: event.id } }),
      ).rejects.toThrow();
    });
  });

  describe("Documentos legales — editable, con renovación", () => {
    it("crea, edita y renovar resetea los avisos ya enviados", async () => {
      const doc = await complianceDocs.create(
        tenantId,
        {
          label: "Extintores",
          title: "Revisión anual de extintores",
          expiresAt: new Date("2026-01-01"),
        },
        undefined,
      );
      // Simula que ya se avisó de vencido.
      await prisma.sictedComplianceDoc.update({
        where: { id: doc.id },
        data: { expiredAlertedAt: new Date() },
      });

      const renewed = await complianceDocs.update(
        tenantId,
        doc.id,
        { expiresAt: new Date("2027-01-01") },
        undefined,
      );
      expect(renewed.expiresAt?.getFullYear()).toBe(2027);
      expect(renewed.expiredAlertedAt).toBeNull();
      expect(renewed.dueSoonAlertedAt).toBeNull();
    });

    it("archivar oculta el documento del listado activo", async () => {
      const doc = await complianceDocs.create(
        tenantId,
        { label: "Convenio colectivo", title: "Convenio 2026" },
        undefined,
      );
      await complianceDocs.archive(tenantId, doc.id);
      const active = await complianceDocs.list(tenantId);
      expect(active.some((d) => d.id === doc.id)).toBe(false);
      const all = await complianceDocs.list(tenantId, true);
      expect(all.some((d) => d.id === doc.id)).toBe(true);
    });
  });

  describe("Aislamiento de tenant", () => {
    it("eventos y documentos de un tenant no aparecen en otro", async () => {
      const ownEvent = await events.create(
        tenantId,
        { kind: "OTRO", title: "Evento propio", eventDate: new Date() },
        undefined,
      );
      const otherEvent = await events.create(
        otherTenantId,
        { kind: "OTRO", title: "Evento ajeno", eventDate: new Date() },
        undefined,
      );
      const myEvents = await events.list(tenantId);
      expect(myEvents.some((e) => e.id === otherEvent.id)).toBe(false);
      expect(myEvents.some((e) => e.id === ownEvent.id)).toBe(true);

      const ownDoc = await complianceDocs.create(
        tenantId,
        { label: "OTRO", title: "Doc propio" },
        undefined,
      );
      const otherDoc = await complianceDocs.create(
        otherTenantId,
        { label: "OTRO", title: "Doc ajeno" },
        undefined,
      );
      const myDocs = await complianceDocs.list(tenantId);
      expect(myDocs.some((d) => d.id === otherDoc.id)).toBe(false);
      expect(myDocs.some((d) => d.id === ownDoc.id)).toBe(true);
    });
  });
});
