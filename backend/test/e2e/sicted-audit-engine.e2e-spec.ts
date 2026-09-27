import { inflateSync } from "zlib";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { ChecklistTemplateService } from "../../src/modules/checklists/services/checklist-template.service";
import { ChecklistRunService } from "../../src/modules/checklists/services/checklist-run.service";
import { SictedCoverageService } from "../../src/modules/sicted/services/sicted-coverage.service";
import { SictedRegistrosPdfService } from "../../src/modules/sicted/services/sicted-registros-pdf.service";
import { SictedPlanPdfService } from "../../src/modules/sicted/services/sicted-plan-pdf.service";
import { SictedAuditCsvService } from "../../src/modules/sicted/services/sicted-audit-csv.service";
import { CreateChecklistTemplateDto } from "../../src/modules/checklists/dto/checklist-template.dto";

/** Texto legible de un PDF de pdfkit — ver food-label-pdf.service.spec.ts (fase 5 reutiliza el mismo helper). */
function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let streams = "";
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try {
      streams += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      streams += m[1];
    }
  }
  let out = "";
  const tok = /<([0-9A-Fa-f\s]*)>|\(((?:[^()\\]|\\.)*)\)/g;
  let t: RegExpExecArray | null;
  while ((t = tok.exec(streams)) !== null) {
    if (t[1] !== undefined) {
      out += Buffer.from(t[1].replace(/\s+/g, ""), "hex").toString("latin1");
    } else if (t[2] !== undefined) {
      out += t[2].replace(/\\([()\\])/g, "$1");
    }
  }
  return out;
}

/**
 * Fase 5 SICTED — pack de auditoría: cobertura (qué falta), PDFs
 * deterministas (misma huella con el mismo dato), CSV. Contra Postgres real:
 * la cobertura depende del mismo cálculo de periodos que el cron de fase 2.
 */
