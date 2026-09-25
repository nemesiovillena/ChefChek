import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../src/common/services/prisma.service";
import { BunnyStorageService } from "../../src/common/bunny/bunny-storage.service";
import { ChecklistAssetService } from "../../src/modules/checklists/services/checklist-asset.service";
import { ChecklistMaintenanceService } from "../../src/modules/checklists/services/checklist-maintenance.service";
import { ChecklistIncidentService } from "../../src/modules/checklists/services/checklist-incident.service";
import { CHECKLIST_STARTER_ASSETS } from "../../src/modules/checklists/constants/checklist-starter-assets.constant";

/**
 * Fase 4 SICTED — motor de mantenimiento: equipos/planes/registros (append-
 * only), partes de avería/PAC (hitos null→valor), correlativo, filtro
 * `usedByModules`. Contra Postgres real (`chefchek_test`): la inalterabilidad
 * y el trigger de hitos son comportamiento de BD, no vale la pena simularlos.
 */
describe("E2E - Motor de mantenimiento compartido (fase 4)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let assets: ChecklistAssetService;
  let maintenance: ChecklistMaintenanceService;
  let incidents: ChecklistIncidentService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        BunnyStorageService,
        ChecklistAssetService,
        ChecklistMaintenanceService,
        ChecklistIncidentService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    assets = moduleRef.get(ChecklistAssetService);
    maintenance = moduleRef.get(ChecklistMaintenanceService);
    incidents = moduleRef.get(ChecklistIncidentService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Maintenance Engine E2E Tenant",
        slug: "e2e-maintenance-engine",
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
      await tx.checklistIncident.deleteMany({ where: { tenantId } });
      await tx.checklistMaintenanceRecord.deleteMany({ where: { tenantId } });
      await tx.checklistMaintenancePlan.deleteMany({ where: { tenantId } });
      await tx.checklistAsset.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe("usedByModules: filtro y siembra compartida", () => {
    it("un equipo creado por sicted no es visible para appcc", async () => {
      const created = await assets.create(tenantId, "sicted", {
        name: "Cámara de frío 1",
        category: "FRIO",
      });
      expect(created.usedByModules).toEqual(["sicted"]);
      await expect(
        assets.getOneVisible(tenantId, "appcc", created.id),
      ).rejects.toThrow("no encontrado");
    });

    it("seedStarterAsset crea el equipo BP5.10.1 + su plan trimestral, idempotente", async () => {
      const starter = CHECKLIST_STARTER_ASSETS[0];
      const first = await assets.seedStarterAsset(tenantId, "sicted", starter);
      const second = await assets.seedStarterAsset(tenantId, "sicted", starter);
      expect(second.id).toBe(first.id);

      const plans = await prisma.checklistMaintenancePlan.findMany({
        where: { tenantId, assetId: first.id },
      });
      expect(plans).toHaveLength(1); // no duplica el plan al re-sembrar
      expect(plans[0].periodicityMonths).toBe(3);
    });

    it("seedStarterAsset con otro módulo añade el módulo en vez de duplicar la fila", async () => {
      const starter = CHECKLIST_STARTER_ASSETS[0];
      const forAppcc = await assets.seedStarterAsset(
        tenantId,
        "appcc",
        starter,
      );
      const count = await prisma.checklistAsset.count({
        where: { tenantId, externalCode: starter.asset.externalCode },
      });
      expect(count).toBe(1);
      expect(forAppcc.usedByModules.sort()).toEqual(["appcc", "sicted"]);
    });
  });

  describe("planes y registros: nextDueAt/lastDoneAt, evidencia append-only", () => {
    it("crear plan sin nextDueAt lo calcula a periodicityMonths desde hoy", async () => {
      const asset = await assets.create(tenantId, "sicted", {
        name: "Extractor cocina",
        category: "COCINA",
      });
      const before = new Date();
      const plan = await maintenance.createPlan(tenantId, "sicted", {
        assetId: asset.id,
        title: "Limpieza de filtros",
        periodicityMonths: 6,
      });
      const expectedMonth = (before.getUTCMonth() + 6) % 12;
      expect(plan.nextDueAt.getUTCMonth()).toBe(expectedMonth);
    });

    it("registrar una revisión actualiza lastDoneAt/nextDueAt del plan y resetea el dedup de avisos", async () => {
      const asset = await assets.create(tenantId, "sicted", {
        name: "Cámara de frío 2",
        category: "FRIO",
      });
      const plan = await maintenance.createPlan(tenantId, "sicted", {
        assetId: asset.id,
        title: "Revisión motor",
        periodicityMonths: 12,
      });
      await prisma.checklistMaintenancePlan.update({
        where: { id: plan.id },
        data: { dueSoonAlertedAt: new Date(), overdueAlertedAt: new Date() },
      });

      const performedAt = new Date("2026-03-15T10:00:00Z");
      await maintenance.createRecord(
        tenantId,
        "sicted",
        plan.id,
        "user-1",
        { performedByName: "Técnico Ana", performedAt },
        [],
      );

      const updated = await prisma.checklistMaintenancePlan.findUniqueOrThrow({
        where: { id: plan.id },
      });
      expect(updated.lastDoneAt?.toISOString()).toBe(performedAt.toISOString());
      expect(updated.nextDueAt.toISOString()).toBe("2027-03-15T10:00:00.000Z");
      expect(updated.dueSoonAlertedAt).toBeNull();
      expect(updated.overdueAlertedAt).toBeNull();
    });

    it("el registro (evidencia) no se puede editar ni borrar vía SQL directo", async () => {
      const asset = await assets.create(tenantId, "sicted", {
        name: "Extintor pasillo",
        category: "EXTINTORES",
      });
      const plan = await maintenance.createPlan(tenantId, "sicted", {
        assetId: asset.id,
        title: "Revisión anual",
        periodicityMonths: 12,
      });
      const record = await maintenance.createRecord(
        tenantId,
        "sicted",
        plan.id,
        "user-1",
        { performedByName: "Empresa externa", performedAt: new Date() },
        [],
      );

      await expect(
        prisma.checklistMaintenanceRecord.update({
          where: { id: record.id },
          data: { notes: "editado" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.checklistMaintenanceRecord.delete({ where: { id: record.id } }),
      ).rejects.toThrow();
    });
  });

  describe("incidencias: BREAKDOWN vs CORRECTIVE_ACTION, correlativo, hitos", () => {
    it("BREAKDOWN no exige deviationDescription; CORRECTIVE_ACTION sí", async () => {
      const breakdown = await incidents.create(tenantId, "sicted", {
        kind: "BREAKDOWN",
        detectedByName: "Ana",
        faultType: "No calienta",
      } as any);
      expect(breakdown.partNumber).toBeNull();

      await expect(
        incidents.create(tenantId, "sicted", {
          kind: "CORRECTIVE_ACTION",
          detectedByName: "Ana",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("CORRECTIVE_ACTION asigna partNumber correlativo por tenant", async () => {
      const first = await incidents.create(tenantId, "sicted", {
        kind: "CORRECTIVE_ACTION",
        detectedByName: "Bea",
        deviationDescription: "Temperatura fuera de rango",
      } as any);
      const second = await incidents.create(tenantId, "sicted", {
        kind: "CORRECTIVE_ACTION",
        detectedByName: "Bea",
        deviationDescription: "Otra desviación",
      } as any);
      expect(second.partNumber).toBe((first.partNumber ?? 0) + 1);
    });

    it("un hito (technicianNotifiedAt) se puede poner una vez, no reescribir", async () => {
      const incident = await incidents.create(tenantId, "sicted", {
        kind: "BREAKDOWN",
        detectedByName: "Ana",
        faultType: "Lavavajillas no calienta",
      } as any);

      const notified = await incidents.update(tenantId, "sicted", incident.id, {
        technicianNotifiedAt: new Date("2026-06-01T09:00:00Z"),
      } as any);
      expect(notified.technicianNotifiedAt).not.toBeNull();

      await expect(
        incidents.update(tenantId, "sicted", incident.id, {
          technicianNotifiedAt: new Date("2026-06-01T15:00:00Z"),
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("no se puede borrar una incidencia vía SQL directo", async () => {
      const incident = await incidents.create(tenantId, "sicted", {
        kind: "BREAKDOWN",
        detectedByName: "Ana",
      } as any);
      await expect(
        prisma.checklistIncident.delete({ where: { id: incident.id } }),
      ).rejects.toThrow();
    });

    it("deadline SÍ se puede reescribir (decisión de diseño: no es un hito histórico)", async () => {
      const incident = await incidents.create(tenantId, "sicted", {
        kind: "CORRECTIVE_ACTION",
        detectedByName: "Ana",
        deviationDescription: "Desviación de prueba",
        deadline: new Date("2026-07-01T00:00:00Z"),
      } as any);
      const updated = await incidents.update(tenantId, "sicted", incident.id, {
        deadline: new Date("2026-07-15T00:00:00Z"),
      } as any);
      expect(updated.deadline?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    });
  });

  describe("aislamiento por tenant", () => {
    it("un tenant B no ve el equipo/incidencia del tenant A", async () => {
      const tenantB = await prisma.tenant.create({
        data: {
          name: "Tenant B E2E Maintenance",
          slug: "e2e-maintenance-tenant-b",
          isActive: true,
        },
      });
      try {
        const asset = await assets.create(tenantId, "sicted", {
          name: "Solo tenant A",
          category: "OTRO",
        });
        await expect(
          assets.getOneVisible(tenantB.id, "sicted", asset.id),
        ).rejects.toThrow("no encontrado");

        const incident = await incidents.create(tenantId, "sicted", {
          kind: "BREAKDOWN",
          detectedByName: "Ana",
        } as any);
        await expect(
          incidents.getOneVisible(tenantB.id, "sicted", incident.id),
        ).rejects.toThrow("no encontrada");
      } finally {
        await prisma.tenant.delete({ where: { id: tenantB.id } });
      }
    });
  });
});
