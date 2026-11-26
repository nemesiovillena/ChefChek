import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CHARGED, cents, inRange } from "./gestion-sql.util";
import { monthsBetween, spreadByWeight } from "./gestion-balance-import.util";
import { GestionProfitabilityService } from "./gestion-profitability.service";
import {
  FINANCIAL_EXPENSE,
  GestionExpensesService,
  LABOR_EXPENSE,
} from "./gestion-expenses.service";
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
  /**
   * contabilidad = compras del balance del gestor repartidas por ventas (el
   * mes está en un balance importado); albaranes = albaranes recibidos.
   */
  purchasesSource: "contabilidad" | "albaranes";
  /** Compras de los albaranes aunque el mes use las de contabilidad. */
  purchasesAlbaranes: number;
  grossMargin: number;
  labor: number;
  /** real = nóminas + SS introducidas; fichajes = horas × coste/hora. */
  laborSource: "real" | "fichajes";
  /** Estimación por fichajes aunque el mes use nóminas: para cuadrarla. */
  laborFichajes: number;
  overheads: number;
  ebitda: number;
  ebitdaPct: number | null;
  /** Intereses y gastos financieros: por debajo del EBITDA. */
  financial: number;
  /** EBITDA − gastos financieros. */
  result: number;
  resultPct: number | null;
  /** Días con venta en el mes (para el punto de equilibrio diario). */
  openDays: number;
}

