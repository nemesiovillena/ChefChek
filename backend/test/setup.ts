import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

jest.setTimeout(30000);

/**
 * Los e2e crean y borran datos de verdad (deleteMany, TRUNCATE con DB_CLEAN).
 * `.env.test` no se versiona: si falta, el proceso caía en silencio a `.env`
 * (la BD de desarrollo) y una limpieza con un `tenantId` sin definir dejó a
 * todo el catálogo real soft-borrado. Por eso un e2e solo arranca contra una
 * base cuyo nombre termina en `_test`.
 */
function assertIsolatedTestDatabase(): void {
  const raw = process.env.DATABASE_URL;
  let dbName = "";
  try {
    dbName = raw ? new URL(raw).pathname.replace(/^\//, "") : "";
  } catch {
    // URL ilegible: se trata como no aislada.
  }
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Los tests e2e solo pueden correr contra una base de datos aislada ` +
        `(nombre terminado en "_test"), pero DATABASE_URL apunta a ` +
        `"${dbName || "(sin definir)"}". Crea backend/.env.test con ` +
        `DATABASE_URL de una base de test y aplica las migraciones ` +
        `(prisma migrate deploy).`,
    );
  }
}

const isE2eFile = /\.e2e-spec\.ts$/.test(expect.getState().testPath ?? "");
if (isE2eFile || process.env.DB_CLEAN === "true") {
  assertIsolatedTestDatabase();
}

// Only connect to real DB for E2E tests (when DB_CLEAN=true)
if (process.env.DB_CLEAN === "true") {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  // Clean slate ONCE per test file, before the spec seeds its own data.
  // Cleaning in beforeEach would wipe the tenant/user each spec seeds in its
  // beforeAll, breaking every authenticated test.
  beforeAll(async () => {
    const tablesToClean = [
      "menu_scans",
      "extracted_products",
      "telegram_bots",
      "documents",
      "knowledge_article_tags",
      "knowledge_versions",
      "knowledge_articles",
      "knowledge_tags",
      "knowledge_categories",
      "dashboard_alerts",
      "dashboard_metrics",
      "menu_section_items",
      "menu_sections",
      "menu_items",
      "menu_translations",
      "menu_analytics",
      "menus",
      "digital_menu_configs",
      "recipe_sub_recipes",
      "recipe_ingredients",
      "recipe_translations",
      "recipes",
      "stock_movements",
      "stocks",
      "inventories",
      "inventory_items",
      "unit_conversions",
      "products",
      "categories",
      "suppliers",
      "tasks",
      "team_members",
      "sessions",
      "users",
      "tenants",
    ];

    for (const table of tablesToClean) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch {
        // Table might not exist, ignore
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}
