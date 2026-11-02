/**
 * Cards del dashboard que se pueden mostrar u ocultar por dispositivo
 * compartido. El frontend tiene el mismo catálogo con etiqueta y condición de
 * permiso (frontend/src/features/dashboard-layout/dashboard-widgets.ts); al
 * añadir una card, darla de alta en los dos.
 */
export const DASHBOARD_WIDGET_IDS = [
  "prep-tasks",
  "sala-notificaciones",
  "pedidos-pendientes",
  "alertas",
  "caducidades",
  "sicted",
  "recetas",
  "etiquetado",
  "compras",
  "crear-orden",
  "raciones",
  "fichar",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DASHBOARD_WIDGET_ID_SET: ReadonlySet<string> = new Set(
  DASHBOARD_WIDGET_IDS,
);

export const DASHBOARD_TITLE_MAX_LENGTH = 40;

/** Rejilla del inicio configurado: 3 columnas; cada card ocupa 1-3 de ancho y 1-2 de alto. */
export const DASHBOARD_MAX_COLS = 3;
export const DASHBOARD_MAX_ROWS = 2;

/** Una card de la pantalla: qué card y cuánto ocupa. */
export interface DashboardWidgetSlot {
  id: string;
  cols: number;
  rows: number;
}

const inRange = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;

/**
 * Valor → slot válido, o null si no lo es. Acepta el formato antiguo (solo el
 * id, como texto) como card de 1×1.
 */
export function toWidgetSlot(raw: unknown): DashboardWidgetSlot | null {
  if (typeof raw === "string") {
    return DASHBOARD_WIDGET_ID_SET.has(raw)
      ? { id: raw, cols: 1, rows: 1 }
      : null;
  }
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const { id, cols, rows } = raw as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    !DASHBOARD_WIDGET_ID_SET.has(id) ||
    !inRange(cols, DASHBOARD_MAX_COLS) ||
    !inRange(rows, DASHBOARD_MAX_ROWS)
  ) {
    return null;
  }
  return { id, cols, rows };
}
