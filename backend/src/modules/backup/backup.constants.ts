/**
 * Constantes del módulo de copias de seguridad.
 *
 * El backup es genérico sobre las tablas físicas de `public` (descubiertas en
 * runtime por {@link BackupIntrospectionService}), pero el **scoping por tenant**
 * necesita reglas explícitas: las tablas hijas (sin columna `tenantId`) se filtran
 * a través de su padre tenant-rooted, y la tabla join implícita de Prisma
 * (`_SprintToTeamMember`) tiene un tratamiento especial. Sin estas reglas, un
 * backup por tenant perdería filas hijas o la asociación Sprint↔TeamMember.
 */

/** Versión del formato de copia. Bump manual ante un cambio incompatible del
 *  schema; la restauración rechaza copias con versión superior a la actual. */
export const BACKUP_SCHEMA_VERSION = 1;

/** Tablas NUNCA respaldadas (transitorias o auto-referencia). */
export const EXCLUDED_TABLES = new Set<string>([
  "sessions", // sesiones de auth: transitorias, contienen tokens
  "backups", // auto-referencia: el historial de copias no se respalda a sí mismo
  "_prisma_migrations", // metadatos de migraciones de Prisma
]);

/**
 * Tablas de catálogo/raíz que SÓLO aparecen en copias GLOBALES (SUPERADMIN):
 *  - `tenants`: la identidad del tenant; borrarla en un restore por tenant
 *    cascadería todos sus datos y rompería la sesión activa.
 *  - `allergens`: catálogo global compartido (UE 1169/2011), idéntico en todos.
 */
export const GLOBAL_ONLY_TABLES = new Set<string>(["tenants", "allergens"]);

/**
 * Reglas de scope para tablas hijas (sin `tenantId`): cada entrada es una CADENA
 * de saltos (child → ... → tabla con `tenantId`). El builder anida subqueries
 * `IN (SELECT id FROM "<parent>" WHERE "<nextCol>" IN (...))` hasta la tabla
 * tenant-rooted. Esto es necesario porque algunas hijas cuelgan de otra hija
 * (p. ej. menu_section_items → menu_sections → menus, y menu_sections tampoco
 * tiene tenantId). Las tablas con `tenantId` se scopean automáticamente.
 */
export const CHILD_SCOPE_RULES: Record<
  string,
  { parent: string; col: string }[]
> = {
  purchase_formats: [{ parent: "products", col: "productId" }],
  nutritional_info: [{ parent: "products", col: "productId" }],
  recipe_ingredients: [{ parent: "recipes", col: "recipeId" }],
  recipe_sub_recipes: [{ parent: "recipes", col: "parentRecipeId" }],
  recipe_translations: [{ parent: "recipes", col: "recipeId" }],
  recipe_categories: [{ parent: "recipes", col: "recipeId" }],
  stock_movements: [{ parent: "products", col: "productId" }],
  temperature_measurements: [
    { parent: "temperature_controls", col: "controlId" },
  ],
  cleaning_tasks: [{ parent: "cleaning_plans", col: "planId" }],
  progress_trackings: [{ parent: "work_batches", col: "workBatchId" }],
  mise_en_place_items: [{ parent: "mise_en_place_sheets", col: "sheetId" }],
  inventory_items: [{ parent: "inventories", col: "inventoryId" }],
  knowledge_versions: [{ parent: "knowledge_articles", col: "articleId" }],
  knowledge_article_tags: [{ parent: "knowledge_articles", col: "articleId" }],
  menu_translations: [{ parent: "menus", col: "menuId" }],
  menu_analytics: [{ parent: "menus", col: "menuId" }],
  menu_sections: [{ parent: "menus", col: "menuId" }],
  // menu_sections no tiene tenantId -> encadenar hasta menus.
  menu_section_items: [
    { parent: "menu_sections", col: "sectionId" },
    { parent: "menus", col: "menuId" },
  ],
  menu_items: [{ parent: "menus", col: "menuId" }],
  // menu_scans -> digital_menu_configs (tenant-rooted).
  menu_scans: [{ parent: "digital_menu_configs", col: "digitalMenuId" }],
  extracted_products: [{ parent: "documents", col: "documentId" }],
  albaran_lines: [{ parent: "albaranes", col: "albaranId" }],
  notifications: [{ parent: "tasks", col: "taskId" }],
};

/**
 * Tabla join implícita (m-n) de Prisma Sprint↔TeamMember. Columnas `A`(→sprints)
 * y `B`(→team_members). Se scopea por el lado Sprint (tenant-rooted). Caso
 * especial porque no hay modelo Prisma ni `tenantId`.
 */
export const IMPLICIT_JOIN_TABLES: Record<
  string,
  { scopeCol: string; parent: string }
> = {
  _SprintToTeamMember: { scopeCol: "A", parent: "sprints" },
};

/** Directorio (relativo a process.cwd()) donde se escriben los archivos .json. */
export const BACKUP_DIR = "uploads/backups";