describe("E2E - Pack de auditoría SICTED (fase 5)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let templates: ChecklistTemplateService;
  let runs: ChecklistRunService;
  let coverage: SictedCoverageService;
  let registrosPdf: SictedRegistrosPdfService;
  let planPdf: SictedPlanPdfService;
  let csv: SictedAuditCsvService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        ChecklistTemplateService,
        ChecklistRunService,
        SictedCoverageService,
        SictedRegistrosPdfService,
        SictedPlanPdfService,
        SictedAuditCsvService,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    templates = moduleRef.get(ChecklistTemplateService);
    runs = moduleRef.get(ChecklistRunService);
    coverage = moduleRef.get(SictedCoverageService);
    registrosPdf = moduleRef.get(SictedRegistrosPdfService);
    planPdf = moduleRef.get(SictedPlanPdfService);
    csv = moduleRef.get(SictedAuditCsvService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Audit Engine E2E Tenant",
        slug: "e2e-audit-engine",
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
      await tx.checklistEntry.deleteMany({ where: { tenantId } });
      await tx.checklistRun.deleteMany({ where: { tenantId } });
      await tx.checklistTemplateItem.deleteMany({ where: { tenantId } });
      await tx.checklistTemplate.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  function dailyDto(
    overrides: Partial<CreateChecklistTemplateDto> = {},
  ): CreateChecklistTemplateDto {
    return {
      name: "Limpieza cobertura E2E",
      kind: "CLEANING",
      mode: "EXECUTION",
      area: "Cocina",
      frequency: "DAILY",
      items: [{ label: "Suelo", isRequired: true }],
      ...overrides,
    };
  }

  /** `createdAt` es "ahora" (fecha real de ejecución del test) por defecto — la cobertura de un rango pasado necesita retrasarlo a mano. */
  async function backdate(templateId: string, to: string): Promise<void> {
    await prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { createdAt: new Date(to) },
    });
  }

  describe("cobertura", () => {
    it("un día sin hoja generada aparece como hueco MISSING", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "Sin cron un día" }),
      );
      await backdate(template.id, "2026-01-01T00:00:00Z");
      // Genera hojas para 3 de los 4 días del rango, dejando un hueco deliberado.
      for (const day of ["2026-03-01", "2026-03-02", "2026-03-04"]) {
        await runs.ensureRunsForToday(
          tenantId,
          "sicted",
          new Date(`${day}T10:00:00Z`),
        );
      }
      const report = await coverage.coverage(
        tenantId,
        new Date("2026-03-01T00:00:00Z"),
        new Date("2026-03-05T00:00:00Z"),
      );
      const gap = report.gaps.find(
        (g) => g.templateId === template.id && g.periodKey === "2026-03-03",
      );
      expect(gap?.status).toBe("MISSING");
    });

    it("una plantilla creada a mitad de rango solo cuenta como esperada desde que existe", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "Creada a mitad" }),
      );
      await prisma.checklistTemplate.update({
        where: { id: template.id },
        data: { createdAt: new Date("2026-04-15T00:00:00Z") },
      });
      const report = await coverage.coverage(
        tenantId,
        new Date("2026-04-01T00:00:00Z"),
        new Date("2026-04-20T00:00:00Z"),
      );
      const gapsBefore15 = report.gaps.filter(
        (g) => g.templateId === template.id && g.periodKey < "2026-04-15",
      );
      expect(gapsBefore15).toHaveLength(0);
      const gapsFrom15 = report.gaps.filter(
        (g) => g.templateId === template.id && g.periodKey >= "2026-04-15",
      );
      expect(gapsFrom15.length).toBeGreaterThan(0);
    });

    it("un día futuro (después de `now`) no cuenta como hueco — todavía no le tocaba generarse", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "Mes en curso con futuro" }),
      );
      await backdate(template.id, "2026-01-01T00:00:00Z");
      const now = new Date("2026-08-15T10:00:00Z"); // "hoy" simulado: 15 de agosto
      await runs.ensureRunsForToday(tenantId, "sicted", now);

      // Cobertura de TODO agosto (1-31), pedida "hoy" (15 de agosto) — los días 16-31 son futuro.
      const report = await coverage.coverage(
        tenantId,
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-09-01T00:00:00Z"),
        now,
      );
      const gapsForTemplate = report.gaps.filter(
        (g) => g.templateId === template.id,
      );
      const futureGaps = gapsForTemplate.filter(
        (g) => g.periodKey > "2026-08-15",
      );
      expect(futureGaps).toHaveLength(0);
      // El propio 15 tiene hoja (generada arriba), tampoco es hueco.
      expect(gapsForTemplate.some((g) => g.periodKey === "2026-08-15")).toBe(
        false,
      );
    });

    it("una hoja completada y validada cuenta en completed/validated, no en gaps", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({
          name: "Completa y validada",
          mode: "INSPECTION",
          items: [{ label: "Único", isRequired: true }],
        }),
      );
      await backdate(template.id, "2026-01-01T00:00:00Z");
      const now = new Date("2026-05-10T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });
      await runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
        {
          itemId: template.items[0].id,
          outcome: "OK",
          performedByName: "Ana",
        } as any,
      ]);
      await runs.supervise(tenantId, "sicted", run.id, "admin-u1", {
        supervisorName: "Encargado",
      });

      const report = await coverage.coverage(
        tenantId,
        new Date("2026-05-10T00:00:00Z"),
        new Date("2026-05-11T00:00:00Z"),
      );
      expect(report.gaps.some((g) => g.templateId === template.id)).toBe(false);
      expect(report.completed).toBeGreaterThanOrEqual(1);
      expect(report.validated).toBeGreaterThanOrEqual(1);
    });

    it("`to` es exclusivo: un rango de exactamente 1 día no cuenta el día siguiente como esperado (Madrid está por delante de UTC)", async () => {
      // "to" a medianoche UTC ya es el día siguiente en Madrid (UTC+1/+2) —
      // comparar por día natural en vez de por instante colaba ese día de más.
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "Límite to exclusivo" }),
      );
      await backdate(template.id, "2026-01-01T00:00:00Z");
      await runs.ensureRunsForToday(
        tenantId,
        "sicted",
        new Date("2026-05-10T10:00:00Z"),
      );

      const report = await coverage.coverage(
        tenantId,
        new Date("2026-05-10T00:00:00Z"),
        new Date("2026-05-11T00:00:00Z"),
      );
      const gapsForTemplate = report.gaps.filter(
        (g) => g.templateId === template.id,
      );
      expect(gapsForTemplate).toHaveLength(0); // ni el 10 (tiene hoja) ni el 11 (fuera de rango) deben aparecer
    });
  });

  describe("PDFs deterministas", () => {
    it("registros.pdf: misma huella con el mismo dato; distinta si cambia el dato", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "PDF fingerprint", area: "Almacén" }),
      );
      const now = new Date("2026-06-05T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });
      await runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
        {
          itemId: template.items[0].id,
          outcome: "DONE",
          performedByName: "Bea",
        } as any,
      ]);

      const pdf1 = await registrosPdf.generate(
        tenantId,
        template.id,
        "2026-06",
      );
      const pdf2 = await registrosPdf.generate(
        tenantId,
        template.id,
        "2026-06",
      );
      const fp = (buf: Buffer) =>
        pdfText(buf).match(/Huella SHA-256: ([0-9a-f]{64})/)?.[1];
      expect(fp(pdf1)).toBeDefined();
      expect(fp(pdf1)).toBe(fp(pdf2));

      const text = pdfText(pdf1);
      expect(text).toContain(template.name);
      expect(text).toContain("Suelo");
      expect(text).toContain("OK"); // marca DONE renderizada (no el nombre de quien lo hizo — ver fingerprint para esa procedencia)

      // Añadir una segunda marca en otro día cambia el dato incluido → huella distinta.
      const now2 = new Date("2026-06-06T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now2);
      const run2 = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id, periodKey: "2026-06-06" },
      });
      await runs.addEntries(tenantId, "sicted", run2.id, "session-u1", [
        {
          itemId: template.items[0].id,
          outcome: "NOT_DONE",
          reason: "Sin tiempo",
          performedByName: "Bea",
        } as any,
      ]);
      const pdf3 = await registrosPdf.generate(
        tenantId,
        template.id,
        "2026-06",
      );
      expect(fp(pdf3)).not.toBe(fp(pdf1));
      expect(pdfText(pdf3)).toContain("Sin tiempo");
    });

    it("plan.pdf contiene el nombre de la plantilla y del ítem", async () => {
      await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({
          name: "Plan PDF contenido",
          area: "Baños",
          items: [{ label: "Inodoros", isRequired: true }],
        }),
      );
      const buf = await planPdf.generate(tenantId, "Baños");
      const text = pdfText(buf);
      expect(text).toContain("Plan PDF contenido");
      expect(text).toContain("Inodoros");
    });
  });

  describe("CSV", () => {
    it("contiene una fila por marca, con cabecera", async () => {
      const template = await templates.create(
        tenantId,
        "sicted",
        "u1",
        dailyDto({ name: "CSV E2E" }),
      );
      const now = new Date("2026-07-01T10:00:00Z");
      await runs.ensureRunsForToday(tenantId, "sicted", now);
      const run = await prisma.checklistRun.findFirstOrThrow({
        where: { templateId: template.id },
      });
      await runs.addEntries(tenantId, "sicted", run.id, "session-u1", [
        {
          itemId: template.items[0].id,
          outcome: "DONE",
          performedByName: "Carla",
        } as any,
      ]);

      // El CSV filtra por `recordedAt` (marca de tiempo real del INSERT, no el
      // `now` simulado que se le pasa a ensureRunsForToday para fijar el
      // periodKey) — el rango tiene que cubrir el instante real de ejecución.
      const output = await csv.generate(
        tenantId,
        new Date(Date.now() - 60_000),
        new Date(Date.now() + 60_000),
      );
      const lines = output.split("\n");
      expect(lines[0]).toBe(
        "fecha,area,plantilla,periodo,item,resultado,valor,motivo_observacion,quien,es_correccion",
      );
      expect(
        lines.some((l) => l.includes("Carla") && l.includes("CSV E2E")),
      ).toBe(true);
    });
  });
});
