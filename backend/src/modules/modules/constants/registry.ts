/**
 * Module Registry
 *
 * Centralized definition of all available modules with their metadata.
 * Used by ModulesService to provide module information and validate operations.
 */

export interface ModuleDefinition {
  /** Technical identifier (used in config keys: `modules.{id}.enabled`) */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** User-friendly description */
  description: string;
  /** Module IDs that must be active for this module to work */
  dependencies: string[];
  /** If true, this module cannot be disabled */
  alwaysActive: boolean;
  /** Default activation state for new tenants */
  defaultEnabled: boolean;
}

/**
 * All available modules in the application.
 * Core module is always active and cannot be disabled.
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: "core",
    name: "Core",
    description:
      "Funcionalidad base: autenticación, tenants y características fundamentales",
    dependencies: [],
    alwaysActive: true,
    defaultEnabled: true,
  },
  {
    id: "articulos",
    name: "Artículos",
    description: "Catálogo de productos y gestión de artículos",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "categories",
    name: "Categorías",
    description: "Gestión de categorías jerárquicas para productos",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "recipes",
    name: "Recetas",
    description: "Gestión de recetas y fichas técnicas",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "menus",
    name: "Menús",
    description: "Planificación y gestión de menús",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "escandallos",
    name: "Escandallos",
    description: "Cálculo de costes de recetas y escandallos",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "almacenes",
    name: "Almacenes",
    description: "Gestión de almacenes e inventario",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "production",
    name: "Producción",
    description: "Planificación y ejecución de producción",
    dependencies: ["almacenes"],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "sala",
    name: "Equipo",
    description: "Gestión de equipo y producción en sala",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "seguridad",
    name: "Seguridad",
    description: "Control de alérgenos, APPCC y seguridad alimentaria",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "appcc",
    name: "APPCC",
    description: "Sistema de Análisis de Peligros y Puntos de Control Crítico",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "allergens",
    name: "Alérgenos",
    description: "Gestión de información de alérgenos",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "digital-menu",
    name: "Menú Digital",
    description: "Menús digitales y códigos QR",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "albaranes",
    name: "Albaranes",
    description: "Gestión de albaranes de proveedores",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "compras",
    name: "Compras",
    description:
      "Pedidos y compras a proveedores: listas, envío, precios y analítica",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "proveedores",
    name: "Proveedores",
    description:
      "Gestión de proveedores: datos fiscales, contacto, condiciones y productos asociados",
    dependencies: ["articulos"],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "conocimiento",
    name: "Conocimiento",
    description: "Base de conocimiento y documentación",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "qr",
    name: "Códigos QR",
    description: "Generación y gestión de códigos QR",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
  {
    id: "technical-sheets",
    name: "Fichas Técnicas",
    description: "Gestión de fichas técnicas",
    dependencies: [],
    alwaysActive: false,
    defaultEnabled: true,
  },
];

/**
 * Find a module by ID.
 */
export function findModule(id: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

/**
 * Get modules that depend on the given module ID.
 */
export function getDependentModules(moduleId: string): ModuleDefinition[] {
  return MODULE_REGISTRY.filter((m) => m.dependencies.includes(moduleId));
}