export interface GestionResults {
  year: number;
  months: ResultsMonth[];
  /** Balances del gestor importados de este año, cuadrados con Gestión. */
  accounting: AccountingCheck[];
  totals: Omit<
    ResultsMonth,
    | "month"
    | "label"
    | "laborSource"
    | "laborFichajes"
    | "purchasesSource"
    | "purchasesAlbaranes"
  > & {
    /** Meses con compras del balance del gestor; el resto, albaranes. */
    bookPurchaseMonths: number;
    /** Meses con nóminas reales; el resto, estimado por fichajes. */
    realLaborMonths: number;
  };
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

/** Totales de la contabilidad (o de Gestión) de un periodo, sin IVA. */
export interface PeriodFigures {
  sales: number;
  purchases: number;
  labor: number;
  overheads: number;
  financial: number;
  result: number;
}

/** Un balance del gestor frente a lo que calcula Gestión en esos meses. */
export interface AccountingCheck {
  from: string;
  to: string;
  fileName: string | null;
  books: PeriodFigures;
  /** Gestión en los mismos meses: ventas Cuiner, albaranes, fichajes… */
  gestion: PeriodFigures;
  /** El mismo periodo un año antes, si se importó. */
  previousBooks: PeriodFigures | null;
}

/**
 * Cuenta de explotación y flujo de caja por mes. Coste de producto = compras
 * reales (albaranes recibidos); personal = nóminas + SS introducidas en el
 * mes o, si no las hay, horas fichadas × coste/hora; gastos generales = los
 * introducidos en Gestión; los financieros van por debajo del EBITDA.
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
    const [sales, purchases, labor, expenses, unconfirmed, books] =
      await Promise.all([
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
        // Balances del gestor de este año y del anterior (para comparar).
        this.prisma.gestionAccountingPeriod.findMany({
          where: {
            tenantId,
            periodFrom: {
              gte: new Date(`${year - 1}-01-01T00:00:00Z`),
              lte: new Date(`${year}-12-31T00:00:00Z`),
            },
          },
          orderBy: { periodFrom: "asc" },
        }),
      ]);

    // Compras del balance del gestor, repartidas entre sus meses según las
    // ventas (como los gastos al importarlo): son las reales; los albaranes
    // solo se llevan desde hace poco y pueden faltar.
    const salesWeights = Object.fromEntries(
      sales.map((x) => [x.month, x.base]),
    );
    const bookPurchases: Record<string, number> = {};
    for (const b of books) {
      const from = b.periodFrom.toISOString().slice(0, 10);
      const to = b.periodTo.toISOString().slice(0, 10);
      if (
        from.slice(0, 4) !== String(year) ||
        to.slice(0, 4) !== String(year)
      ) {
        continue;
      }
      Object.assign(
        bookPurchases,
        spreadByWeight(b.purchases, monthsBetween(from, to), salesWeights),
      );
    }
    // IVA medio de los albaranes del año, para el flujo de caja de esos meses.
    const albaranBase = purchases.reduce((n, p) => n + p.base, 0);
    const vatFactor =
      albaranBase > 0
        ? purchases.reduce((n, p) => n + p.withVat, 0) / albaranBase
        : 1.1;

    const months: ResultsMonth[] = [];
    for (let m = 1; m <= lastMonth; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const s = sales.find((x) => x.month === key);
      const p = purchases.find((x) => x.month === key);
      const monthExpenses = expenses.filter((e) => e.month === key);
      const sumOf = (pick: (category: string) => boolean) =>
        monthExpenses
          .filter((e) => pick(e.category))
          .reduce((n, e) => n + e.amount, 0);
      const realLabor = sumOf((c) => c === LABOR_EXPENSE);
      const financial = sumOf((c) => c === FINANCIAL_EXPENSE);
      const overheads = sumOf(
        (c) => c !== LABOR_EXPENSE && c !== FINANCIAL_EXPENSE,
      );
      const estimatedLabor = (labor ?? []).reduce(
        (n, l) =>
          n +
          (l.hourlyCost === null
            ? 0
            : ((l.minutesByMonth[key] ?? 0) / 60) * l.hourlyCost),
        0,
      );
      const laborSource = realLabor !== 0 ? "real" : "fichajes";
      const laborCost = laborSource === "real" ? realLabor : estimatedLabor;
      const salesBase = s?.base ?? 0;
      const fromBooks = bookPurchases[key];
      const purchasesSource =
        fromBooks !== undefined ? "contabilidad" : "albaranes";
      const purchaseBase = fromBooks ?? p?.base ?? 0;
      const purchaseWithVat =
        fromBooks !== undefined ? fromBooks * vatFactor : (p?.withVat ?? 0);
      const grossMargin = salesBase - purchaseBase;
      const ebitda = grossMargin - laborCost - overheads;
      const result = ebitda - financial;
      months.push({
        month: key,
        label: MONTHS[m - 1],
        sales: cents(salesBase),
        salesWithVat: cents(s?.total ?? 0),
        purchases: cents(purchaseBase),
        purchasesWithVat: cents(purchaseWithVat),
        purchasesSource,
        purchasesAlbaranes: cents(p?.base ?? 0),
        grossMargin: cents(grossMargin),
        labor: cents(laborCost),
        laborSource,
        laborFichajes: cents(estimatedLabor),
        overheads: cents(overheads),
        ebitda: cents(ebitda),
        ebitdaPct: pct(ebitda, salesBase),
        financial: cents(financial),
        result: cents(result),
        resultPct: pct(result, salesBase),
        openDays: s?.days ?? 0,
      });
    }

    const sum = (
      k: Exclude<
        keyof ResultsMonth,
        | "laborSource"
        | "laborFichajes"
        | "purchasesSource"
        | "purchasesAlbaranes"
      >,
    ) => cents(months.reduce((n, m) => n + (m[k] as number), 0));
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
      financial: sum("financial"),
      result: sum("result"),
      resultPct: pct(sum("result"), totalSales),
      realLaborMonths: months.filter((m) => m.laborSource === "real").length,
      bookPurchaseMonths: months.filter(
        (m) => m.purchasesSource === "contabilidad",
      ).length,
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
      accounting: accountingChecks(books, months, year),
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
        // Solo importa si algún mes con ventas tira de fichajes.
        laborWithoutCost: active.some((m) => m.laborSource === "fichajes")
          ? (labor ?? []).filter((l) => l.hourlyCost === null).length
          : 0,
        monthsWithoutOverheads: active.filter((m) => m.overheads === 0).length,
        unconfirmedAlbaranes: unconfirmed.reduce((n, u) => n + u.count, 0),
        monthsWithoutPurchases: active.filter((m) => m.purchases === 0).length,
        laborUnavailable:
          labor === null && active.some((m) => m.laborSource === "fichajes"),
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
      `Coste de producto = ${r.totals.bookPurchaseMonths ? `compras del balance del gestor en ${r.totals.bookPurchaseMonths} mes(es) (repartidas según ventas) y albaranes recibidos en el resto` : "compras de albaranes recibidos"}; personal = ${laborNote(r.totals.realLaborMonths, r.months.length)}; gastos generales = los introducidos en Gestión → Resultados.`,
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
          { key: "financial", label: "Gastos financieros", kind: "euros" },
          { key: "result", label: "Resultado", kind: "euros" },
          { key: "resultPct", label: "% Resultado", kind: "percent" },
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
      const net =
        m.salesWithVat -
        m.purchasesWithVat -
        m.labor -
        m.overheads -
        m.financial;
      balance += net;
      return {
        label: m.label,
        inflow: m.salesWithVat,
        suppliers: m.purchasesWithVat,
        labor: m.labor,
        overheads: cents(m.overheads + m.financial),
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
        {
          key: "overheads",
          label: "Gastos generales y financieros",
          kind: "euros",
        },
        { key: "net", label: "Saldo del mes", kind: "euros" },
        { key: "balance", label: "Acumulado", kind: "euros" },
      ],
      rows,
      totals: {
        label: "Total",
        inflow: r.totals.salesWithVat,
        suppliers: r.totals.purchasesWithVat,
        labor: r.totals.labor,
        overheads: cents(r.totals.overheads + r.totals.financial),
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

type BookRow = {
  periodFrom: Date;
  periodTo: Date;
  fileName: string | null;
} & PeriodFigures;

const day = (d: Date) => d.toISOString().slice(0, 10);
const figures = (b: BookRow): PeriodFigures => ({
  sales: b.sales,
  purchases: b.purchases,
  labor: b.labor,
  overheads: b.overheads,
  financial: b.financial,
  result: b.result,
});

/**
 * Cada balance del gestor de este año frente a Gestión en los mismos meses.
 * El personal de Gestión es la estimación por fichajes (si el mes tiene
 * nóminas, compararlas consigo mismas no diría nada).
 */
export function accountingChecks(
  books: BookRow[],
  months: ResultsMonth[],
  year: number,
): AccountingCheck[] {
  return books
    .filter((b) => b.periodFrom.getUTCFullYear() === year)
    .map((b) => {
      const from = day(b.periodFrom);
      const to = day(b.periodTo);
      const inPeriod = months.filter(
        (m) => m.month >= from.slice(0, 7) && m.month <= to.slice(0, 7),
      );
      const total = (pick: (m: ResultsMonth) => number) =>
        cents(inPeriod.reduce((n, m) => n + pick(m), 0));
      const sales = total((m) => m.sales);
      // Albaranes: las compras del mes ya vienen del balance si está importado.
      const purchases = total((m) => m.purchasesAlbaranes);
      const labor = total((m) => m.laborFichajes);
      const overheads = total((m) => m.overheads);
      const financial = total((m) => m.financial);
      // Mismos meses un año antes (por mes: febrero acaba el 28 o el 29).
      const monthOf = (d: Date, minusYears = 0) =>
        `${d.getUTCFullYear() - minusYears}${day(d).slice(4, 7)}`;
      const previous = books.find(
        (p) =>
          monthOf(p.periodFrom) === monthOf(b.periodFrom, 1) &&
          monthOf(p.periodTo) === monthOf(b.periodTo, 1),
      );
      return {
        from,
        to,
        fileName: b.fileName,
        books: figures(b),
        gestion: {
          sales,
          purchases,
          labor,
          overheads,
          financial,
          result: cents(sales - purchases - labor - overheads - financial),
        },
        previousBooks: previous ? figures(previous) : null,
      };
    });
}

/** De dónde sale el personal del año, para las notas de los informes. */
export function laborNote(realMonths: number, months: number): string {
  if (months > 0 && realMonths === months) {
    return "nóminas + Seguridad Social introducidas";
  }
  if (realMonths === 0) {
    return "horas fichadas × coste/hora actual de cada ficha";
  }
  return `nóminas + Seguridad Social en ${realMonths} mes(es) y horas fichadas × coste/hora en el resto`;
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
