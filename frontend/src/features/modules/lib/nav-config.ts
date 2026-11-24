import { ArrowLeftRight, BadgeCheck, BookOpen, CalendarClock, CalendarDays, CalendarRange, ChartLine, ChefHat, CircleHelp, ClipboardList, Clock, Compass, DatabaseBackup, FileText, FolderOpen, IdCard, Inbox, Landmark, LayoutDashboard, Mail, MessagesSquare, Package, PiggyBank, QrCode, Receipt, Settings, ShieldPlus, ShoppingCart, SlidersHorizontal, StickyNote, Tag, Target, Trash2, TrendingUp, TriangleAlert, Truck, Umbrella, User, Utensils, UtensilsCrossed, Warehouse, type LucideIcon } from 'lucide-react';

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
  /** Lucide icon (used in dropdowns and mobile nav). */
  icon?: LucideIcon;
  /** Visible only to ADMIN/OWNER/SUPERADMIN (e.g. admin-oriented guides). */
  managerOnly?: boolean;
  /**
   * Hidden on shared accounts (a device anyone can use), whatever their role:
   * screens with personal data that only an identified person may see.
   */
  personalAccountOnly?: boolean;
  /** Roles que ven un elemento `managerOnly` sin ser responsables (p. ej. USER_CUINER en Cuiner, GESTION en Personal). */
  extraRoles?: string[];
  /**
   * Roles que nunca ven el elemento ni pueden abrir su ruta, aunque el módulo y
   * la sección lo permitan (p. ej. SUPERADMIN en el correo del restaurante).
   */
  hiddenForRoles?: string[];
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

/**
 * Standalone top-bar link, no dropdown. Las cuentas con rol Usuario lo ven,
 * pero la página solo les muestra la impresora de etiquetas.
 */
export const SETTINGS_LINK: NavItem = {
  label: 'Configuración',
  href: '/dashboard/settings',
  icon: Settings,
};

/**
 * Grouped categories rendered as their own dropdown in the top bar (desktop)
 * and as sections inside the mobile "Más" drawer, in this exact order.
 */
