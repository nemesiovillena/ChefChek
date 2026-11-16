import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CHARGED, cents, inRange } from "./gestion-sql.util";
import { GestionProfitabilityService } from "./gestion-profitability.service";
import { GestionExpensesService } from "./gestion-expenses.service";
import type { GestionTable } from "./gestion-table.types";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const pct = (part: number, whole: number) =>
  whole > 0 ? cents((part / whole) * 100) : null;

export interface ResultsMonth {
  month: string;
  label: string;
  sales: number;
  salesWithVat: number;
  purchases: number;
  purchasesWithVat: number;
  grossMargin: number;
  labor: number;
  overheads: number;
  ebitda: number;
  ebitdaPct: number | null;
  /** Días con venta en el mes (para el punto de equilibrio diario). */
  openDays: number;
}

export interface GestionResults {
  year: number;
  months: ResultsMonth[];
  totals: Omit<ResultsMonth, "month" | "label">;
  breakEven: {
    monthly: number | null;
    daily: number | null;
    variablePct: number | null;
  };
  warnings: {
    laborWithoutCost: number;
    monthsWithoutOverheads: number;
    /** Albaranes del año pendientes de confirmar: sus compras aún no cuentan. */
    unconfirmedAlbaranes: number;
    /** Meses con ventas pero sin albaranes: su margen sale inflado. */
    monthsWithoutPurchases: number;
    laborUnavailable: boolean;
  };
}

/**
 * Cuenta de explotación y flujo de caja por mes. Coste de producto = compras
 * reales (albaranes recibidos); personal = horas fichadas × coste/hora;
 * gastos generales = los introducidos a mano en Gestión.
 */
