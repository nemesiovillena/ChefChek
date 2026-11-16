import { GestionTableExportService } from "./gestion-table-export.service";
import type { GestionTable } from "./gestion-table.types";

const table: GestionTable = {
  key: "ranking",
  title: "Platos más vendidos",
  subtitle: "01/10/2026 – 31/10/2026",
  columns: [
    { key: "name", label: "Plato", kind: "text" },
    { key: "units", label: "Unidades", kind: "qty" },
    { key: "total", label: "Total con IVA", kind: "euros" },
    { key: "share", label: "% ventas", kind: "percent" },
  ],
  rows: [
    { name: "=Calamares; romana", units: 12.5, total: 150.25, share: 40 },
    { name: "Entrecot", units: 3, total: 225.4, share: 60 },
  ],
  totals: { name: "Total", units: 15.5, total: 375.65, share: 100 },
  notes: ["Nota de prueba"],
};

describe("GestionTableExportService", () => {
  const service = new GestionTableExportService();

  it("CSV con «;», coma decimal, totales y sin fórmulas", () => {
    const csv = service.toCsv(table).toString("utf8");
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Plato;Unidades;Total con IVA;% ventas");
    expect(lines[1]).toBe(`"'=Calamares; romana";12,5;150,25;40`);
    expect(lines[3]).toBe("Total;15,5;375,65;100");
  });

  it("los números negativos siguen siendo números en el CSV", () => {
    const csv = service
      .toCsv({
        ...table,
        rows: [{ name: "-Abono", units: -2, total: -12.5, share: -3.1 }],
        totals: undefined,
      })
      .toString("utf8");
    expect(csv.trim().split("\r\n")[1]).toBe("'-Abono;-2;-12,5;-3,1");
  });

  it("Excel y PDF generan un archivo", async () => {
    const xlsx = await service.toXlsx(table);
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    const pdf = await service.toPdf(table);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("nombre de archivo sin acentos ni símbolos", () => {
    expect(service.fileName(table, "csv")).toBe(
      "platos-mas-vendidos-01-10-2026-31-10-2026.csv",
    );
  });
});
