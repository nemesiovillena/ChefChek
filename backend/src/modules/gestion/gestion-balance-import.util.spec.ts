import {
  balanceTotals,
  defaultBalanceTarget,
  monthsBetween,
  spreadByWeight,
} from "./gestion-balance-import.util";
import { parseBalanceExtraction } from "./gestion-balance-import.service";

// Balance resumido inventado: gastos en positivo, ingresos en negativo.
const ACCOUNTS: [string, string, number][] = [
  ["600", "Compras de mercaderías", 30000],
  ["609", "Rappels por compras", -500],
  ["621", "Arrendamientos y cánones", 2000],
  ["622", "Reparaciones y conservación", 1000],
  ["623", "Servicios de profesionales independientes", 900],
  ["625", "Primas de seguros", 800],
  ["626", "Servicios bancarios y similares", 200],
  ["627", "Publicidad, propaganda y relaciones públicas", 100],
  ["628", "Suministros", 3000],
  ["629", "Otros servicios", 2500],
  ["631", "Otros tributos", 150],
  ["640", "Sueldos y salarios", 35000],
  ["642", "Seguridad Social a cargo de la empresa", 7000],
  ["662", "Intereses de deudas", 40.5],
  ["669", "Otros gastos financieros", 9.5],
  ["700", "Ventas de mercaderías", -100000],
  ["755", "Ingresos por servicios al personal", -300],
  ["769", "Otros ingresos financieros", -20],
];

describe("balance del gestor", () => {
  it("asigna cada cuenta según el Plan General Contable", () => {
    expect(defaultBalanceTarget("600", "")).toBe("compras");
    expect(defaultBalanceTarget("6091000000", "Rappels")).toBe("compras");
    expect(defaultBalanceTarget("6210000006", "Licencias programa")).toBe(
      "alquiler",
    );
    expect(
      defaultBalanceTarget("6290000012", "GASTOS LIMPIEZA MANTELERIA"),
    ).toBe("limpieza");
    expect(defaultBalanceTarget("6290000009", "GASTOS VARIOS.")).toBe("otros");
    expect(defaultBalanceTarget("6420000000", "SEGURIDAD SOCIAL")).toBe(
      "personal",
    );
    expect(defaultBalanceTarget("7550000000", "SERVICIOS AL PERSONAL")).toBe(
      "personal",
    );
    expect(defaultBalanceTarget("6622000013", "INTERESES PRESTAMO")).toBe(
      "financieros",
    );
    expect(defaultBalanceTarget("7000000004", "VENTAS DINER")).toBe("ventas");
    expect(defaultBalanceTarget("681", "Amortización")).toBe("ignorar");
    expect(defaultBalanceTarget("778", "Ingresos excepcionales")).toBe(
      "ignorar",
    );
  });

  it("los totales cuadran con el resultado del balance", () => {
    const lines = ACCOUNTS.map(([code, name, amount]) => ({
      code,
      name,
      amount,
      target: defaultBalanceTarget(code, name),
    }));
    expect(balanceTotals(lines)).toEqual({
      sales: 100000,
      purchases: 29500, // compras − rappels
      labor: 41700, // 640 + 642 − 755
      overheads: 10650,
      financial: 50,
      result: 18120, // incluye los 20 € de ingresos financieros ignorados
    });
  });

  it("reparte por las ventas de cada mes y cuadra al céntimo", () => {
    const months = monthsBetween("2026-01-01", "2026-03-31");
    expect(months).toEqual(["2026-01", "2026-02", "2026-03"]);
    const spread = spreadByWeight(1000, months, {
      "2026-01": 1,
      "2026-02": 1,
      "2026-03": 1,
    });
    expect(spread).toEqual({
      "2026-01": 333.33,
      "2026-02": 333.33,
      "2026-03": 333.34,
    });
    expect(
      spreadByWeight(900, months, { "2026-01": 20000, "2026-03": 40000 }),
    ).toEqual({ "2026-01": 300, "2026-02": 0, "2026-03": 600 });
    // Sin ventas: a partes iguales.
    expect(spreadByWeight(300, months, {})).toEqual({
      "2026-01": 100,
      "2026-02": 100,
      "2026-03": 100,
    });
    expect(monthsBetween("2025-11-01", "2026-02-28")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("lee la respuesta de la IA: dos periodos, el más reciente primero", () => {
    const r = parseBalanceExtraction(
      "```json\n" +
        JSON.stringify({
          isBalance: true,
          company: "RESTAURANTE EJEMPLO, S.L.",
          periods: [
            {
              from: "2025-01-01",
              to: "2025-09-30",
              accounts: [
                { code: "700", name: "Ventas", amount: "-12.345,67" },
                { code: "TOTAL", name: "Total", amount: 1 },
              ],
            },
            {
              from: "2026-01-01",
              to: "2026-09-30",
              accounts: [{ code: "700", name: "Ventas", amount: -15000 }],
            },
          ],
        }) +
        "\n```",
    );
    expect(r.company).toBe("RESTAURANTE EJEMPLO, S.L.");
    expect(r.periods.map((p) => p.from)).toEqual(["2026-01-01", "2025-01-01"]);
    expect(r.periods[1].accounts).toEqual([
      { code: "700", name: "Ventas", amount: -12345.67, target: "ventas" },
    ]);
    expect(r.periods[1].totals.sales).toBe(12345.67);
  });

  it("rechaza lo que no es un balance", () => {
    expect(() => parseBalanceExtraction('{"isBalance": false}')).toThrow(
      /no parece un balance/,
    );
    expect(() => parseBalanceExtraction("hola")).toThrow(/no devolvió/);
  });
});
