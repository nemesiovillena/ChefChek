/**
 * Navigation configuration driven by the module system.
 *
 * Each link may declare a `moduleId`. When the tenant has that module disabled,
 * the link is hidden from the dashboard navigation and its route redirects to
 * /dashboard (see dashboard/layout.tsx). Items without `moduleId` are always
 * visible (transversal features: settings, trash, backups, sprint, price history...).
 *
 * The source of truth for module ids is the backend MODULE_REGISTRY
 * (backend/src/modules/modules/constants/registry.ts).
 */

export interface NavItem {
  label: string;
  href: string;
  /** Module that gates this item. Omit for always-visible (transversal) items. */
  moduleId?: string;
  /**
   * Section key gating this item for USER/VIEWER roles (role-access layer, on
   * top of the module system). Defaults to `moduleId` when omitted — set it
   * explicitly only for transversal items that have a section but no module
   * (Histórico de precios, Sprint, Papelera, Copias de seguridad).
   */
  sectionKey?: string;
  /** Material Symbols icon name (used in dropdowns and mobile nav). */
  icon?: string;
  /** Visible only to ADMIN/OWNER/SUPERADMIN (e.g. admin-oriented guides). */
  managerOnly?: boolean;
  /**
   * Hidden on shared accounts (a device anyone can use), whatever their role:
   * screens with personal data that only an identified person may see.
   */
  personalAccountOnly?: boolean;
  /** Roles que ven un elemento `managerOnly` sin ser responsables (p. ej. USER_CUINER en Cuiner). */
  extraRoles?: string[];
}

/** The section key that gates a nav item (falls back to its moduleId). */
export function sectionKeyForItem(item: NavItem): string | undefined {
  return item.sectionKey ?? item.moduleId;
}

export interface NavSection {
  /** Optional dropdown header. Omit for a headerless group. */
  title?: string;
  items: NavItem[];
}

/** Standalone top-bar link, always visible, no dropdown. */
export const SETTINGS_LINK: NavItem = { label: 'Configuración', href: '/dashboard/settings', icon: 'settings' };

/**
 * Grouped categories rendered as their own dropdown in the top bar (desktop)
 * and as sections inside the mobile "Más" drawer, in this exact order.
 */
export const NAV_GROUPS: NavSection[] = [
  {
    title: 'Cocina',
    items: [
      { label: 'Producción', href: '/dashboard/production', moduleId: 'production', icon: 'restaurant' },
      { label: 'Recetas', href: '/dashboard/recipes', moduleId: 'recipes', icon: 'receipt_long' },
      { label: 'Fichas técnicas', href: '/dashboard/technical-sheets', moduleId: 'technical-sheets', icon: 'description' },
      { label: 'Equipo', href: '/dashboard/users', moduleId: 'sala', icon: 'groups' },
      {
        label: 'Notificaciones de Sala',
        href: '/dashboard/sala-notificaciones',
        moduleId: 'sala-notificaciones',
        icon: 'event_note',
      },
    ],
  },
  {
    title: 'Almacén',
    items: [
      { label: 'Compras', href: '/dashboard/compras', moduleId: 'compras', icon: 'shopping_cart' },
      { label: 'Albaranes', href: '/dashboard/albaranes', moduleId: 'albaranes', icon: 'description' },
      { label: 'Artículos', href: '/dashboard/articulos', moduleId: 'articulos', icon: 'inventory_2' },
      { label: 'Proveedores', href: '/dashboard/proveedores', moduleId: 'proveedores', icon: 'local_shipping' },
      { label: 'Stock', href: '/dashboard/warehouse', moduleId: 'almacenes', icon: 'warehouse' },
      { label: 'Histórico de precios', href: '/dashboard/historico-precios', sectionKey: 'historico-precios', icon: 'trending_up' },
      { label: 'Cuiner', href: '/dashboard/cuiner', moduleId: 'cuiner', icon: 'sync_alt', managerOnly: true, extraRoles: ['USER_CUINER'] },
    ],
  },
  {
    title: 'APPCC',
    items: [
      { label: 'APPCC', href: '/dashboard/appcc', moduleId: 'appcc', icon: 'health_and_safety' },
      { label: 'Alérgenos', href: '/dashboard/allergens', moduleId: 'allergens', icon: 'warning' },
      { label: 'Etiquetado', href: '/dashboard/etiquetado', moduleId: 'etiquetado', icon: 'label' },
      // Cuelga de /dashboard/appcc pero los datos son de FoodLabel (módulo
      // etiquetado) — moduleId aquí debe ser 'etiquetado', no 'appcc'; ver
      // entrada específica en ROUTE_MODULE_MAP más abajo.
      { label: 'Caducidades', href: '/dashboard/appcc/caducidades', moduleId: 'etiquetado', icon: 'schedule' },
    ],
  },
  {
    title: 'Calidad',
    items: [
      { label: 'SICTED', href: '/dashboard/sicted', moduleId: 'sicted', icon: 'verified' },
      { label: 'Cómo usar SICTED', href: '/dashboard/sicted/ayuda', moduleId: 'sicted', icon: 'help', managerOnly: true },
    ],
  },
  {
    title: 'Personal',
    items: [
      { label: 'Fichar', href: '/dashboard/check-in', moduleId: 'check-in', icon: 'schedule' },
      { label: 'Empleados', href: '/dashboard/check-in/empleados', moduleId: 'check-in', icon: 'badge', managerOnly: true, personalAccountOnly: true },
      { label: 'Ajustes de fichaje', href: '/dashboard/check-in/configuracion', moduleId: 'check-in', icon: 'tune', managerOnly: true, personalAccountOnly: true },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { label: 'Menús', href: '/dashboard/menus', moduleId: 'menus', icon: 'restaurant_menu' },
      { label: 'Menú digital', href: '/dashboard/digital-menu', moduleId: 'digital-menu', icon: 'qr_code' },
      { label: 'Wiki', href: '/dashboard/wiki-procedimientos', moduleId: 'conocimiento', icon: 'menu_book' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { label: 'Asistente IA', href: '/dashboard/asistente', moduleId: 'asistente-ia', icon: 'smart_toy' },
      { label: 'Sprint', href: '/dashboard/sprint-tracker', sectionKey: 'sprint', icon: 'track_changes' },
      { label: 'Papelera', href: '/dashboard/papelera', sectionKey: 'papelera', icon: 'delete' },
      { label: 'Copias de Seguridad', href: '/dashboard/backups', sectionKey: 'backups', icon: 'cloud_sync' },
    ],
  },
];

/** Bottom navigation for mobile: curated quick-access subset, not the full tree. */
export const MOBILE_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Recetas', href: '/dashboard/recipes', moduleId: 'recipes', icon: 'receipt_long' },
  { label: 'Compras', href: '/dashboard/compras', moduleId: 'compras', icon: 'shopping_cart' },
  { label: 'Etiqueta', href: '/dashboard/etiquetado', moduleId: 'etiquetado', icon: 'label' },
  { label: 'Caducidades', href: '/dashboard/appcc/caducidades', moduleId: 'etiquetado', icon: 'schedule' },
];

