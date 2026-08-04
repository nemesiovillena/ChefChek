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
  /** Material Symbols icon name (used in dropdowns and mobile nav). */
  icon?: string;
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
      { label: 'Compras', href: '/dashboard/compras', moduleId: 'compras', icon: 'shopping_cart' },
      { label: 'Artículos', href: '/dashboard/articulos', moduleId: 'articulos', icon: 'inventory_2' },
      { label: 'Equipo', href: '/dashboard/users', moduleId: 'sala', icon: 'groups' },
    ],
  },
  {
    title: 'Almacén',
    items: [
      { label: 'Albaranes', href: '/dashboard/albaranes', moduleId: 'albaranes', icon: 'description' },
      { label: 'Proveedores', href: '/dashboard/proveedores', moduleId: 'proveedores', icon: 'local_shipping' },
      { label: 'Stock', href: '/dashboard/warehouse', moduleId: 'almacenes', icon: 'warehouse' },
      { label: 'Histórico de precios', href: '/dashboard/historico-precios', icon: 'trending_up' },
    ],
  },
  {
    title: 'APPCC',
    items: [
      { label: 'APPCC', href: '/dashboard/appcc', moduleId: 'appcc', icon: 'health_and_safety' },
      { label: 'Alérgenos', href: '/dashboard/allergens', moduleId: 'allergens', icon: 'warning' },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { label: 'Menús', href: '/dashboard/menus', moduleId: 'menus', icon: 'restaurant_menu' },
      { label: 'Fichas técnicas', href: '/dashboard/technical-sheets', moduleId: 'technical-sheets', icon: 'description' },
      { label: 'Menú digital', href: '/dashboard/digital-menu', moduleId: 'digital-menu', icon: 'qr_code' },
      { label: 'Wiki', href: '/dashboard/wiki-procedimientos', moduleId: 'conocimiento', icon: 'menu_book' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { label: 'Sprint', href: '/dashboard/sprint-tracker', icon: 'track_changes' },
      { label: 'Papelera', href: '/dashboard/papelera', icon: 'delete' },
      { label: 'Copias de Seguridad', href: '/dashboard/backups', icon: 'cloud_sync' },
    ],
  },
];

/** Bottom navigation for mobile: curated quick-access subset, not the full tree. */
export const MOBILE_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Recetas', href: '/dashboard/recipes', moduleId: 'recipes', icon: 'receipt_long' },
  { label: 'Subir', href: '/dashboard/albaranes/subir', moduleId: 'albaranes', icon: 'add_a_photo' },
  { label: 'APPCC', href: '/dashboard/appcc', moduleId: 'appcc', icon: 'health_and_safety' },
  { label: 'Stock', href: '/dashboard/warehouse', moduleId: 'almacenes', icon: 'warehouse' },
];

/**
 * Maps a frontend route (by prefix) to the module that governs it.
 * Used to block direct URL access to disabled modules.
 * Ordered so longer/more-specific prefixes are matched first.
 */
export const ROUTE_MODULE_MAP: { prefix: string; moduleId: string }[] = [
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
  { prefix: '/dashboard/appcc', moduleId: 'appcc' },
];

/** Returns the moduleId governing a pathname, or undefined if transversal. */
export function moduleForPath(pathname: string): string | undefined {
  return ROUTE_MODULE_MAP.find((entry) => pathname.startsWith(entry.prefix))
    ?.moduleId;
}
