/**
 * Section Registry
 *
 * Defines the "sections" (apartados) whose visibility can be restricted per
 * role (USER / VIEWER) per tenant. This is a layer ON TOP of the per-tenant
 * module system (MODULE_REGISTRY): a section bound to a disabled module is
 * hidden for everyone; the role-access config can only remove additional
 * access for USER/VIEWER, never grant it.
 *
 * Sub-capabilities (keys with a `parent`) refine a parent section, e.g.
 * `recipes.cost` gates cost visibility inside Recetas.
 *
 * The source of truth for module ids is MODULE_REGISTRY
 * (backend/src/modules/modules/constants/registry.ts).
 */

export interface SectionDefinition {
  /** Config key fragment: `roleAccess.{ROLE}.{key}`. */
  key: string;
  /** Human label for the settings screen. */
  label: string;
  /** MODULE_REGISTRY id when the section is backed by a module. */
  moduleId?: string;
  /** Parent section key for sub-capabilities. */
  parent?: string;
  /**
   * Default when no explicit config row exists. Always `true`: the feature only
   * ever subtracts access. Kept explicit for readability.
   */
  defaultAllowed: boolean;
}

export const SECTION_REGISTRY: SectionDefinition[] = [
  // ── Cocina ──────────────────────────────────────────────────────────────
  {
    key: "recipes",
    label: "Recetas",
    moduleId: "recipes",
    defaultAllowed: true,
  },
  {
    key: "recipes.cost",
    label: "Ver coste",
    parent: "recipes",
    defaultAllowed: true,
  },
  {
    key: "recipes.ficha",
    label: "Ver ficha técnica",
    parent: "recipes",
    defaultAllowed: true,
  },
  {
    key: "recipes.edit",
    label: "Editar recetas",
    parent: "recipes",
    defaultAllowed: true,
  },
  {
    key: "production",
    label: "Producción",
    moduleId: "production",
    defaultAllowed: true,
  },
  {
    key: "production.tasks",
    label: "Ver tareas de preparación",
    parent: "production",
    defaultAllowed: true,
  },
  {
    key: "technical-sheets",
    label: "Fichas técnicas",
    moduleId: "technical-sheets",
    defaultAllowed: true,
  },
  { key: "sala", label: "Equipo", moduleId: "sala", defaultAllowed: true },
  {
    key: "sala-notificaciones",
    label: "Notificaciones de Sala",
    moduleId: "sala-notificaciones",
    defaultAllowed: true,
  },

  // ── Almacén ─────────────────────────────────────────────────────────────
  {
    key: "compras",
    label: "Compras",
    moduleId: "compras",
    defaultAllowed: true,
  },
  {
    key: "albaranes",
    label: "Albaranes",
    moduleId: "albaranes",
    defaultAllowed: true,
  },
  {
    key: "articulos",
    label: "Artículos",
    moduleId: "articulos",
    defaultAllowed: true,
  },
  {
    key: "proveedores",
    label: "Proveedores",
    moduleId: "proveedores",
    defaultAllowed: true,
  },
  {
    key: "almacenes",
    label: "Stock",
    moduleId: "almacenes",
    defaultAllowed: true,
  },
  {
    key: "escandallos",
    label: "Escandallos",
    moduleId: "escandallos",
    defaultAllowed: true,
  },
  {
    key: "historico-precios",
    label: "Histórico de precios",
    defaultAllowed: true,
  },

  // ── APPCC ───────────────────────────────────────────────────────────────
  { key: "appcc", label: "APPCC", moduleId: "appcc", defaultAllowed: true },
  {
    key: "allergens",
    label: "Alérgenos",
    moduleId: "allergens",
    defaultAllowed: true,
  },

  // ── Contenido ───────────────────────────────────────────────────────────
  { key: "menus", label: "Menús", moduleId: "menus", defaultAllowed: true },
  {
    key: "digital-menu",
    label: "Menú digital",
    moduleId: "digital-menu",
    defaultAllowed: true,
  },
  {
    key: "conocimiento",
    label: "Wiki",
    moduleId: "conocimiento",
    defaultAllowed: true,
  },

  // ── Herramientas ────────────────────────────────────────────────────────
  {
    key: "asistente-ia",
    label: "Asistente IA",
    moduleId: "asistente-ia",
    defaultAllowed: true,
  },
  { key: "sprint", label: "Sprint", defaultAllowed: true },
  { key: "papelera", label: "Papelera", defaultAllowed: true },
  { key: "backups", label: "Copias de seguridad", defaultAllowed: true },
];

/** Roles whose access is configurable. ADMIN and above always see everything. */
export const ROLE_ACCESS_ROLES = ["USER", "VIEWER"] as const;
export type RoleAccessRole = (typeof ROLE_ACCESS_ROLES)[number];

/** Roles that bypass all section gating. */
export const SECTION_BYPASS_ROLES = ["SUPERADMIN", "OWNER", "ADMIN"];

export const SECTION_KEYS: ReadonlySet<string> = new Set(
  SECTION_REGISTRY.map((s) => s.key),
);

export function findSection(key: string): SectionDefinition | undefined {
  return SECTION_REGISTRY.find((s) => s.key === key);
}

export function isRoleAccessRole(role: string): role is RoleAccessRole {
  return (ROLE_ACCESS_ROLES as readonly string[]).includes(role);
}