@Injectable()
export class GestionResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitability: GestionProfitabilityService,
    private readonly expenses: GestionExpensesService,
  ) {}

  async build(tenantId: string, year: number): Promise<GestionResults> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Año no válido");
    }
    // Hoy en hora de Madrid (el servidor va en UTC): el 1 de enero a las
    // 00:30 ya es el año nuevo para el restaurante.
    const today = madridToday();
    const thisYear = Number(today.slice(0, 4));
    // Año en curso: hasta el mes actual (los meses futuros no tienen datos).
    const lastMonth =
      year === thisYear ? Number(today.slice(5, 7)) : year > thisYear ? 0 : 12;
    const currentMonth = year === thisYear ? today.slice(0, 7) : null;
    // El personal se calcula fichaje a fichaje: no pasar de hoy.
    const range = {
      from: `${year}-01-01`,
      to: year === thisYear ? today : `${year}-12-31`,
    };
    const [sales, purchases, labor, expenses, unconfirmed] = await Promise.all([
      this.prisma.$queryRaw<
        { month: string; base: number; total: number; days: number }[]
      >`
        SELECT to_char(s.fecha, 'YYYY-MM') AS month,
          COALESCE(SUM(s.base), 0)::float8 AS base,
          COALESCE(SUM(s.base + COALESCE(s.impuesto, 0)), 0)::float8 AS total,
          COUNT(DISTINCT s.fecha)::int AS days
        FROM cuiner_sale_lines s
        WHERE ${inRange(tenantId, range)} AND ${CHARGED}
        GROUP BY 1`,
      this.profitability.purchasesByMonth(tenantId, range),
      this.profitability.labor(tenantId, range),
      this.expenses.list(tenantId, year),
      // Albaranes aún sin confirmar: sus compras no cuentan todavía.
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(a.date, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM albaranes a
        WHERE a."tenantId" = ${tenantId} AND a."deletedAt" IS NULL
          AND a.status IN ('PENDIENTE', 'REVISADO')
          AND a.date >= ${range.from}::date AND a.date < (${range.to}::date + 1)
        GROUP BY 1`,
    ]);

    const months: ResultsMonth[] = [];
    for (let m = 1; m <= lastMonth; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const s = sales.find((x) => x.month === key);
      const p = purchases.find((x) => x.month === key);
      const laborCost = (labor ?? []).reduce(
        (n, l) =>
          n +
          (l.hourlyCost === null
            ? 0
            : ((l.minutesByMonth[key] ?? 0) / 60) * l.hourlyCost),
        0,
      );
      const overheads = expenses
        .filter((e) => e.month === key)
        .reduce((n, e) => n + e.amount, 0);
      const salesBase = s?.base ?? 0;
      const grossMargin = salesBase - (p?.base ?? 0);
      const ebitda = grossMargin - laborCost - overheads;
      months.push({
        month: key,
        label: MONTHS[m - 1],
        sales: cents(salesBase),
        salesWithVat: cents(s?.total ?? 0),
        purchases: cents(p?.base ?? 0),
        purchasesWithVat: cents(p?.withVat ?? 0),
        grossMargin: cents(grossMargin),
        labor: cents(laborCost),
        overheads: cents(overheads),
        ebitda: cents(ebitda),
        ebitdaPct: pct(ebitda, salesBase),
        openDays: s?.days ?? 0,
      });
    }

    const sum = (k: keyof ResultsMonth) =>
      cents(months.reduce((n, m) => n + (m[k] as number), 0));
    const totalSales = sum("sales");
    const totals = {
      sales: totalSales,
      salesWithVat: sum("salesWithVat"),
      purchases: sum("purchases"),
      purchasesWithVat: sum("purchasesWithVat"),
      grossMargin: sum("grossMargin"),
      labor: sum("labor"),
      overheads: sum("overheads"),
      ebitda: sum("ebitda"),
      ebitdaPct: pct(sum("ebitda"), totalSales),
      openDays: months.reduce((n, m) => n + m.openDays, 0),
    };

    // Punto de equilibrio: gastos fijos (personal + generales) / (1 − % de
    // compras sobre ventas). Un mes sin datos de un concepto no es un mes a
    // cero: cada media sale solo de los meses que lo tienen.
    const active = months.filter((m) => m.sales > 0);
    // Para el punto de equilibrio solo meses cerrados: el mes en curso va a
    // medias (personal y días abiertos parciales) y lo rebajaría. Si aún no
    // hay ninguno cerrado, se usa el que hay.
    const closed = active.filter((m) => m.month !== currentMonth);
    const basis = closed.length ? closed : active;
    const avgOf = (k: "labor" | "overheads") => {
      const withData = basis.filter((m) => m[k] > 0);
      return withData.length
        ? withData.reduce((n, m) => n + m[k], 0) / withData.length
        : 0;
    };
    const withPurchases = basis.filter((m) => m.purchases > 0);
    const purchasesSales = withPurchases.reduce((n, m) => n + m.sales, 0);
    const variable =
      purchasesSales > 0
        ? withPurchases.reduce((n, m) => n + m.purchases, 0) / purchasesSales
        : null;
    const fixedMonthly = avgOf("labor") + avgOf("overheads");
    const monthly =
      variable !== null && variable < 1 && avgOf("overheads") > 0
        ? cents(fixedMonthly / (1 - variable))
        : null;
    const openDaysPerMonth = basis.length
      ? basis.reduce((n, m) => n + m.openDays, 0) / basis.length
      : 0;

    return {
      year,
      months,
      totals,
      breakEven: {
        monthly,
        daily:
          monthly !== null && openDaysPerMonth > 0
            ? cents(monthly / openDaysPerMonth)
            : null,
        variablePct: variable === null ? null : cents(variable * 100),
      },
      warnings: {
        laborWithoutCost: (labor ?? []).filter((l) => l.hourlyCost === null)
          .length,
        monthsWithoutOverheads: active.filter((m) => m.overheads === 0).length,
        unconfirmedAlbaranes: unconfirmed.reduce((n, u) => n + u.count, 0),
        monthsWithoutPurchases: active.filter((m) => m.purchases === 0).length,
        laborUnavailable: labor === null,
      },
    };
  }

  async table(
    tenantId: string,
    key: "cuenta-explotacion" | "flujo-caja",
    year: number,
  ): Promise<GestionTable> {
    const r = await this.build(tenantId, year);
    const notes = [
      "Coste de producto = compras de albaranes recibidos; personal = horas fichadas × coste/hora actual de cada ficha; gastos generales = los introducidos en Gestión → Resultados.",
      ...(r.warnings.unconfirmedAlbaranes
        ? [
            `${r.warnings.unconfirmedAlbaranes} albarán(es) sin confirmar en ${year}: sus compras aún no cuentan.`,
          ]
        : []),
      ...(r.warnings.laborWithoutCost
        ? [
            `${r.warnings.laborWithoutCost} persona(s) sin coste/hora: su personal no suma.`,
          ]
        : []),
      ...(r.warnings.monthsWithoutOverheads
        ? [
            `${r.warnings.monthsWithoutOverheads} mes(es) sin gastos generales introducidos.`,
          ]
        : []),
      ...(r.warnings.monthsWithoutPurchases
        ? [
            `${r.warnings.monthsWithoutPurchases} mes(es) con ventas pero sin albaranes: su margen sale inflado.`,
          ]
        : []),
    ];
    if (key === "cuenta-explotacion") {
      return {
        key,
        title: "Cuenta de explotación",
        subtitle: `${year} · sin IVA`,
        columns: [
          { key: "label", label: "Mes", kind: "text" },
          { key: "sales", label: "Ventas", kind: "euros" },
          { key: "purchases", label: "Compras", kind: "euros" },
          { key: "grossMargin", label: "Margen bruto", kind: "euros" },
          { key: "labor", label: "Personal", kind: "euros" },
          { key: "overheads", label: "Gastos generales", kind: "euros" },
          { key: "ebitda", label: "EBITDA", kind: "euros" },
          { key: "ebitdaPct", label: "% EBITDA", kind: "percent" },
        ],
        rows: r.months.map((m) => ({ ...m })),
        totals: { label: "Total", ...r.totals },
        notes: [
          ...notes,
          ...(r.breakEven.monthly !== null
            ? [
                `Punto de equilibrio: ${r.breakEven.monthly.toLocaleString("es-ES")} € de ventas sin IVA al mes${r.breakEven.daily !== null ? ` (${r.breakEven.daily.toLocaleString("es-ES")} € por día abierto)` : ""}.`,
              ]
            : []),
        ],
      };
    }
    let balance = 0;
    const rows = r.months.map((m) => {
      const net = m.salesWithVat - m.purchasesWithVat - m.labor - m.overheads;
      balance += net;
      return {
        label: m.label,
        inflow: m.salesWithVat,
        suppliers: m.purchasesWithVat,
        labor: m.labor,
        overheads: m.overheads,
        net: cents(net),
        balance: cents(balance),
      };
    });
    return {
      key,
      title: "Flujo de caja aproximado",
      subtitle: `${year} · cobros y pagos a proveedores con IVA; personal y gastos generales sin IVA`,
      columns: [
        { key: "label", label: "Mes", kind: "text" },
        { key: "inflow", label: "Cobros (ventas)", kind: "euros" },
        { key: "suppliers", label: "Pagos proveedores", kind: "euros" },
        { key: "labor", label: "Personal", kind: "euros" },
        { key: "overheads", label: "Gastos generales", kind: "euros" },
        { key: "net", label: "Saldo del mes", kind: "euros" },
        { key: "balance", label: "Acumulado", kind: "euros" },
      ],
      rows,
      totals: {
        label: "Total",
        inflow: r.totals.salesWithVat,
        suppliers: r.totals.purchasesWithVat,
        labor: r.totals.labor,
        overheads: r.totals.overheads,
        net: cents(balance),
        balance: null,
      },
      notes: [
        "Aproximado: cuenta cada cobro y pago en el mes de la venta o del albarán, no en el día real del cobro o del pago.",
        "El saldo incluye el IVA cobrado que habrá que ingresar a Hacienda, y no incluye impuestos, préstamos ni el IVA de los gastos generales.",
        ...notes,
      ],
    };
  }
}

/** Fecha de hoy en Madrid, AAAA-MM-DD. */
export function madridToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