export const NAV_GROUPS: NavSection[] = [
  {
    title: 'Cocina',
    items: [
      { label: 'Producción', href: '/dashboard/production', moduleId: 'production', icon: ChefHat },
      { label: 'Recetas', href: '/dashboard/recipes', moduleId: 'recipes', icon: BookOpen },
      { label: 'Contador de platos', href: '/dashboard/raciones', moduleId: 'raciones', icon: UtensilsCrossed },
      {
        label: 'Captura de recetas',
        href: '/dashboard/captura-recetas',
        moduleId: 'captura-recetas',
        icon: Compass,
      },
      { label: 'Fichas técnicas', href: '/dashboard/technical-sheets', moduleId: 'technical-sheets', icon: FileText },
      {
        label: 'Notificaciones de Sala',
        href: '/dashboard/sala-notificaciones',
        moduleId: 'sala-notificaciones',
        icon: CalendarClock,
      },
    ],
  },
  {
    title: 'Almacén',
    items: [
      { label: 'Compras', href: '/dashboard/compras', moduleId: 'compras', icon: ShoppingCart },
      { label: 'Albaranes', href: '/dashboard/albaranes', moduleId: 'albaranes', icon: FileText },
      { label: 'Artículos', href: '/dashboard/articulos', moduleId: 'articulos', icon: Package },
      { label: 'Proveedores', href: '/dashboard/proveedores', moduleId: 'proveedores', icon: Truck },
      { label: 'Stock', href: '/dashboard/warehouse', moduleId: 'almacenes', icon: Warehouse },
      { label: 'Histórico de precios', href: '/dashboard/historico-precios', sectionKey: 'historico-precios', icon: TrendingUp },
      { label: 'Cuiner', href: '/dashboard/cuiner', moduleId: 'cuiner', icon: ArrowLeftRight, managerOnly: true, extraRoles: ['USER_CUINER'] },
    ],
  },
  {
    title: 'APPCC',
    items: [
      { label: 'APPCC', href: '/dashboard/appcc', moduleId: 'appcc', icon: ShieldPlus },
      { label: 'Alérgenos', href: '/dashboard/allergens', moduleId: 'allergens', icon: TriangleAlert },
      { label: 'Etiquetado', href: '/dashboard/etiquetado', moduleId: 'etiquetado', icon: Tag },
      // Cuelga de /dashboard/appcc pero los datos son de FoodLabel (módulo
      // etiquetado) — moduleId aquí debe ser 'etiquetado', no 'appcc'; ver
      // entrada específica en ROUTE_MODULE_MAP más abajo.
      { label: 'Caducidades', href: '/dashboard/appcc/caducidades', moduleId: 'etiquetado', icon: Clock },
    ],
  },
  {
    title: 'Calidad',
    items: [
      { label: 'SICTED', href: '/dashboard/sicted', moduleId: 'sicted', icon: BadgeCheck },
      { label: 'Cómo usar SICTED', href: '/dashboard/sicted/ayuda', moduleId: 'sicted', icon: CircleHelp, managerOnly: true },
    ],
  },
  {
    title: 'Personal',
    items: [
      // Siempre disponible (sin módulo): personas, cuentas y puestos.
      { label: 'Empleados', href: '/dashboard/users', icon: IdCard, managerOnly: true, extraRoles: ['GESTION'], personalAccountOnly: true },
      { label: 'Mi espacio', href: '/dashboard/mi-espacio', moduleId: 'rrhh', icon: User, personalAccountOnly: true },
      { label: 'Fichar', href: '/dashboard/check-in', moduleId: 'check-in', icon: Clock },
      { label: 'Registro de jornada', href: '/dashboard/check-in/jornadas', moduleId: 'check-in', icon: CalendarDays, personalAccountOnly: true },
      { label: 'Turnos', href: '/dashboard/turnos/planificador', moduleId: 'turnos', icon: CalendarRange, personalAccountOnly: true },
      { label: 'Ausencias y vacaciones', href: '/dashboard/turnos/ausencias', moduleId: 'turnos', icon: Umbrella, personalAccountOnly: true },
      { label: 'Solicitudes del equipo', href: '/dashboard/rrhh/solicitudes', moduleId: 'rrhh', icon: Inbox, managerOnly: true, extraRoles: ['GESTION'], personalAccountOnly: true },
      { label: 'Documentos del equipo', href: '/dashboard/rrhh/documentos', moduleId: 'rrhh', icon: FolderOpen, managerOnly: true, extraRoles: ['GESTION'], personalAccountOnly: true },
      { label: 'Informes de jornada', href: '/dashboard/check-in/informes', moduleId: 'check-in', icon: ClipboardList, managerOnly: true, extraRoles: ['GESTION'], personalAccountOnly: true },
      { label: 'Ajustes de fichaje', href: '/dashboard/check-in/configuracion', moduleId: 'check-in', icon: SlidersHorizontal, managerOnly: true, extraRoles: ['GESTION'], personalAccountOnly: true },
    ],
  },
  {
    // Ventas y facturación del TPV: gerencia y oficina (rol GESTION).
    title: 'Gestión',
    items: [
      { label: 'Panel', href: '/dashboard/gestion', moduleId: 'gestion', icon: ChartLine, managerOnly: true, extraRoles: ['GESTION'] },
      { label: 'Rentabilidad', href: '/dashboard/gestion/rentabilidad', moduleId: 'gestion', icon: PiggyBank, managerOnly: true, extraRoles: ['GESTION'] },
      { label: 'Calendario', href: '/dashboard/gestion/calendario', moduleId: 'gestion', icon: CalendarDays, managerOnly: true, extraRoles: ['GESTION'] },
      { label: 'Resultados', href: '/dashboard/gestion/resultados', moduleId: 'gestion', icon: Landmark, managerOnly: true, extraRoles: ['GESTION'] },
      { label: 'Informes', href: '/dashboard/gestion/informes', moduleId: 'gestion', icon: ClipboardList, managerOnly: true, extraRoles: ['GESTION'] },
      { label: 'Tickets', href: '/dashboard/gestion/tickets', moduleId: 'gestion', icon: Receipt, managerOnly: true, extraRoles: ['GESTION'] },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { label: 'Menús', href: '/dashboard/menus', moduleId: 'menus', icon: Utensils },
      { label: 'Menú digital', href: '/dashboard/digital-menu', moduleId: 'digital-menu', icon: QrCode },
      { label: 'Wiki', href: '/dashboard/wiki-procedimientos', moduleId: 'conocimiento', icon: BookOpen },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { label: 'Asistente IA', href: '/dashboard/asistente', moduleId: 'asistente-ia', icon: MessagesSquare },
      // Buzón del restaurante (leer y enviar): gerencia y personas autorizadas en su ficha.
      { label: 'Correo', href: '/dashboard/correo', moduleId: 'correo', icon: Mail, hiddenForRoles: ['SUPERADMIN'] },
      { label: 'Notas', href: '/dashboard/notas', moduleId: 'notas', icon: StickyNote },
      { label: 'Sprint', href: '/dashboard/sprint-tracker', sectionKey: 'sprint', icon: Target },
      { label: 'Papelera', href: '/dashboard/papelera', sectionKey: 'papelera', icon: Trash2 },
      { label: 'Copias de Seguridad', href: '/dashboard/backups', sectionKey: 'backups', icon: DatabaseBackup },
    ],
  },
];

