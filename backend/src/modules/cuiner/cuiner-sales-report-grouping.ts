/**
 * Piezas puras del informe de ventas de Cuiner: cómo se llama cada periodo y
 * cómo se corta la ruta de familia de la carta por niveles. El servicio hace
 * la agregación en SQL y usa esto para dar forma al resultado.
 */

export const REPORT_GROUP_BY = [
  "day",
  "week",
  "month",
  "year",
  "total",
] as const;
export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number];

/** 1-3 = nivel de familia; 4 = plato a plato. */
export const DISH_LEVEL = 4;

/** Separador de niveles en `CartasLin.Familias` («BEBIDAS ALCOHOL-LICORES-TUBO L»). */
export const FAMILY_SEPARATOR = "-";
export const NO_FAMILY = "Sin familia";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-10-17" → "17/10/2026" */
export const dayLabel = (iso: string) => iso.split("-").reverse().join("/");

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Nombre legible de un periodo. `key` es el primer día del periodo tal como
 * lo devuelve date_trunc (lunes en semanas). En «total» es el rango pedido.
 */
export function periodLabel(
  groupBy: ReportGroupBy,
  key: string,
  range: { from: string; to: string },
): string {
  const [year, month] = key.split("-");
  switch (groupBy) {
    case "day":
      return dayLabel(key);
    case "week":
      return `Semana ${dayLabel(key).slice(0, 5)} – ${dayLabel(addDays(key, 6))}`;
    case "month":
      return `${MONTHS[Number(month) - 1]} ${year}`;
    case "year":
      return year;
    case "total":
      return range.from === range.to
        ? dayLabel(range.from)
        : `${dayLabel(range.from)} – ${dayLabel(range.to)}`;
  }
}

/** Ruta de familia de un nivel: «BEBIDAS ALCOHOL-LICORES-TUBO L», nivel 2 → «BEBIDAS ALCOHOL-LICORES». */
export function familyAtLevel(familia: string | null, level: number): string {
  const parts = (familia ?? "")
    .split(FAMILY_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return NO_FAMILY;
  }
  return parts.slice(0, Math.max(1, level)).join(FAMILY_SEPARATOR);
}

/** Para mostrar: «BEBIDAS ALCOHOL › LICORES». */
export const familyLabel = (path: string) =>
  path.split(FAMILY_SEPARATOR).join(" › ");

/** ¿La familia del plato está dentro de la familia filtrada (ella misma o una subfamilia)? */
export function belongsToFamily(
  familia: string | null,
  filter: string,
): boolean {
  if (filter === NO_FAMILY) {
    return familyAtLevel(familia, 1) === NO_FAMILY;
  }
  const path = familyAtLevel(familia, Number.MAX_SAFE_INTEGER);
  return path === filter || path.startsWith(`${filter}${FAMILY_SEPARATOR}`);
}

/** Redondeo a céntimos para que los totales no arrastren decimales de coma flotante. */
export const cents = (value: number) => Math.round(value * 100) / 100;
