import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "./gestion-expenses.service";

/**
 * Dónde va cada cuenta del balance del gestor: una categoría de gasto de
 * Gestión, o ventas/compras (solo para cuadrar con Cuiner y los albaranes),
 * o «ignorar» (amortizaciones, ingresos y gastos excepcionales…).
 */
export type BalanceTarget = ExpenseCategory | "ventas" | "compras" | "ignorar";

export const BALANCE_TARGETS: readonly BalanceTarget[] = [
  ...EXPENSE_CATEGORIES,
  "ventas",
  "compras",
  "ignorar",
];

/** Una cuenta del balance. amount > 0 resta al beneficio (gasto); < 0 suma. */
export interface BalanceAccount {
  code: string;
  name: string;
  amount: number;
}

export interface BalanceAccountLine extends BalanceAccount {
  target: BalanceTarget;
}

/** Totales del periodo para cuadrar con Gestión, sin IVA y en positivo. */
export interface BalanceTotals {
  sales: number;
  purchases: number;
  labor: number;
  overheads: number;
  financial: number;
  /** Beneficio del balance: todas las cuentas, también las ignoradas. */
  result: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Categoría por defecto según el Plan General Contable. El nombre solo
 * desempata dentro de la 629 (limpieza y mantelería son un gasto grande en
 * hostelería y el gestor las mete en «otros servicios»).
 */
export function defaultBalanceTarget(
  code: string,
  name: string,
): BalanceTarget {
  const c = code.replace(/\D/g, "");
  const g3 = c.slice(0, 3);
  const g2 = c.slice(0, 2);
  if (g2 === "60" || g2 === "61") {
    return "compras";
  }
  if (g3 === "621") {
    return "alquiler";
  }
  if (g3 === "622") {
    return "mantenimiento";
  }
  if (g3 === "623") {
    return "gestoria";
  }
  if (g3 === "625") {
    return "seguros";
  }
  if (g3 === "626") {
    return "bancos";
  }
  if (g3 === "627") {
    return "marketing";
  }
  if (g3 === "628") {
    return "suministros";
  }
  if (g3 === "629" && /limpi|mantel|lavander|tintor/i.test(name)) {
    return "limpieza";
  }
  if (g2 === "62" || g2 === "65") {
    return "otros";
  }
  if (g2 === "63") {
    return "tributos";
  }
  if (g2 === "64") {
    return "personal";
  }
  // 755: lo que pagan los empleados por la manutención; compensa el plus de
  // manutención que va en sueldos (640).
  if (g3 === "755") {
    return "personal";
  }
  if (g2 === "66") {
    return "financieros";
  }
  if (g2 === "70") {
    return "ventas";
  }
  return "ignorar";
}

/** Totales del balance con la asignación elegida. */
export function balanceTotals(lines: BalanceAccountLine[]): BalanceTotals {
  const sum = (pick: (t: BalanceTarget) => boolean) =>
    lines.filter((l) => pick(l.target)).reduce((n, l) => n + l.amount, 0);
  return {
    sales: cents(-sum((t) => t === "ventas")),
    purchases: cents(sum((t) => t === "compras")),
    labor: cents(sum((t) => t === "personal")),
    overheads: cents(
      sum(
        (t) =>
          EXPENSE_CATEGORIES.includes(t as ExpenseCategory) &&
          t !== "personal" &&
          t !== "financieros",
      ),
    ),
    financial: cents(sum((t) => t === "financieros")),
    result: cents(-lines.reduce((n, l) => n + l.amount, 0)),
  };
}

/** Meses AAAA-MM entre dos fechas AAAA-MM-DD, ambos incluidos. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

/**
 * Reparte un importe entre meses según el peso de cada uno (las ventas del
 * mes): los meses que más venden cargan más gasto. Sin ventas en ningún mes,
 * a partes iguales. Redondea a céntimos y el último mes absorbe el resto,
 * para que la suma cuadre al céntimo con el balance.
 */
export function spreadByWeight(
  amount: number,
  months: string[],
  weights: Record<string, number>,
): Record<string, number> {
  const w = months.map((m) => Math.max(0, weights[m] ?? 0));
  const total = w.reduce((n, x) => n + x, 0);
  const shares =
    total > 0 ? w.map((x) => x / total) : w.map(() => 1 / months.length);
  const out: Record<string, number> = {};
  let assigned = 0;
  months.forEach((m, i) => {
    const value =
      i === months.length - 1
        ? cents(amount - assigned)
        : cents(amount * shares[i]);
    assigned = cents(assigned + value);
    out[m] = value;
  });
  return out;
}
