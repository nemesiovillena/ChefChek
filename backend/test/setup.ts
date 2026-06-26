import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

jest.setTimeout(30000);

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
