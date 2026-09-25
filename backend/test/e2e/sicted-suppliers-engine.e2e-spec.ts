import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { SictedSupplierComplianceService } from "../../src/modules/sicted/services/sicted-supplier-compliance.service";
import { SictedSupplierIncidentService } from "../../src/modules/sicted/services/sicted-supplier-incident.service";
import { SictedInventorySnapshotService } from "../../src/modules/sicted/services/sicted-inventory-snapshot.service";
import { SictedProcurementEvidenceService } from "../../src/modules/sicted/services/sicted-procurement-evidence.service";

/**
 * Fase 6 SICTED — proveedores y aprovisionamiento. Contra Postgres real: los
 * triggers de inalterabilidad (`forbid_mutation`, `forbid_milestone_rewrite`)
 * solo se disparan en la base de datos, no en un mock.
 */
describe("E2E - Proveedores y aprovisionamiento SICTED (fase 6)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let compliance: SictedSupplierComplianceService;
  let incidents: SictedSupplierIncidentService;
  let inventory: SictedInventorySnapshotService;
  let evidence: SictedProcurementEvidenceService;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SictedSupplierComplianceService,
        SictedSupplierIncidentService,
        SictedInventorySnapshotService,
        SictedProcurementEvidenceService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    compliance = moduleRef.get(SictedSupplierComplianceService);
    incidents = moduleRef.get(SictedSupplierIncidentService);
    inventory = moduleRef.get(SictedInventorySnapshotService);
    evidence = moduleRef.get(SictedProcurementEvidenceService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Suppliers E2E Tenant",
        slug: "e2e-sicted-suppliers",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Suppliers E2E Tenant (otro)",
        slug: "e2e-sicted-suppliers-otro",
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
      await tx.sictedSupplierComplianceProfile.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedSupplierIncident.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await tx.sictedInventorySnapshot.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
    });
    await prisma.foodLabel.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.lot.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.albaranLine.deleteMany({
      where: { albaran: { tenantId: { in: [tenantId, otherTenantId] } } },
    });
    await prisma.albaran.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.stock.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.product.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.supplier.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  async function createSupplier(tid: string, name: string) {
    return prisma.supplier.create({ data: { tenantId: tid, name } });
  }

  async function createProduct(tid: string, name: string) {
    return prisma.product.create({
      data: {
        tenantId: tid,
        name,
        purchasePrice: 1,
        netPrice: 1,
        allergens: [],
      },
    });
  }

  describe("Perfil de cumplimiento (PROV.1) — upsert, no append-only", () => {
    it("upsert es idempotente: la segunda llamada actualiza el mismo registro, no crea otro", async () => {
      const supplier = await createSupplier(tenantId, "Proveedor cumplimiento");
      const first = await compliance.upsert(tenantId, supplier.id, "Ana", {
        hasSafetyDataSheets: "YES",
      });
      const second = await compliance.upsert(tenantId, supplier.id, "Bea", {
        hasSafetyDataSheets: "NO",
        qualityCertification: "ISO 22000",
      });
      expect(second.id).toBe(first.id);
      expect(second.hasSafetyDataSheets).toBe("NO");
      expect(second.updatedByName).toBe("Bea");

      const count = await prisma.sictedSupplierComplianceProfile.count({
        where: { tenantId, supplierId: supplier.id },
      });
      expect(count).toBe(1);
    });
  });

  describe("Incidencias de recepción (PROV.3) — append-only", () => {
    it("resolution no es reescribible una vez puesta", async () => {
      const supplier = await createSupplier(tenantId, "Proveedor incidencia");
      const created = await incidents.create(tenantId, {
        supplierId: supplier.id,
        description: "Transporte sin frío",
        reportedByName: "Carla",
      });
      await incidents.resolve(tenantId, created.id, {
        resolution: "Sustituido el lote",
      });

      await expect(
        incidents.resolve(tenantId, created.id, {
          resolution: "Segundo intento",
        }),
      ).rejects.toThrow(/no puede reescribirse/);
    });

    it("el nombre del proveedor queda como snapshot y sobrevive a su archivado", async () => {
      const supplier = await createSupplier(tenantId, "Proveedor a archivar");
      const created = await incidents.create(tenantId, {
        supplierId: supplier.id,
        description: "Caja aplastada",
        reportedByName: "Dani",
      });
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { deletedAt: new Date(), isActive: false },
      });

      const reloaded = await incidents.getOneVisible(tenantId, created.id);
      expect(reloaded.supplierName).toBe("Proveedor a archivar");
    });

    it("un albaranId de otro tenant es rechazado", async () => {
      const supplier = await createSupplier(
        tenantId,
        "Proveedor albarán ajeno",
      );
      const foreignAlbaran = await prisma.albaran.create({
        data: { tenantId: otherTenantId, internalNumber: "OTRO-1" },
      });

      await expect(
        incidents.create(tenantId, {
          supplierId: supplier.id,
          albaranId: foreignAlbaran.id,
          description: "Con albarán de otro tenant",
          reportedByName: "Elena",
        }),
      ).rejects.toThrow(/Albarán no encontrado/);
    });
  });

  describe("Inventario semestral (PROV.7) — foto+firma de Stock", () => {
    it("el snapshot refleja el Stock del momento y no se recalcula si Stock cambia después", async () => {
      const product = await createProduct(tenantId, "Artículo inventariado");
      const stock = await prisma.stock.create({
        data: {
          tenantId,
          productId: product.id,
          quantity: 2,
          minimumStock: 5, // por debajo del mínimo en el momento del snapshot
          maximumStock: 20,
        },
      });

      const snapshot = await inventory.generate(tenantId, {
        performedByName: "Fran",
      });
      expect(snapshot.belowMinimumCount).toBe(1);
      expect(snapshot.aboveMaximumCount).toBe(0);

      // Stock cambia DESPUÉS de generado el snapshot: ya no está bajo mínimo.
      await prisma.stock.update({
        where: { id: stock.id },
        data: { quantity: 50 },
      });

      const reloaded = await inventory.getOne(tenantId, snapshot.id);
      expect(reloaded?.belowMinimumCount).toBe(1); // congelado, no recalculado
      const lines = reloaded?.snapshotData as unknown as { quantity: number }[];
      expect(lines[0].quantity).toBe(2); // la cantidad congelada, no la actual (50)
    });

    it("el snapshot es append-only: no se puede modificar tras crearse", async () => {
      const snapshot = await inventory.generate(tenantId, {
        performedByName: "Gonzalo",
        scope: "Cámara fría",
      });
      await expect(
        prisma.sictedInventorySnapshot.update({
          where: { id: snapshot.id },
          data: { notes: "intento de reescritura" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Evidencia de aprovisionamiento — agregados de solo lectura", () => {
    it("los agregados coinciden con una consulta manual sobre los fixtures, con aislamiento por tenant", async () => {
      const supplier = await createSupplier(tenantId, "Proveedor evidencia");
      const product = await createProduct(tenantId, "Artículo evidencia");

      const albaranConLote = await prisma.albaran.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          internalNumber: "EVID-1",
          status: "CONFIRMADO",
          date: new Date("2026-09-10T10:00:00Z"),
        },
      });
      const line = await prisma.albaranLine.create({
        data: {
          albaranId: albaranConLote.id,
          description: "Línea con lote",
          quantity: 10,
          unitPrice: 1,
          lineAmount: 10,
        },
      });
      await prisma.lot.create({
        data: {
          tenantId,
          productId: product.id,
          albaranLineId: line.id,
          lotNumber: "LOTE-EVID-1",
          quantity: 10,
        },
      });
      // Segunda recepción confirmada, sin lote (deliberado: para el "n de m con lote").
      await prisma.albaran.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          internalNumber: "EVID-2",
          status: "CONFIRMADO",
          date: new Date("2026-09-12T10:00:00Z"),
        },
      });
      // Fuera de rango: no debe contar.
      await prisma.albaran.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          internalNumber: "EVID-3",
          status: "CONFIRMADO",
          date: new Date("2026-08-01T10:00:00Z"),
        },
      });
      // Mismo periodo, tenant ajeno: no debe contar.
      await prisma.albaran.create({
        data: {
          tenantId: otherTenantId,
          internalNumber: "EVID-OTRO-1",
          status: "CONFIRMADO",
          date: new Date("2026-09-11T10:00:00Z"),
        },
      });

      await prisma.foodLabel.create({
        data: {
          tenantId,
          labelType: "HANDLED",
          productId: product.id,
          itemName: "Etiqueta evidencia",
          lotNumber: "ETQ-EVID-1",
          preparedAt: new Date("2026-09-11T09:00:00Z"),
          useByDate: new Date("2026-09-11T09:00:00Z"), // ya caducada = "próxima a caducar" con cualquier umbral
          storageCondition: "REFRIGERATED",
          createdByUserId: "user-e2e",
          createdByName: "Helena",
          createdAt: new Date("2026-09-11T09:00:00Z"),
        },
      });

      await prisma.stock.create({
        data: {
          tenantId,
          productId: product.id,
          quantity: 0,
          minimumStock: 3,
          maximumStock: 10,
        },
      });

      const report = await evidence.evidence(
        tenantId,
        new Date("2026-09-01T00:00:00Z"),
        new Date("2026-10-01T00:00:00Z"),
      );

      expect(report.receptions.confirmedCount).toBe(2); // EVID-1 y EVID-2, no EVID-3 (fuera de rango) ni el del otro tenant
      expect(report.receptions.withLotCount).toBe(1); // solo EVID-1 tiene lote
      expect(report.expiringSoon.count).toBeGreaterThanOrEqual(1); // la etiqueta ya caducada
      expect(report.labelsIssued.count).toBe(1);
      expect(report.stockAlerts.belowMinimumCount).toBe(1);
      expect(
        report.stockAlerts.belowMinimum.some((s) => s.productId === product.id),
      ).toBe(true);
    });
  });
});
