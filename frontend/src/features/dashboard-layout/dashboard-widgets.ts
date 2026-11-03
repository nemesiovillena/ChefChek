/**
 * Cards del dashboard que el administrador puede mostrar u ocultar en cada
 * dispositivo compartido. Mismos ids que el backend
 * (backend/src/modules/dashboard-layout/dashboard-widgets.ts): al añadir una
 * card, darla de alta en los dos.
 */
export const DASHBOARD_WIDGETS = [
  { id: 'prep-tasks', label: 'Tareas de preparación' },
  { id: 'sala-notificaciones', label: 'Notificaciones de Sala' },
  { id: 'pedidos-pendientes', label: 'Pedidos pendientes' },
  { id: 'alertas', label: 'Notificaciones y alertas' },
  { id: 'caducidades', label: 'Caducidades' },
  { id: 'sicted', label: 'Hojas SICTED' },
  { id: 'recetas', label: 'Recetas' },
  { id: 'etiquetado', label: 'Etiquetado' },
  { id: 'compras', label: 'Compras' },
  { id: 'crear-orden', label: 'Botón «Crear orden de producción»' },
  { id: 'raciones', label: 'Contador de platos' },
  { id: 'fichar', label: 'Fichar' },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];

export const WIDGET_LABELS = new Map<string, string>(DASHBOARD_WIDGETS.map((w) => [w.id, w.label]));

/** El botón va en la cabecera, no en la rejilla: no tiene tamaño. */
export const HEADER_ONLY_WIDGETS = new Set<string>(['crear-orden']);

/** Rejilla del inicio configurado: 3 columnas; cada card ocupa 1-3 de ancho y 1-2 de alto. */
export const DASHBOARD_MAX_COLS = 3;
export const DASHBOARD_MAX_ROWS = 2;

/** Una card de la pantalla: qué card y cuánto ocupa. */
export interface DashboardWidgetSlot {
  id: string;
  cols: number;
  rows: number;
}

export interface DashboardLayout {
  title: string;
  /** Cards visibles con su tamaño, en orden. */
  widgets: DashboardWidgetSlot[];
}

export interface SharedDeviceLayout {
  userId: string;
  name: string;
  /** device = dispositivo compartido; admin = cuenta de administración (OWNER/ADMIN). */
  kind: 'device' | 'admin';
  /** null = sin configurar: ve el dashboard completo. */
  layout: DashboardLayout | null;
}

const slot = (id: string, cols = 1, rows = 1): DashboardWidgetSlot => ({ id, cols, rows });

/** Cards de la pantalla completa (sin configurar): Raciones y Fichar solo salen en pantallas configuradas. */
export const FULL_DASHBOARD_WIDGETS: DashboardWidgetSlot[] = [
  slot('prep-tasks', 2, 2),
  slot('sala-notificaciones', 1, 2),
  slot('pedidos-pendientes'),
  slot('alertas'),
  slot('caducidades'),
  slot('sicted', 2),
  slot('recetas'),
  slot('etiquetado'),
  slot('compras'),
  slot('crear-orden'),
];

/** Título del dashboard cuando el dispositivo no tiene configuración. */
export const DEFAULT_DASHBOARD_TITLE = 'Cocina Principal';

/** Plantillas de arranque en el editor (pensadas para caber en una pantalla). */
export const DASHBOARD_TEMPLATES: { name: string; layout: DashboardLayout }[] = [
  {
    name: 'Cocina',
    // Lo de siempre más Raciones; se ficha en el kiosco.
    layout: {
      title: 'Cocina',
      widgets: [
        slot('prep-tasks', 2, 2),
        slot('sala-notificaciones', 1, 2),
        slot('pedidos-pendientes'),
        slot('alertas'),
        slot('caducidades'),
        slot('sicted', 2),
        slot('raciones'),
        slot('recetas'),
        slot('etiquetado'),
        slot('compras'),
        slot('crear-orden'),
      ],
    },
  },
  {
    name: 'Administración',
    // Gestión primero: pedidos, alertas y compras a la vista.
    layout: {
      title: 'Administración',
      widgets: [
        slot('alertas', 1, 2),
        slot('prep-tasks', 2, 2),
        slot('pedidos-pendientes'),
        slot('caducidades'),
        slot('sala-notificaciones'),
        slot('sicted', 2),
        slot('raciones'),
        slot('compras'),
        slot('recetas'),
        slot('crear-orden'),
      ],
    },
  },
  {
    name: 'Sala',
    layout: {
      title: 'Sala',
      widgets: [slot('sala-notificaciones', 2, 2), slot('raciones', 1, 2), slot('sicted', 2), slot('fichar')],
    },
  },
];

/** Copia profunda: el editor modifica slots sin tocar la plantilla. */
export const cloneLayout = (layout: DashboardLayout): DashboardLayout => ({
  title: layout.title,
  widgets: layout.widgets.map((w) => ({ ...w })),
});

/** Slot nuevo al activar una card: tamaño por defecto 1×1. */
export const newSlot = (id: string): DashboardWidgetSlot => slot(id);
