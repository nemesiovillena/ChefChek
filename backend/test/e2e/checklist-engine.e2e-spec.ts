import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../src/common/services/prisma.service";
import { ChecklistTemplateService } from "../../src/modules/checklists/services/checklist-template.service";
import { ChecklistRunService } from "../../src/modules/checklists/services/checklist-run.service";
import { CreateChecklistTemplateDto } from "../../src/modules/checklists/dto/checklist-template.dto";

/**
 * Fase 2 SICTED — motor de checklist: generación idempotente, marcas por
 * modo (TASK/CONDITION/MEASUREMENT), corrección conserva histórico, filtro
 * `usedByModules`. Contra Postgres real (`chefchek_test`), no mocks: estos
 * servicios hacen upserts e inserts cuyo comportamiento exacto (unique
 * constraints, triggers) no vale la pena simular.
 */
describe("E2E - Motor de checklist compartido (fase 2)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let templates: ChecklistTemplateService;
  let runs: ChecklistRunService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PrismaService, ChecklistTemplateService, ChecklistRunService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    templates = moduleRef.get(ChecklistTemplateService);
    runs = moduleRef.get(ChecklistRunService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Checklist Engine E2E Tenant",
        slug: "e2e-checklist-engine",
        isActive: true,
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // SET LOCAL solo vive dentro de LA MISMA transacción: hay que borrar
    // evidencia (checklist_entries/runs, con trigger forbid_mutation*)
    // en la misma $transaction que levanta el escape, no en llamadas sueltas.
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
    await moduleRef.close();
  });

  function executionDto(
    overrides: Partial<CreateChecklistTemplateDto> = {},
  ): CreateChecklistTemplateDto {
    return {
      name: "Limpieza de prueba",
      kind: "CLEANING",
      mode: "EXECUTION",
      area: "Cocina",
      frequency: "DAILY",
      items: [
        { label: "Item obligatorio", isRequired: true },
        { label: "Item opcional", isRequired: false },
      ],
      ...overrides,
    };
  }

  describe("usedByModules: filtro y siembra compartida", () => {
    it("una plantilla creada por sicted no es visible para appcc", async () => {
      const created = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({ name: "Solo sicted" }),
      );
      expect(created.usedByModules).toEqual(["sicted"]);
      await expect(
        templates.getOneVisible(tenantId, "appcc", created.id),
      ).rejects.toThrow("no encontrada");
    });

    it("seedStarter con externalCode añade el módulo en vez de duplicar la fila", async () => {
      const dto = executionDto({
        name: "Compartida",
        externalCode: "E2E-SHARED-1",
      });
      const first = await templates.seedStarter(tenantId, "sicted", "u1", dto);
      const second = await templates.seedStarter(tenantId, "appcc", "u1", dto);
      expect(second.id).toBe(first.id); // misma fila
      expect(second.usedByModules.sort()).toEqual(["appcc", "sicted"]);

      const count = await prisma.checklistTemplate.count({
        where: { tenantId, externalCode: "E2E-SHARED-1" },
      });
      expect(count).toBe(1); // no duplicó
    });

    it("re-sembrar el mismo módulo es no-op", async () => {
      const dto = executionDto({
        name: "Idempotente",
        externalCode: "E2E-IDEMPOTENT-1",
      });
      const first = await templates.seedStarter(tenantId, "sicted", "u1", dto);
      const second = await templates.seedStarter(tenantId, "sicted", "u1", dto);
      expect(second.id).toBe(first.id);
      expect(second.usedByModules).toEqual(["sicted"]);
    });
  });

  describe("generación de hojas: idempotente", () => {
    it("dos ejecuciones el mismo día generan una sola hoja", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({ name: "Idempotencia de hoja" }),
      );
      const now = new Date("2026-09-21T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      await runs.ensureRunsForToday(tenantId, "sicted", now); // segunda vez

      const count = await prisma.checklistRun.count({
        where: { templateId: template.id },
      });
      expect(count).toBe(1);
    });

    it("una plantilla archivada no genera hojas", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({ name: "Se archiva" }),
      );
      await templates.archive(tenantId, "sicted", template.id);
      const now = new Date("2026-09-22T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const count = await prisma.checklistRun.count({
        where: { templateId: template.id },
      });
      expect(count).toBe(0);
    });
  });

  describe("marcas por modo", () => {
    it("EXECUTION: NOT_DONE sin motivo se rechaza", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({ name: "Mode EXECUTION" }),
      );
      const now = new Date("2026-09-23T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });

      await expect(
        runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
          {
            itemId: template.items[0].id,
            outcome: "NOT_DONE",
            performedByName: "Ana",
          } as any,
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it("INSPECTION: BAD sin observación se rechaza; con observación se acepta y sella la hoja", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({
          name: "Mode INSPECTION",
          mode: "INSPECTION",
          items: [{ label: "Único ítem", isRequired: true }],
        }),
      );
      const now = new Date("2026-09-24T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });

      await expect(
        runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
          {
            itemId: template.items[0].id,
            outcome: "BAD",
            performedByName: "Ana",
          } as any,
        ]),
      ).rejects.toThrow(BadRequestException);

      await runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
        {
          itemId: template.items[0].id,
          outcome: "BAD",
          observation: "Suelo sucio",
          performedByName: "Ana",
        } as any,
      ]);

      const supervised = await runs.supervise(
        tenantId,
        "sicted",
        run.id,
        "admin-u1",
        { supervisorName: "Encargado" },
      );
      expect(supervised.supervisedAt).not.toBeNull();

      await expect(
        runs.supervise(tenantId, "sicted", run.id, "admin-u1", {
          supervisorName: "Otra vez",
        }),
      ).rejects.toThrow(ConflictException);

      // Ya supervisada: no admite más marcas.
      await expect(
        runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
          {
            itemId: template.items[0].id,
            outcome: "OK",
            performedByName: "Ana",
          } as any,
        ]),
      ).rejects.toThrow(ConflictException);
    });

    it("MEASUREMENT: valor fuera de rango calcula withinRange=false y exige acción correctiva", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({
          name: "Mode MEASUREMENT",
          mode: "MEASUREMENT",
          items: [
            {
              label: "Cámara",
              isRequired: true,
              expectedRangeMin: 0,
              expectedRangeMax: 4,
            },
          ],
        }),
      );
      const now = new Date("2026-09-25T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });

      await expect(
        runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
          {
            itemId: template.items[0].id,
            value: 9,
            performedByName: "Ana",
          } as any,
        ]),
      ).rejects.toThrow("acción correctiva");

      const result = await runs.addEntries(
        tenantId,
        "sicted",
        run.id,
        "session-u1",
        [
          {
            itemId: template.items[0].id,
            value: 9,
            correctiveAction: "Se avisó al técnico",
            performedByName: "Ana",
          } as any,
        ],
      );
      const entry = result.currentByItem[template.items[0].id];
      expect(entry.withinRange).toBe(false);
      // MEASUREMENT no requiere supervisor por defecto (documento real: una sola firma).
      expect(result.status).toBe("COMPLETED");
    });
  });

  describe("corrección conserva histórico; vigente = última", () => {
    it("una corrección no borra la marca anterior, solo cambia cuál es la vigente", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({
          name: "Corrección",
          items: [{ label: "Único", isRequired: true }],
        }),
      );
      const now = new Date("2026-09-26T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });

      const first = await runs.addEntries(
        tenantId,
        "sicted",
        run.id,
        "session-u1",
        [
          {
            itemId: template.items[0].id,
            outcome: "NOT_DONE",
            reason: "Sin tiempo",
            performedByName: "Ana",
          } as any,
        ],
      );
      const firstEntryId = first.currentByItem[template.items[0].id].id;

      const corrected = await runs.addEntries(
        tenantId,
        "sicted",
        run.id,
        "session-u2",
        [
          {
            itemId: template.items[0].id,
            outcome: "DONE",
            performedByName: "Bea",
            correctsEntryId: firstEntryId,
          } as any,
        ],
      );

      expect(corrected.entries).toHaveLength(2); // histórico completo
      expect(corrected.currentByItem[template.items[0].id].outcome).toBe(
        "DONE",
      ); // vigente = última
    });

    it("listRuns: una corrección no infla el progreso (entriesCount = ítems distintos, no filas)", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        executionDto({
          name: "Progreso tras corrección",
          items: [{ label: "Único", isRequired: true }],
        }),
      );
      const now = new Date("2026-09-30T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });

      const first = await runs.addEntries(
        tenantId,
        "sicted",
        run.id,
        "session-u1",
        [
          {
            itemId: template.items[0].id,
            outcome: "NOT_DONE",
            reason: "Sin tiempo",
            performedByName: "Ana",
          } as any,
        ],
      );
      await runs.addEntries(tenantId, "sicted", run.id, "session-u2", [
        {
          itemId: template.items[0].id,
          outcome: "DONE",
          performedByName: "Bea",
          correctsEntryId: first.currentByItem[template.items[0].id].id,
        } as any,
      ]);

      const list = await runs.listRuns(tenantId, "sicted", {
        templateId: template.id,
      });
      const listed = list.find((r) => r.id === run.id);
      expect(listed?.entriesCount).toBe(1); // 1 ítem marcado, aunque hay 2 filas en checklist_entries
    });
  });

  describe("aislamiento por tenant", () => {
    it("un tenant B no ve la plantilla/hoja del tenant A", async () => {
      const tenantB = await prisma.tenant.create({
        data: {
          name: "Tenant B E2E",
          slug: "e2e-checklist-tenant-b",
          isActive: true,
        },
      });
      try {
        const template = await templates.create(
          tenantId,
          "sicted",
          "u1",
          executionDto({ name: "Solo tenant A" }),
        );
        await expect(
          templates.getOneVisible(tenantB.id, "sicted", template.id),
        ).rejects.toThrow("no encontrada");

        await runs.ensureRunsForToday(
          tenantId,
          "sicted",
          new Date("2026-09-27T10:00:00Z"),
        );
        const run = await prisma.checklistRun.findFirstOrThrow({
          where: { templateId: template.id },
        });
        await expect(runs.getRun(tenantB.id, "sicted", run.id)).rejects.toThrow(
          "no encontrada",
        );
      } finally {
        await prisma.tenant.delete({ where: { id: tenantB.id } }); // sin evidencia propia, no necesita el escape
      }
    });
  });
});
