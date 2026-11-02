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
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DASHBOARD_WIDGET_ID_SET: ReadonlySet<string> = new Set(
  DASHBOARD_WIDGET_IDS,
);

export const DASHBOARD_TITLE_MAX_LENGTH = 40;
