import ExcelJS from "exceljs";
import { Response } from "express";
import { PrismaService } from "../../common/services/prisma.service";
import {
  belongsToFamily,
  familyAtLevel,
  periodLabel,
} from "./cuiner-sales-report-grouping";
import { CuinerSalesReportExportService } from "./cuiner-sales-report-export.service";
import { CuinerController } from "./cuiner.controller";
import {
  CuinerSalesReportService,
  SalesReportQuery,
} from "./cuiner-sales-report.service";

const range = { from: "2026-10-01", to: "2026-10-31" };

describe("periodLabel", () => {
  it.each([
    ["day", "2026-10-17", "17/10/2026"],
    ["week", "2026-12-28", "Semana 28/12 – 03/01/2027"],
    ["month", "2026-10-01", "octubre 2026"],
    ["year", "2026-01-01", "2026"],
    ["total", "2026-10-01", "01/10/2026 – 31/10/2026"],
  ] as const)("%s %s → %s", (groupBy, key, label) => {
    expect(periodLabel(groupBy, key, range)).toBe(label);
  });
});

describe("familias por nivel", () => {
  const path = "BEBIDAS ALCOHOL-LICORES-TUBO L";
  it("corta la ruta por niveles", () => {
    expect(familyAtLevel(path, 1)).toBe("BEBIDAS ALCOHOL");
    expect(familyAtLevel(path, 2)).toBe("BEBIDAS ALCOHOL-LICORES");
    expect(familyAtLevel(path, 3)).toBe(path);
    expect(familyAtLevel(null, 2)).toBe("Sin familia");
  });

  it("filtra la familia y sus subfamilias, no las que solo empiezan igual", () => {
    expect(belongsToFamily(path, "BEBIDAS ALCOHOL")).toBe(true);
    expect(belongsToFamily(path, "BEBIDAS ALCOHOL-LICORES")).toBe(true);
    expect(belongsToFamily("BEBIDAS ALCOHOLICAS", "BEBIDAS ALCOHOL")).toBe(
      false,
    );
    expect(belongsToFamily(null, "Sin familia")).toBe(true);
  });
});

const agg = (over: Record<string, unknown>) => ({
  period: "2026-10-17",
  tipo: "P",
  producto: "00001",
  nombre: "CAÑA",
  familia: "CERVEZAS",
  units: 0,
  invited: 0,
  base: 0,
  total: 0,
  missing: 0,
  ...over,
});

const ROWS = [
  agg({
    producto: "00062",
    nombre: "CAÑA",
    familia: "CERVEZAS",
    units: 60,
    invited: 1,
    base: 109.09,
    total: 120,
  }),
  agg({
    producto: "00090",
    nombre: "CAÑA DOBLE",
    familia: "CERVEZAS",
    units: 10,
    base: 36.36,
    total: 40,
  }),
  agg({
    producto: "00300",
    nombre: "BACARDI COMBI",
    familia: "BEBIDAS ALCOHOL-RON-COMBINADOS R",
    units: 4,
    base: 25.45,
    total: 28,
  }),
  agg({
    producto: "00297",
    nombre: "BACARDI PIEDRA",
    familia: "BEBIDAS ALCOHOL-RON-PIEDRAS R",
    units: 2,
    base: 7.27,
    total: 8,
  }),
  agg({
    period: "2026-10-18",
    producto: "00062",
    nombre: "CAÑA",
    familia: "CERVEZAS",
    units: 20,
    base: 36.36,
    total: 40,
    missing: 3,
  }),
];

function serviceWith(rows = ROWS) {
  const prisma = {
    $queryRaw: jest.fn(async () => rows),
    cuinerConfig: { findUnique: jest.fn(async () => ({ historyDone: false })) },
    cuinerSaleLine: {
      aggregate: jest.fn(async () => ({
        _min: { fecha: new Date("2021-11-17T00:00:00Z") },
      })),
    },
  };
  return {
    prisma,
    service: new CuinerSalesReportService(prisma as unknown as PrismaService),
  };
}

const query = (over: Partial<SalesReportQuery> = {}): SalesReportQuery => ({
  from: "2026-10-17",
  to: "2026-10-18",
  groupBy: "day",
  level: 1,
  ...over,
});

