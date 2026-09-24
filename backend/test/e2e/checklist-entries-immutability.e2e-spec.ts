import { PrismaClient } from "@prisma/client";

/**
 * Fase 2 SICTED — prueba el trigger de inalterabilidad contra las tablas
 * REALES `checklist_entries` (forbid_mutation, siempre) y `checklist_runs`
 * (forbid_mutation_after_seal, hasta supervisar). Complementa el test
 * genérico de fase 1 (tablas desechables): aquí se ejercen las tablas de
 * producción tal cual las usa la app.
 */
describe("E2E - checklist_entries/checklist_runs son inalterables (fase 2)", () => {
  const prisma = new PrismaClient();
  let tenantId: string;
  let templateId: string;
  let itemId: string;
  let runId: string;
  let entryId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: "Checklist Immutability E2E",
        slug: "e2e-checklist-immutability",
        isActive: true,
      },
    });
    tenantId = tenant.id;

    const template = await prisma.checklistTemplate.create({
      data: {
        tenantId,
        name: "Plantilla inmutabilidad",
        usedByModules: ["sicted"],
        kind: "CLEANING",
        mode: "EXECUTION",
        area: "Cocina",
        frequency: "DAILY",
        createdBy: "e2e",
        items: {
          create: [{ tenantId, position: 0, label: "Item", products: [] }],
        },
      },
      include: { items: true },
    });
    templateId = template.id;
    itemId = template.items[0].id;

    const run = await prisma.checklistRun.create({
      data: {
        tenantId,
        templateId,
        periodKey: "2026-09-28",
        periodStart: new Date("2026-09-28T12:00:00Z"),
        status: "OPEN",
        snapshot: {
          templateName: template.name,
          version: 1,
          mode: "EXECUTION",
          requiresSupervisor: false,
          items: [],
        },
      },
    });
    runId = run.id;

    const entry = await prisma.checklistEntry.create({
      data: {
        tenantId,
        runId,
        itemId,
        outcome: "DONE",
        performedByName: "Ana",
        sessionUserId: "session-1",
      },
    });
    entryId = entry.id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.checklistEntry.deleteMany({ where: { tenantId } });
      await tx.checklistRun.deleteMany({ where: { tenantId } });
      await tx.checklistTemplateItem.deleteMany({ where: { tenantId } });
      await tx.checklistTemplate.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("checklist_entries: UPDATE vía SQL directo falla", async () => {
    await expect(
      prisma.checklistEntry.update({
        where: { id: entryId },
        data: { note: "intento de editar" },
      }),
    ).rejects.toThrow();
  });

  it("checklist_entries: DELETE vía SQL directo falla", async () => {
    await expect(
      prisma.checklistEntry.delete({ where: { id: entryId } }),
    ).rejects.toThrow();
  });

  it("checklist_runs: UPDATE normal (sin supervisar) funciona — status, closedAt, etc.", async () => {
    await expect(
      prisma.checklistRun.update({
        where: { id: runId },
        data: { status: "COMPLETED", closedAt: new Date() },
      }),
    ).resolves.toBeDefined();
  });

  it("checklist_runs: tras supervisar (supervisedAt puesto), UPDATE falla", async () => {
    await prisma.checklistRun.update({
      where: { id: runId },
      data: { supervisedAt: new Date(), supervisorName: "Encargado" },
    });
    await expect(
      prisma.checklistRun.update({
        where: { id: runId },
        data: { supervisorNote: "cambio tardío" },
      }),
    ).rejects.toThrow();
  });

  it("checklist_runs: DELETE falla incluso antes de supervisar (probado con una hoja nueva)", async () => {
    const otherRun = await prisma.checklistRun.create({
      data: {
        tenantId,
        templateId,
        periodKey: "2026-09-29",
        periodStart: new Date("2026-09-29T12:00:00Z"),
        status: "OPEN",
        snapshot: {
          templateName: "x",
          version: 1,
          mode: "EXECUTION",
          requiresSupervisor: false,
          items: [],
        },
      },
    });
    await expect(
      prisma.checklistRun.delete({ where: { id: otherRun.id } }),
    ).rejects.toThrow();
    // Limpieza de esta fila extra dentro del escape del afterAll (misma tenantId, ya cubierta).
  });

  it("el escape SET LOCAL permite el UPDATE/DELETE de evidencia (usado en la limpieza del propio test)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.checklistEntry.update({
        where: { id: entryId },
        data: { note: "con escape sí" },
      });
    });
    const updated = await prisma.checklistEntry.findUniqueOrThrow({
      where: { id: entryId },
    });
    expect(updated.note).toBe("con escape sí");
  });
});