/**
 * Maps a frontend route (by prefix) to the module that governs it.
 * Used to block direct URL access to disabled modules.
 * Ordered so longer/more-specific prefixes are matched first.
 */
export const ROUTE_MODULE_MAP: { prefix: string; moduleId: string }[] = [
  // Más específico que '/dashboard/appcc' — debe ir antes (los datos son de
  // FoodLabel, módulo etiquetado, no del módulo appcc).
  { prefix: '/dashboard/appcc/caducidades', moduleId: 'etiquetado' },
  { prefix: '/dashboard/asistente', moduleId: 'asistente-ia' },
  { prefix: '/dashboard/wiki-procedimientos', moduleId: 'conocimiento' },
  { prefix: '/dashboard/technical-sheets', moduleId: 'technical-sheets' },
  { prefix: '/dashboard/digital-menu', moduleId: 'digital-menu' },
  { prefix: '/dashboard/warehouse', moduleId: 'almacenes' },
  { prefix: '/dashboard/production', moduleId: 'production' },
  { prefix: '/dashboard/allergens', moduleId: 'allergens' },
  { prefix: '/dashboard/articulos', moduleId: 'articulos' },
  { prefix: '/dashboard/products', moduleId: 'articulos' },
  { prefix: '/dashboard/albaranes', moduleId: 'albaranes' },
  { prefix: '/dashboard/recipes', moduleId: 'recipes' },
  { prefix: '/dashboard/menus', moduleId: 'menus' },
  { prefix: '/dashboard/compras', moduleId: 'compras' },
  { prefix: '/dashboard/proveedores', moduleId: 'proveedores' },
  { prefix: '/dashboard/users', moduleId: 'sala' },
  { prefix: '/dashboard/sala-notificaciones', moduleId: 'sala-notificaciones' },
  { prefix: '/dashboard/appcc', moduleId: 'appcc' },
  { prefix: '/dashboard/etiquetado', moduleId: 'etiquetado' },
  { prefix: '/dashboard/sicted', moduleId: 'sicted' },
  { prefix: '/dashboard/check-in', moduleId: 'check-in' },
  { prefix: '/dashboard/cuiner', moduleId: 'cuiner' },
];

/** Returns the moduleId governing a pathname, or undefined if transversal. */
export function moduleForPath(pathname: string): string | undefined {
  return ROUTE_MODULE_MAP.find((entry) => pathname.startsWith(entry.prefix))
    ?.moduleId;
}

/**
 * Routes that have a role-access section but no module (transversal features
 * that can still be hidden per role). Module-backed routes reuse ROUTE_MODULE_MAP
 * via `sectionForPath` since section key === module id for them.
 */
export const ROUTE_SECTION_MAP: { prefix: string; sectionKey: string }[] = [
  { prefix: '/dashboard/historico-precios', sectionKey: 'historico-precios' },
  { prefix: '/dashboard/sprint-tracker', sectionKey: 'sprint' },
  { prefix: '/dashboard/papelera', sectionKey: 'papelera' },
  { prefix: '/dashboard/backups', sectionKey: 'backups' },
];

/** Returns the section key governing a pathname (role-access), or undefined. */
export function sectionForPath(pathname: string): string | undefined {
  return (
    ROUTE_SECTION_MAP.find((entry) => pathname.startsWith(entry.prefix))
      ?.sectionKey ?? moduleForPath(pathname)
  );
}