describe("CuinerSalesReportService.build", () => {
  it("agrupa por día y familia principal, con % y totales", async () => {
    const { service } = serviceWith();
    const report = await service.build("t1", query());
    expect(report.periods.map((p) => p.label)).toEqual([
      "17/10/2026",
      "18/10/2026",
    ]);
    const day = report.periods[0];
    expect(
      day.rows.map((r) => [r.label, r.units, r.invitedUnits, r.total, r.share]),
    ).toEqual([
      ["CERVEZAS", 70, 1, 160, 81.63],
      ["BEBIDAS ALCOHOL", 6, 0, 36, 18.37],
    ]);
    expect(day.totals).toEqual({
      units: 76,
      invitedUnits: 1,
      base: 178.17,
      total: 196,
    });
    expect(report.totals.total).toBe(236);
    expect(report.missingAmounts).toBe(3);
    expect(report.history).toEqual({ done: false, oldestDate: "2021-11-17" });
  });

  it("baja al detalle: familia filtrada al nivel 2", async () => {
    const { service } = serviceWith();
    const report = await service.build(
      "t1",
      query({ groupBy: "total", level: 2, family: "BEBIDAS ALCOHOL" }),
    );
    // En «total» el SQL devuelve un solo periodo; aquí lo simula la fila del 17.
    expect(report.periods[0].rows.map((r) => r.label)).toEqual([
      "BEBIDAS ALCOHOL › RON",
    ]);
    expect(report.totals.units).toBe(6);
  });

  it("plato a plato lleva la familia del plato", async () => {
    const { service } = serviceWith();
    const report = await service.build("t1", query({ level: 4 }));
    expect(report.periods[0].rows[0]).toMatchObject({
      key: "P-00062",
      label: "CAÑA",
      family: "CERVEZAS",
    });
  });

  it("rechaza rangos al revés y días de más", async () => {
    const { service } = serviceWith();
    await expect(
      service.build("t1", query({ from: "2026-10-18", to: "2026-10-17" })),
    ).rejects.toThrow();
    await expect(
      service.build("t1", query({ from: "2021-01-01", to: "2026-10-17" })),
    ).rejects.toThrow(/400 días/);
  });
});

describe("CuinerSalesReportExportService", () => {
  const exporter = new CuinerSalesReportExportService();
  const build = () => serviceWith().service.build("t1", query());

  it("CSV con ; y coma decimal, subtotales y total", async () => {
    const csv = exporter.toCsv(await build()).toString("utf8");
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Periodo;Familia;Unidades;Invitaciones;Base sin IVA (€);Total con IVA (€);% del periodo",
    );
    expect(lines).toContain("17/10/2026;CERVEZAS;70;1;145,45;160;81,63");
    expect(lines).toContain("17/10/2026;Total del periodo;76;1;178,17;196;");
    expect(lines.at(-1)).toBe(";TOTAL;96;1;214,53;236;");
  });

  it("Excel legible con los mismos importes", async () => {
    const buffer = await exporter.toXlsx(await build());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Ventas");
    expect(sheet?.getRow(4).values).toEqual([
      undefined,
      "17/10/2026",
      "CERVEZAS",
      70,
      1,
      145.45,
      160,
      0.8163,
    ]);
  });

  it("PDF válido", async () => {
    const pdf = await exporter.toPdf(await build());
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("CuinerController.exportSalesReport", () => {
  it.each([
    [
      "xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "PK",
    ],
    ["csv", "text/csv; charset=utf-8", "﻿Periodo"],
    ["pdf", "application/pdf", "%PDF"],
  ] as const)(
    "descarga %s con su tipo y nombre",
    async (format, type, start) => {
      const { service } = serviceWith();
      const unused = undefined as never;
      const controller = new CuinerController(
        unused,
        unused,
        unused,
        unused,
        unused,
        unused,
        unused, // medidas de servicio
        unused, // enlace rápido por marca
        service,
        new CuinerSalesReportExportService(),
      );
      const res = { set: jest.fn(), send: jest.fn() };
      await controller.exportSalesReport(
        { tenantId: "t1", user: { id: "u1" } },
        { ...query(), format },
        res as unknown as Response,
      );
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="ventas-2026-10-17_2026-10-18.${format}"`,
        }),
      );
      const body = res.send.mock.calls[0][0] as Buffer;
      expect(body.toString("utf8", 0, start.length + 3)).toContain(start);
    },
  );
});