/** Bottom navigation for mobile: curated quick-access subset, not the full tree. */
export const MOBILE_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Recetas', href: '/dashboard/recipes', moduleId: 'recipes', icon: BookOpen },
  { label: 'Compras', href: '/dashboard/compras', moduleId: 'compras', icon: ShoppingCart },
  { label: 'Albaranes', href: '/dashboard/albaranes', moduleId: 'albaranes', icon: FileText },
  { label: 'Caducidades', href: '/dashboard/appcc/caducidades', moduleId: 'etiquetado', icon: Clock },
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
  { prefix: '/dashboard/gestion', moduleId: 'gestion' },
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
  { prefix: '/dashboard/captura-recetas', moduleId: 'captura-recetas' },
  { prefix: '/dashboard/menus', moduleId: 'menus' },
  { prefix: '/dashboard/compras', moduleId: 'compras' },
  { prefix: '/dashboard/proveedores', moduleId: 'proveedores' },
  { prefix: '/dashboard/sala-notificaciones', moduleId: 'sala-notificaciones' },
  { prefix: '/dashboard/appcc', moduleId: 'appcc' },
  { prefix: '/dashboard/etiquetado', moduleId: 'etiquetado' },
  { prefix: '/dashboard/raciones', moduleId: 'raciones' },
  { prefix: '/dashboard/notas', moduleId: 'notas' },
  { prefix: '/dashboard/sicted', moduleId: 'sicted' },
  { prefix: '/dashboard/check-in', moduleId: 'check-in' },
  { prefix: '/dashboard/turnos', moduleId: 'turnos' },
  { prefix: '/dashboard/mi-espacio', moduleId: 'rrhh' },
  { prefix: '/dashboard/rrhh', moduleId: 'rrhh' },
  { prefix: '/dashboard/cuiner', moduleId: 'cuiner' },
  { prefix: '/dashboard/correo', moduleId: 'correo' },
];

/** ¿La ruta pertenece a un elemento del menú vetado para este rol (`hiddenForRoles`)? */
export function isPathHiddenForRole(pathname: string, role: string | undefined): boolean {
  if (!role) return false;
  return [SETTINGS_LINK, ...NAV_GROUPS.flatMap((group) => group.items)].some(
    (item) => item.hiddenForRoles?.includes(role) && pathname.startsWith(item.href),
  );
}

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
