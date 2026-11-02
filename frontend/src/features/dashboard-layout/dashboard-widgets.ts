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
  { id: 'raciones', label: 'Raciones' },
  { id: 'fichar', label: 'Fichar' },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];

export interface DashboardLayout {
  title: string;
  /** Cards visibles, en orden. */
  widgets: string[];
}

export interface SharedDeviceLayout {
  userId: string;
  name: string;
  /** null = sin configurar: ve el dashboard completo. */
  layout: DashboardLayout | null;
}

/** Cards de la pantalla completa (sin configurar): Raciones y Fichar solo salen en pantallas configuradas. */
export const FULL_DASHBOARD_WIDGETS: string[] = DASHBOARD_WIDGETS.map((w) => w.id).filter(
  (id) => id !== 'raciones' && id !== 'fichar',
);

/** Título del dashboard cuando el dispositivo no tiene configuración. */
export const DEFAULT_DASHBOARD_TITLE = 'Cocina Principal';

/** Plantillas de arranque en el editor. */
export const DASHBOARD_TEMPLATES: { name: string; layout: DashboardLayout }[] = [
  {
    name: 'Cocina',
    // Lo de siempre más Raciones; se ficha en el kiosco.
    layout: { title: 'Cocina', widgets: DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => id !== 'fichar') },
  },
  {
    name: 'Sala',
    layout: { title: 'Sala', widgets: ['sala-notificaciones', 'raciones', 'sicted', 'fichar'] },
  },
];
