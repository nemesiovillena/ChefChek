import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Coherent multi-module seed for ChefChek.
 *
 * Strategy: RESET by default (TRUNCATE all tenant tables CASCADE, then create).
 * Idempotency comes from the reset, not upsert — many models (Product,
 * RecipeIngredient, StockMovement...) have no natural unique business key.
 * Pass `--no-reset` to skip truncation (best-effort; may collide on uniques).
 *
 * Layers (dependency order, each only references earlier layers):
 *  L0 tenant + 2nd empty tenant (isolation) + users + categories (articles+recipes)
 *  L1 suppliers → products (+nutritional, purchaseFormat) → stock + warehouse
 *  L2 recipes (+ingredients→products, sub-recipes, categories, translations)
 *  L3 menus (+sections→recipes, items, translations, analytics)
 *  L9 sprint + tasks + teamMember + notifications
 *
 * Remaining modules (albaranes, warehouse movements, production, APPCC, wiki,
 * digital-menu, QR) are added in later iterations — see plans/ seed roadmap.
 */

const prisma = new PrismaClient();
const RESET = !process.argv.includes("--no-reset");

/** Anchor date for a coherent one-week timeline (Mon of current week). */
const baseDate = new Date();
baseDate.setHours(9, 0, 0, 0);
const day = baseDate.getDay() || 7; // 1..7 (Mon..Sun)
const monday = new Date(baseDate);
monday.setDate(baseDate.getDate() - (day - 1));
const iso = (offsetDays: number) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + offsetDays);
  return d;
};

async function reset() {
  console.log("🧹 Reset: truncating all tenant tables...");
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`,
  );
  console.log(`   truncated ${tables.length} tables`);
}

async function main() {
  console.log("🌱 Starting coherent multi-module seed...");
  if (RESET) await reset();

  // ── L0: tenants ───────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: "Bistró ChefChek",
      slug: "chefchek-demo",
      domain: "demo.chefchek.local",
      isActive: true,
    },
  });
  // Second tenant, intentionally empty — for tenant-isolation e2e.
  await prisma.tenant.create({
    data: { name: "Otro Restaurante", slug: "otro-restaurante", isActive: true },
  });
  console.log(`✅ Tenant demo + empty isolation tenant`);

  // ── L0: users ─────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@chefchek.local",
      passwordHash: hash,
      name: "Admin User",
      role: "ADMIN",
      isActive: true,
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "chef@chefchek.local",
      passwordHash: await bcrypt.hash("chef123", 10),
      name: "Marcus V.",
      role: "USER",
      isActive: true,
    },
  });
  console.log("✅ 2 users (admin + chef)");

  // ── L0: article categories (7 parents + subcategories) ────────────────
  const parents = [
    { name: "Alimentación", slug: "alimentacion", description: "Productos alimentarios no congelados", sortOrder: 1 },
    { name: "Congelados", slug: "congelados", description: "Productos congelados", sortOrder: 2 },
    { name: "Alcoholes", slug: "alcoholes", description: "Bebidas alcohólicas", sortOrder: 3 },
    { name: "Bebidas no alcohólicas", slug: "bebidas-no-alcoholicas", description: "Refrescos, zumos, aguas e infusiones", sortOrder: 4 },
    { name: "Limpieza", slug: "limpieza", description: "Limpieza y desinfección", sortOrder: 5 },
    { name: "Desechables", slug: "desechables", description: "Material desechable y embalaje", sortOrder: 6 },
    { name: "Utensilios", slug: "utensilios", description: "Utensilios de cocina y sala", sortOrder: 7 },
  ];
  const parentBySlug: Record<string, string> = {};
  for (const p of parents) {
    const c = await prisma.category.create({
      data: { tenantId: tenant.id, name: p.name, slug: p.slug, description: p.description, context: "articles", sortOrder: p.sortOrder, isActive: true },
    });
    parentBySlug[p.slug] = c.id;
  }

  const subs: { name: string; slug: string; description: string; parent: string; sortOrder: number }[] = [
    { name: "Aceite", slug: "aceite", description: "Aceites y grasas", parent: "alimentacion", sortOrder: 1 },
    { name: "Lácteos", slug: "lacteos", description: "Leche, queso, yogur", parent: "alimentacion", sortOrder: 2 },
    { name: "Pan", slug: "pan", description: "Pan, bollería y masas", parent: "alimentacion", sortOrder: 3 },
    { name: "Arroz y Pasta", slug: "arroz-pasta", description: "Arroces, pastas y cereales", parent: "alimentacion", sortOrder: 4 },
    { name: "Condimentos", slug: "condimentos", description: "Especias, hierbas y salsas", parent: "alimentacion", sortOrder: 5 },
    { name: "Verduras", slug: "verduras", description: "Verduras y hortalizas frescas", parent: "alimentacion", sortOrder: 6 },
    { name: "Pescado", slug: "pescado-congelado", description: "Pescado y marisco congelado", parent: "congelados", sortOrder: 1 },
    { name: "Carne", slug: "carne-congelada", description: "Carne congelada", parent: "congelados", sortOrder: 2 },
    { name: "Vino", slug: "vino", description: "Vinos tintos, blancos y rosados", parent: "alcoholes", sortOrder: 1 },
    { name: "Cerveza", slug: "cerveza", description: "Cervezas y lagers", parent: "alcoholes", sortOrder: 2 },
  ];
  const subBySlug: Record<string, string> = {};
  for (const s of subs) {
    const c = await prisma.category.create({
      data: { tenantId: tenant.id, name: s.name, slug: s.slug, description: s.description, context: "articles", parentId: parentBySlug[s.parent], sortOrder: s.sortOrder, isActive: true },
    });
    subBySlug[s.slug] = c.id;
  }
  console.log(`✅ ${parents.length} parent + ${subs.length} sub article categories`);

  // ── L0: recipe categories ─────────────────────────────────────────────
  const recipeCats = [
    { name: "Aperitivos", slug: "aperitivos", icon: "🍤", color: "#FF9800", sortOrder: 10 },
    { name: "Arroces", slug: "arroces", icon: "🍚", color: "#8BC34A", sortOrder: 11 },
    { name: "Pescados", slug: "pescados", icon: "🐟", color: "#2196F3", sortOrder: 12 },
    { name: "Carnes", slug: "carnes-recetas", icon: "🥩", color: "#F44336", sortOrder: 13 },
    { name: "Pasta", slug: "pasta", icon: "🍝", color: "#FF5722", sortOrder: 14 },
    { name: "Postres", slug: "postres", icon: "🍰", color: "#E91E63", sortOrder: 15 },
  ];
  const recipeCatBySlug: Record<string, string> = {};
  for (const rc of recipeCats) {
    const c = await prisma.category.create({
      data: { tenantId: tenant.id, name: rc.name, slug: rc.slug, context: "recipes", icon: rc.icon, color: rc.color, sortOrder: rc.sortOrder, isActive: true },
    });
    recipeCatBySlug[rc.slug] = c.id;
  }
  console.log(`✅ ${recipeCats.length} recipe categories`);

  // ── L1: suppliers ─────────────────────────────────────────────────────
  const supplierDefs = [
    { name: "Proveedor Local S.L.", cifNif: "B12345678", contactPerson: "Juan Pérez", email: "juan@proveedorlocal.com", phone: "+34 600 123 456", averageDeliveryTime: 2, reliabilityScore: 90, priceTier: "MEDIUM", preferredStatus: "PREFERRED", orderMethods: ["EMAIL", "PHONE"] },
    { name: "Arrocerías del Sur", cifNif: "B23456789", contactPerson: "María García", email: "maria@arrocerias.com", phone: "+34 600 789 012", averageDeliveryTime: 3, reliabilityScore: 85, priceTier: "MEDIUM", preferredStatus: "PREFERRED", orderMethods: ["EMAIL"] },
    { name: "Carnicerías Premium", cifNif: "B34567890", contactPerson: "Carlos López", email: "carlos@carniceriaspremium.com", phone: "+34 600 345 678", averageDeliveryTime: 1, reliabilityScore: 95, priceTier: "HIGH", preferredStatus: "PREFERRED", orderMethods: ["PHONE", "EMAIL"] },
    { name: "Oliva del Mediterráneo", cifNif: "B45678901", contactPerson: "Ana Martínez", email: "ana@olivamediterraneo.com", phone: "+34 600 901 234", averageDeliveryTime: 4, reliabilityScore: 88, priceTier: "MEDIUM", preferredStatus: "ALTERNATIVE", orderMethods: ["EMAIL", "WEB"] },
    { name: "Pescaderías Mar Azul", cifNif: "B56789012", contactPerson: "Pedro Sánchez", email: "pedro@marazul.com", phone: "+34 600 567 890", averageDeliveryTime: 1, reliabilityScore: 92, priceTier: "HIGH", preferredStatus: "PREFERRED", orderMethods: ["PHONE"] },
  ];
  const suppliers = await Promise.all(
    supplierDefs.map((s) =>
      prisma.supplier.create({ data: { tenantId: tenant.id, isActive: true, ...s } }),
    ),
  );
  const supplierByName = Object.fromEntries(suppliers.map((s, i) => [supplierDefs[i].name, s.id]));
  console.log(`✅ ${suppliers.length} suppliers`);

  // ── L1: products (+ nutritional + purchaseFormat) ─────────────────────
  type ProductDef = {
    name: string; description: string; cat: string; supplier: string;
    purchaseFormat: string; referenceUnit: string; unitsPerFormat: number;
    referenceUnitSize: number; purchasePrice: number; netPrice: number;
    profitMargin: number; waste: number; yieldFactor: number; allergens: number[];
    brand?: string; barcode?: string; nutritional?: { energyKcal: number; protein: number; fat: number; carbohydrates: number; salt: number };
    altFormat?: { name: string; format: string; price: number };
  };
  const productDefs: ProductDef[] = [
    { name: "Tomate Pera", description: "Tomate fresco de huerta", cat: "verduras", supplier: "Proveedor Local S.L.", purchaseFormat: "Caja 10kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 10, purchasePrice: 1.8, netPrice: 1.98, profitMargin: 10, waste: 5, yieldFactor: 0.95, allergens: [], nutritional: { energyKcal: 18, protein: 0.9, fat: 0.2, carbohydrates: 3.9, salt: 0.005 } },
    { name: "Arroz Bomba", description: "Arroz D.O. para paellas", cat: "arroz-pasta", supplier: "Arrocerías del Sur", purchaseFormat: "Saco 25kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 25, purchasePrice: 1.8, netPrice: 1.93, profitMargin: 7, waste: 3, yieldFactor: 0.97, allergens: [], altFormat: { name: "Paquete 1kg", format: "1kg", price: 2.5 }, nutritional: { energyKcal: 130, protein: 2.7, fat: 0.3, carbohydrates: 28, salt: 0.0 } },
    { name: "Pollo de Corral", description: "Pollo fresco de granja", cat: "carne-congelada", supplier: "Carnicerías Premium", purchaseFormat: "Caja 20kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 20, purchasePrice: 3.25, netPrice: 3.48, profitMargin: 7, waste: 8, yieldFactor: 0.92, allergens: [], nutritional: { energyKcal: 165, protein: 31, fat: 3.6, carbohydrates: 0, salt: 0.1 } },
    { name: "Aceite de Oliva Virgen Extra", description: "AOVE primera presión en frío", cat: "aceite", supplier: "Oliva del Mediterráneo", purchaseFormat: "Garrafa 5L", referenceUnit: "L", unitsPerFormat: 1, referenceUnitSize: 5, purchasePrice: 7.6, netPrice: 8.13, profitMargin: 7, waste: 2, yieldFactor: 0.98, allergens: [], barcode: "8412345000017" },
    { name: "Azafrán en Hebras", description: "Azafrán D.O. La Mancha", cat: "condimentos", supplier: "Proveedor Local S.L.", purchaseFormat: "Estuche 1g", referenceUnit: "g", unitsPerFormat: 1, referenceUnitSize: 1, purchasePrice: 12.0, netPrice: 13.2, profitMargin: 10, waste: 1, yieldFactor: 0.99, allergens: [] },
    { name: "Lomo de Salmón", description: "Salmón noruego congelado", cat: "pescado-congelado", supplier: "Pescaderías Mar Azul", purchaseFormat: "Caja 10kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 10, purchasePrice: 14.5, netPrice: 15.52, profitMargin: 7, waste: 10, yieldFactor: 0.9, allergens: [4], nutritional: { energyKcal: 208, protein: 20, fat: 13, carbohydrates: 0, salt: 0.05 } },
    { name: "Cebolla", description: "Cebolla dulce", cat: "verduras", supplier: "Proveedor Local S.L.", purchaseFormat: "Saco 25kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 25, purchasePrice: 0.7, netPrice: 0.77, profitMargin: 10, waste: 8, yieldFactor: 0.9, allergens: [] },
    { name: "Vino Tinto Rioja", description: "Crianza D.O.Ca. Rioja", cat: "vino", supplier: "Proveedor Local S.L.", purchaseFormat: "Caja 6x75cl", referenceUnit: "L", unitsPerFormat: 6, referenceUnitSize: 0.75, purchasePrice: 4.2, netPrice: 4.5, profitMargin: 7, waste: 0, yieldFactor: 1, allergens: [12], barcode: "8412345000024", altFormat: { name: "Botella 75cl", format: "75cl", price: 6.5 } },
    { name: "Queso Manchego", description: "Queso curado D.O. La Mancha", cat: "lacteos", supplier: "Proveedor Local S.L.", purchaseFormat: "Pieza 3kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 3, purchasePrice: 14.0, netPrice: 15.4, profitMargin: 10, waste: 5, yieldFactor: 0.95, allergens: [7], nutritional: { energyKcal: 402, protein: 25, fat: 33, carbohydrates: 1, salt: 1.8 } },
    { name: "Pasta Spaghetti", description: "Sémola de trigo duro", cat: "arroz-pasta", supplier: "Arrocerías del Sur", purchaseFormat: "Paquete 5kg", referenceUnit: "kg", unitsPerFormat: 1, referenceUnitSize: 5, purchasePrice: 1.2, netPrice: 1.28, profitMargin: 7, waste: 2, yieldFactor: 1, allergens: [1], nutritional: { energyKcal: 158, protein: 5.8, fat: 0.9, carbohydrates: 31, salt: 0.0 } },
  ];
  const productByName: Record<string, string> = {};
  for (const p of productDefs) {
    const prod = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        description: p.description,
        categoryId: subBySlug[p.cat],
        supplierId: supplierByName[p.supplier],
        purchaseFormat: p.purchaseFormat,
        referenceUnit: p.referenceUnit,
        unitsPerFormat: p.unitsPerFormat,
        referenceUnitSize: p.referenceUnitSize,
        unitSize: p.unitsPerFormat * p.referenceUnitSize,
        purchasePrice: p.purchasePrice,
        netPrice: p.netPrice,
        profitMargin: p.profitMargin,
        wastePercentage: p.waste,
        yieldFactor: p.yieldFactor,
        allergens: p.allergens,
        brand: p.brand,
        barcode: p.barcode,
        isActive: true,
      },
    });
    productByName[p.name] = prod.id;
    if (p.nutritional) {
      await prisma.nutritionalInfo.create({
        data: { productId: prod.id, energyKcal: p.nutritional.energyKcal, protein: p.nutritional.protein, fat: p.nutritional.fat, carbohydrates: p.nutritional.carbohydrates, salt: p.nutritional.salt },
      });
    }
    if (p.altFormat) {
      await prisma.purchaseFormat.create({
        data: { productId: prod.id, name: p.altFormat.name, format: p.altFormat.format, price: p.altFormat.price },
      });
    }
  }
  console.log(`✅ ${productDefs.length} products (+nutritional +purchaseFormat)`);

  // ── L1: warehouse + stock ─────────────────────────────────────────────
  const warehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, name: "Almacén Principal", location: "Cocina - zona fría", capacity: 1000, isActive: true },
  });
  const stockDefs: { product: string; quantity: number; minimum: number; reorder: number }[] = [
    { product: "Tomate Pera", quantity: 18, minimum: 5, reorder: 10 },
    { product: "Arroz Bomba", quantity: 40, minimum: 10, reorder: 20 },
    { product: "Pollo de Corral", quantity: 6, minimum: 8, reorder: 15 }, // bajo → alerta
    { product: "Aceite de Oliva Virgen Extra", quantity: 12, minimum: 4, reorder: 8 },
    { product: "Azafrán en Hebras", quantity: 8, minimum: 2, reorder: 5 },
    { product: "Lomo de Salmón", quantity: 9, minimum: 4, reorder: 8 },
    { product: "Cebolla", quantity: 22, minimum: 5, reorder: 15 },
    { product: "Vino Tinto Rioja", quantity: 14, minimum: 6, reorder: 12 },
    { product: "Queso Manchego", quantity: 3, minimum: 2, reorder: 4 },
    { product: "Pasta Spaghetti", quantity: 6, minimum: 4, reorder: 10 }, // bajo → alerta
  ];
  for (const s of stockDefs) {
    await prisma.stock.create({
      data: { tenantId: tenant.id, productId: productByName[s.product], warehouseId: warehouse.id, quantity: s.quantity, minimumStock: s.minimum, reorderLevel: s.reorder, maximumStock: s.reorder * 3 },
    });
  }
  console.log(`✅ warehouse + ${stockDefs.length} stocks`);

  // ── L2: recipes (+ingredients, sub-recipes, categories, translations) ──
  type RecipeDef = {
    name: string; description: string; portions: number; portionSize: number;
    cost: number; costPerUnit: number; categories: string[]; allergens: number[];
    ingredients: { product: string; quantity: number; unit: string }[];
    translation?: { language: string; name: string; description: string };
  };
  const recipeDefs: RecipeDef[] = [
    {
      name: "Paella Valenciana", description: "Paella tradicional con pollo y verduras", portions: 8, portionSize: 250, cost: 15.8, costPerUnit: 2.1, categories: ["arroces", "carnes-recetas"], allergens: [],
      ingredients: [
        { product: "Arroz Bomba", quantity: 500, unit: "g" },
        { product: "Pollo de Corral", quantity: 300, unit: "g" },
        { product: "Aceite de Oliva Virgen Extra", quantity: 50, unit: "ml" },
        { product: "Azafrán en Hebras", quantity: 0.1, unit: "g" },
        { product: "Tomate Pera", quantity: 200, unit: "g" },
      ],
      translation: { language: "en", name: "Valencian Paella", description: "Traditional paella with chicken and vegetables" },
    },
    {
      name: "Salmón a la Plancha", description: "Lomo de salmón con aceite de oliva", portions: 4, portionSize: 180, cost: 9.2, costPerUnit: 2.3, categories: ["pescados"], allergens: [4],
      ingredients: [
        { product: "Lomo de Salmón", quantity: 720, unit: "g" },
        { product: "Aceite de Oliva Virgen Extra", quantity: 30, unit: "ml" },
      ],
      translation: { language: "en", name: "Grilled Salmon", description: "Salmon fillet with olive oil" },
    },
    {
      name: "Spaghetti al Tomate", description: "Pasta con salsa de tomate fresco", portions: 4, portionSize: 300, cost: 4.5, costPerUnit: 1.13, categories: ["pasta"], allergens: [1],
      ingredients: [
        { product: "Pasta Spaghetti", quantity: 400, unit: "g" },
        { product: "Tomate Pera", quantity: 500, unit: "g" },
        { product: "Aceite de Oliva Virgen Extra", quantity: 30, unit: "ml" },
        { product: "Cebolla", quantity: 100, unit: "g" },
      ],
    },
    {
      name: "Tabla de Queso Manchego", description: "Queso curado con aceite de oliva", portions: 6, portionSize: 80, cost: 6.0, costPerUnit: 1.0, categories: ["aperitivos"], allergens: [7],
      ingredients: [
        { product: "Queso Manchego", quantity: 480, unit: "g" },
        { product: "Aceite de Oliva Virgen Extra", quantity: 20, unit: "ml" },
      ],
    },
  ];
  const recipeByName: Record<string, string> = {};
  for (const r of recipeDefs) {
    const rec = await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        name: r.name,
        description: r.description,
        elaboration: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Elaboración de ${r.name}.` }] }] }),
        totalCost: r.cost,
        totalCostPerUnit: r.costPerUnit,
        portions: r.portions,
        portionSize: r.portionSize,
        version: 1,
        isActive: true,
        isPublic: true,
        allergens: r.allergens,
      },
    });
    recipeByName[r.name] = rec.id;
    for (const ing of r.ingredients) {
      await prisma.recipeIngredient.create({
        data: { recipeId: rec.id, productId: productByName[ing.product], quantity: ing.quantity, unit: ing.unit },
      });
    }
    for (const cat of r.categories) {
      await prisma.recipeCategory.create({ data: { recipeId: rec.id, categoryId: recipeCatBySlug[cat] } });
    }
    if (r.translation) {
      await prisma.recipeTranslation.create({
        data: { recipeId: rec.id, language: r.translation.language, name: r.translation.name, description: r.translation.description },
      });
    }
  }
  console.log(`✅ ${recipeDefs.length} recipes (+ingredients +categories +translations)`);

  // ── L3: menus (+sections, section items, translations, analytics) ─────
  const menu = await prisma.menu.create({
    data: {
      tenantId: tenant.id,
      name: "Menú de Temporada",
      description: "Selección de platos de la semana",
      slug: "menu-temporada",
      startDate: iso(0),
      endDate: iso(6),
      portions: 50,
      totalCost: 35.5,
      totalPrice: 89.0,
      totalMargin: 60.0,
      isActive: true,
      allergens: [1, 4, 7],
    },
  });
  const sections = [
    { name: "Entrantes", sortOrder: 1, items: [{ recipe: "Tabla de Queso Manchego", price: 9.5, cost: 3.0 }] },
    { name: "Principales", sortOrder: 2, items: [
      { recipe: "Paella Valenciana", price: 14.5, cost: 6.3 },
      { recipe: "Salmón a la Plancha", price: 16.0, cost: 4.6 },
      { recipe: "Spaghetti al Tomate", price: 9.0, cost: 2.3 },
    ] },
  ];
  for (const s of sections) {
    const sec = await prisma.menuSection.create({
      data: { menuId: menu.id, name: s.name, sortOrder: s.sortOrder, isActive: true },
    });
    for (const [i, it] of s.items.entries()) {
      await prisma.menuSectionItem.create({
        data: { sectionId: sec.id, recipeId: recipeByName[it.recipe], order: i + 1, price: it.price, cost: it.cost, margin: it.price - it.cost, isAvailable: true },
      });
    }
  }
  // Flat MenuItem entries (legacy single-category list)
  await prisma.menuItem.create({
    data: { menuId: menu.id, recipeId: recipeByName["Paella Valenciana"], category: "PRINCIPALES", sortOrder: 1, price: 14.5, cost: 6.3, margin: 8.2, isActive: true },
  });
  await prisma.menuTranslation.create({
    data: { menuId: menu.id, language: "en", title: "Seasonal Menu", name: "Seasonal Menu", description: "Week's selection of dishes" },
  });
  // Analytics: a few scans/views across the week
  for (let d = 0; d < 5; d++) {
    await prisma.menuAnalytics.create({ data: { menuId: menu.id, type: "view", viewedAt: iso(d), metadata: { source: "qr" } } });
  }
  console.log("✅ menu (+sections +items +translation +analytics)");

  // ── L4: albaranes (+lines, goods reception, invoice, purchase order) ──
  // Albaran 1: CONFIRMADO — Proveedor Local, lines matched (Tomate + Cebolla)
  const alb1Lines = [
    { desc: "Tomate Pera 10kg", product: "Tomate Pera", qty: 2, unit: "Caja 10kg", price: 18.0, vat: 10 },
    { desc: "Cebolla 25kg", product: "Cebolla", qty: 1, unit: "Saco 25kg", price: 17.5, vat: 10 },
  ];
  const base1 = alb1Lines.reduce((s, l) => s + l.qty * l.price, 0);
  const albaran1 = await prisma.albaran.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplierByName["Proveedor Local S.L."],
      internalNumber: "ALB-2026-001",
      albaranNumber: "PL-9871",
      date: iso(-2),
      base: base1,
      vatTotal: base1 * 0.1,
      total: base1 * 1.1,
      grossAmount: base1,
      vatBreakdown: [{ rate: 10, base: base1, amount: base1 * 0.1 }],
      status: "CONFIRMADO",
      originalFileUrl: "/uploads/albaranes/alb-001.pdf",
      ocrConfidence: 0.96,
      warehouseId: warehouse.id,
      createdBy: admin.id,
    },
  });
  for (const l of alb1Lines) {
    const lineAmount = l.qty * l.price;
    await prisma.albaranLine.create({
      data: {
        albaranId: albaran1.id,
        description: l.desc,
        quantity: l.qty,
        unit: l.unit,
        unitPrice: l.price,
        vatPercent: l.vat,
        priceWithVat: l.price * (1 + l.vat / 100),
        lineAmount,
        matchStatus: "MATCH_ALTO",
        lineStatus: "CONFIRMADO",
        matchedProductId: productByName[l.product],
        confidence: 0.95,
      },
    });
    // Stock entrance from confirmed albaran
    await prisma.stockMovement.create({
      data: { productId: productByName[l.product], warehouseId: warehouse.id, type: "ENTRANCE", quantity: l.qty, unit: l.unit, reason: `Albarán ${albaran1.internalNumber}` },
    });
  }

  // Albaran 2: CONFIRMADO — Carnicería, line matched (Pollo)
  const base2 = 1 * 65.0;
  const albaran2 = await prisma.albaran.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplierByName["Carnicerías Premium"],
      internalNumber: "ALB-2026-002",
      albaranNumber: "CP-3321",
      date: iso(-1),
      base: base2,
      vatTotal: base2 * 0.1,
      total: base2 * 1.1,
      grossAmount: base2,
      vatBreakdown: [{ rate: 10, base: base2, amount: base2 * 0.1 }],
      status: "CONFIRMADO",
      originalFileUrl: "/uploads/albaranes/alb-002.pdf",
      ocrConfidence: 0.93,
      warehouseId: warehouse.id,
      createdBy: admin.id,
    },
  });
  await prisma.albaranLine.create({
    data: {
      albaranId: albaran2.id,
      description: "Pollo de Corral 20kg",
      quantity: 1,
      unit: "Caja 20kg",
      unitPrice: 65.0,
      vatPercent: 10,
      priceWithVat: 71.5,
      lineAmount: 65.0,
      matchStatus: "MATCH_ALTO",
      lineStatus: "CONFIRMADO",
      matchedProductId: productByName["Pollo de Corral"],
      confidence: 0.91,
    },
  });
  await prisma.stockMovement.create({
    data: { productId: productByName["Pollo de Corral"], warehouseId: warehouse.id, type: "ENTRANCE", quantity: 20, unit: "kg", reason: `Albarán ${albaran2.internalNumber}` },
  });

  // Albaran 3: PENDIENTE OCR — supplier unknown, unmatched lines + Document + ExtractedProduct
  const ocrDoc = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      name: "Albarán OCR pendiente",
      type: "DELIVERY_NOTE",
      category: "albaran",
      createdBy: admin.id,
      fileSize: 248000,
      fileFormat: "PDF",
      url: "/uploads/albaranes/alb-003.pdf",
      fileUrl: "/uploads/albaranes/alb-003.pdf",
      fileName: "alb-003.pdf",
      source: "upload",
      sourceUserId: admin.id,
      status: "COMPLETED",
    },
  });
  await Promise.all([
    prisma.extractedProduct.create({
      data: { documentId: ocrDoc.id, name: "Harina de trigo especial", quantity: 5, unit: "kg", unitPrice: 0.9, supplier: "Molino desconocido", confidence: 0.62, allergens: ["gluten"] },
    }),
    prisma.extractedProduct.create({
      data: { documentId: ocrDoc.id, name: "Levadura fresca", quantity: 1, unit: "kg", unitPrice: 3.2, supplier: "Molino desconocido", confidence: 0.55 },
    }),
  ]);
  const albaran3 = await prisma.albaran.create({
    data: {
      tenantId: tenant.id,
      internalNumber: "ALB-2026-003",
      date: iso(0),
      base: 7.7,
      vatTotal: 0.77,
      total: 8.47,
      grossAmount: 7.7,
      status: "PENDIENTE",
      originalFileUrl: "/uploads/albaranes/alb-003.pdf",
      ocrConfidence: 0.58,
      ocrRawData: { raw_text: "Factura ... Molino desconocido ... harina ... levadura" },
      warehouseId: warehouse.id,
      createdBy: admin.id,
    },
  });
  await Promise.all([
    prisma.albaranLine.create({
      data: { albaranId: albaran3.id, description: "Harina de trigo especial", quantity: 5, unit: "kg", unitPrice: 0.9, vatPercent: 10, lineAmount: 4.5, matchStatus: "NUEVO", lineStatus: "PENDIENTE", confidence: 0.3 },
    }),
    prisma.albaranLine.create({
      data: { albaranId: albaran3.id, description: "Levadura fresca", quantity: 1, unit: "kg", unitPrice: 3.2, vatPercent: 10, lineAmount: 3.2, matchStatus: "NUEVO", lineStatus: "PENDIENTE", confidence: 0.25 },
    }),
  ]);

  // Goods reception + invoice + purchase order tied to the procurement flow
  await prisma.goodsReception.create({
    data: {
      tenantId: tenant.id,
      receptionDate: iso(-2),
      supplier: "Proveedor Local S.L.",
      proveedorId: supplierByName["Proveedor Local S.L."],
      orderNumber: "PO-001",
      albaran: albaran1.internalNumber,
      fecha: iso(-2),
      items: [{ product: "Tomate Pera", quantity: 2, unit: "Caja 10kg" }, { product: "Cebolla", quantity: 1, unit: "Saco 25kg" }],
      notes: "Recepción correcta, sin incidencias",
      receivedBy: admin.id,
    },
  });
  await prisma.invoice.create({
    data: { tenantId: tenant.id, invoiceNumber: "FAC-2026-001", supplier: "Proveedor Local S.L.", totalAmount: base1 * 1.1, status: "PAID", issuedAt: iso(-2), dueDate: iso(12) },
  });
  await prisma.order.create({
    data: { tenantId: tenant.id, orderNumber: "PO-001", supplier: "Proveedor Local S.L.", totalAmount: base1 * 1.1, status: "RECEIVED", orderedAt: iso(-4), receivedAt: iso(-2) },
  });
  console.log("✅ 3 albaranes (2 confirmados + 1 OCR pendiente) + goods reception + invoice + purchase order");

  // ── L5: inventory (warehouse count with discrepancies) ────────────────
  const inventory = await prisma.inventory.create({
    data: { tenantId: tenant.id, warehouseId: warehouse.id, name: "Recuento semanal", status: "COMPLETED", completedAt: iso(-1), createdBy: admin.id },
  });
  const invItems: { product: string; theoretical: number; actual: number; unit: string }[] = [
    { product: "Tomate Pera", theoretical: 18, actual: 17, unit: "kg" },
    { product: "Arroz Bomba", theoretical: 40, actual: 40, unit: "kg" },
    { product: "Pollo de Corral", theoretical: 6, actual: 5.5, unit: "kg" }, // merma
    { product: "Aceite de Oliva Virgen Extra", theoretical: 12, actual: 11.8, unit: "L" },
  ];
  for (const it of invItems) {
    await prisma.inventoryItem.create({
      data: { inventoryId: inventory.id, productId: productByName[it.product], quantity: it.actual, unit: it.unit, theoreticalQuantity: it.theoretical, actualQuantity: it.actual, difference: it.actual - it.theoretical, condition: "GOOD" },
    });
  }
  console.log(`✅ inventory + ${invItems.length} items (con discrepancias)`);

  // ── L6: production (orders, work batches, progress, alerts) ───────────
  const productionOrder = await prisma.productionOrder.create({
    data: {
      tenantId: tenant.id,
      orderNumber: "PROD-2026-001",
      orderType: "COOKING",
      status: "IN_PROGRESS",
      scheduledFor: iso(1),
      startedAt: iso(0),
      items: [{ recipe: "Paella Valenciana", portions: 8 }, { recipe: "Salmón a la Plancha", portions: 4 }],
      miseEnPlaceItems: [{ product: "Arroz Bomba", quantity: 500 }],
      notes: "Producción para servicio de mediodía",
      createdBy: admin.id,
    },
  });
  const workBatch = await prisma.workBatch.create({
    data: {
      tenantId: tenant.id,
      orderId: productionOrder.id,
      batchNumber: "LOTE-001",
      batchType: "COOKING",
      status: "IN_PROGRESS",
      scheduledFor: iso(1),
      startedAt: iso(0),
      notes: "Lote de paellas",
      createdBy: admin.id,
    },
  });
  await prisma.progressTracking.create({
    data: { workBatchId: workBatch.id, progress: 65, status: "IN_PROGRESS", notes: "Cocción en curso", trackedBy: admin.id },
  });
  await prisma.productionAlert.create({
    data: { tenantId: tenant.id, alertType: "STOCK", severity: "WARNING", message: "Stock de Pollo de Corral por debajo del mínimo", createdBy: admin.id },
  });
  console.log("✅ production order + work batch + progress + alert");

  // ── L7: APPCC (temperature, cleaning, pest, controls) ─────────────────
  const fridge = await prisma.temperatureControl.create({
    data: { tenantId: tenant.id, type: "FRIDGE", location: "Cámara fría 1", targetTemperature: 4, tolerance: 2, unit: "CELSIUS", responsible: admin.id, isActive: true, createdBy: admin.id },
  });
  const freezer = await prisma.temperatureControl.create({
    data: { tenantId: tenant.id, type: "FREEZER", location: "Congelador", targetTemperature: -18, tolerance: 3, unit: "CELSIUS", responsible: admin.id, isActive: true, createdBy: admin.id },
  });
  for (const [ctrl, temps] of [[fridge.id, [4.1, 3.8, 5.2]], [freezer.id, [-18.5, -19.0, -17.2]]] as [string, number[]][]) {
    for (let d = 0; d < 3; d++) {
      const t = temps[d];
      const within = Math.abs(t - (ctrl === fridge.id ? 4 : -18)) <= (ctrl === fridge.id ? 2 : 3);
      await prisma.temperatureMeasurement.create({
        data: { controlId: ctrl, temperature: t, status: within ? "OK" : "WARNING", withinRange: within, measuredBy: admin.id, recordedBy: admin.id, measuredAt: iso(-2 + d) },
      });
    }
  }
  const cleaningPlan = await prisma.cleaningPlan.create({
    data: { tenantId: tenant.id, name: "Limpieza diaria cocina", description: "Rutina de limpieza al cierre", area: "Cocina", planType: "DAILY", frequency: "Diaria", responsible: [admin.name], durationMinutes: 45, isActive: true, createdBy: admin.id },
  });
  for (const tn of ["Limpiar campana extractora", "Desinfectar superficies de corte", "Vaciar y limpiar freidora"]) {
    await prisma.cleaningTask.create({
      data: { planId: cleaningPlan.id, taskName: tn, taskType: "CLEANING", area: "Cocina", products: ["Desinfectante multiusos"], estimatedTime: 15, responsible: [admin.name], completed: tn !== "Vaciar y limpiar freidora", completedBy: tn !== "Vaciar y limpiar freidora" ? admin.id : null, completedAt: tn !== "Vaciar y limpiar freidora" ? iso(-1) : null },
    });
  }
  await prisma.pestControl.create({
    data: { tenantId: tenant.id, controlDate: iso(-5), date: iso(-5), nextDate: iso(23), controlType: "PREVENTIVE", area: "Almacén seco", empresa: "Desinsecta S.L.", company: "Desinsecta S.L.", technician: "Externo", products: { products: ["Cebos roedores"] }, notes: "Sin incidencias", createdBy: admin.id },
  });
  await prisma.appccControl.create({
    data: { tenantId: tenant.id, controlType: "RECEPTION", value: 1, unit: "check", status: "OK", notes: "Recepción de mercancía conforme", controlledBy: admin.id },
  });
  console.log("✅ APPCC: 2 temp controls + 6 mediciones + cleaning plan + 3 tasks + pest control + appcc control");

  // ── L8: staff + wiki + digital-menu + QR + config + templates + alerts + audit ─
  const staff = await prisma.staffMember.create({
    data: { tenantId: tenant.id, name: "Lucía Fernández", role: "COCINERA", email: "lucia@chefchek.local", isActive: true, availableHours: 40, maxTasks: 10 },
  });

  // Wiki / procedimientos
  const wikiCat = await prisma.knowledgeCategory.create({
    data: { tenantId: tenant.id, name: "Procedimientos de cocina", slug: "procedimientos-cocina", description: "Manuales y SOPs", color: "#2196F3", icon: "book", sortOrder: 1, isActive: true },
  });
  const tag1 = await prisma.knowledgeTag.create({ data: { tenantId: tenant.id, name: "Higiene", slug: "higiene", color: "#4CAF50" } });
  const tag2 = await prisma.knowledgeTag.create({ data: { tenantId: tenant.id, name: "Recetas", slug: "recetas", color: "#FF9800" } });
  const article = await prisma.knowledgeArticle.create({
    data: {
      tenantId: tenant.id,
      categoryId: wikiCat.id,
      title: "Protocolo de recepción de mercancía",
      slug: "protocolo-recepcion-mercancia",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Verificar temperatura, integridad del embalaje y fecha de caducidad." }] }] },
      summary: "Pasos a seguir al recibir mercancía de proveedores.",
      status: "PUBLISHED",
      isPublic: false,
      viewCount: 12,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });
  await prisma.knowledgeVersion.create({ data: { articleId: article.id, version: 1, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Versión inicial." }] }] }, changeNote: "Creación", createdBy: admin.id } });
  await prisma.knowledgeArticleTag.create({ data: { articleId: article.id, tagId: tag1.id } });
  await prisma.knowledgeArticleTag.create({ data: { articleId: article.id, tagId: tag2.id } });

  // Digital menu + QR + scans
  const digitalMenu = await prisma.digitalMenuConfig.create({
    data: {
      tenantId: tenant.id,
      name: "Carta QR Bistró",
      menuId: menu.id,
      isActive: true,
      qrCodeUrl: "/uploads/qr/menu-temporada.png",
      primaryColor: "#1a1a1a",
      secondaryColor: "#d4af37",
      fontFamily: "Inter",
      logoUrl: "/uploads/logo.png",
      isOpen: true,
      openingHours: { mon: "12-16,20-23", tue: "12-16,20-23", wed: "12-16,20-23" },
      showPrices: true,
      showAllergens: true,
      showDescriptions: true,
      enableAllergenFilter: true,
      scanCount: 18,
      lastScannedAt: iso(0),
    },
  });
  await prisma.qRCode.create({
    data: {
      qrCodeId: "qr-menu-temporada-001",
      tenantId: tenant.id,
      entityType: "digital-menu",
      entityId: digitalMenu.id,
      qrCodeData: "https://demo.chefchek.local/menu/menu-temporada",
      config: { size: 300, format: "png" },
      format: "png",
      size: 300,
      publicUrl: "/uploads/qr/menu-temporada.png",
      scanCount: 18,
      lastScannedAt: iso(0),
    },
  });
  for (let d = 0; d < 3; d++) {
    await prisma.menuScan.create({ data: { digitalMenuId: digitalMenu.id, language: "es", interactionType: "scan", scannedAt: iso(-d), metadata: {} } });
  }

  // Configuration + document/technical-sheet templates
  const configs: { key: string; value: string; category: string; description: string }[] = [
    { key: "currency", value: "EUR", category: "CURRENCY", description: "Moneda del tenant" },
    { key: "timezone", value: "Europe/Madrid", category: "GENERAL", description: "Zona horaria" },
    { key: "iva_default", value: "10", category: "TAX", description: "IVA por defecto (%)" },
  ];
  for (const c of configs) {
    await prisma.configuration.create({ data: { tenantId: tenant.id, key: c.key, value: c.value, category: c.category, description: c.description, updatedBy: admin.id } });
  }
  await prisma.documentTemplate.create({ data: { tenantId: tenant.id, name: "Plantilla albarán", type: "RECEIPT", description: "Plantilla base para albaranes", content: { sections: ["header", "lines", "totals"] }, isActive: true } });
  await prisma.technicalSheetTemplate.create({ data: { tenantId: tenant.id, name: "Ficha técnica estándar", type: "STANDARD", description: "Ficha técnica de producto", layout: {}, fields: ["nombre", "alergenos", "proveedor"], isActive: true, createdBy: admin.id } });

  // Alerts + dashboard metrics + dashboard alert + audit log
  await prisma.alert.create({ data: { tenantId: tenant.id, type: "STOCK", alertType: "LOW_STOCK", severity: "WARNING", message: "Pollo de Corral bajo mínimo (6 < 8)", createdBy: admin.id } });
  await prisma.alert.create({ data: { tenantId: tenant.id, type: "STOCK", alertType: "LOW_STOCK", severity: "WARNING", message: "Pasta Spaghetti bajo mínimo (6 < 4)", createdBy: admin.id } });
  const metrics: { metricType: string; metricName: string; period: string; offset: number; value: number; target?: number }[] = [
    { metricType: "COST_TREND", metricName: "food_cost", period: "WEEK", offset: 0, value: 32.5, target: 30 },
    { metricType: "MARGIN_ANALYSIS", metricName: "gross_margin", period: "WEEK", offset: 0, value: 68.0, target: 65 },
    { metricType: "STOCK_ALERT", metricName: "low_stock_count", period: "DAY", offset: 0, value: 2 },
  ];
  for (const m of metrics) {
    await prisma.dashboardMetric.create({ data: { tenantId: tenant.id, metricType: m.metricType, metricName: m.metricName, period: m.period, date: iso(m.offset), value: m.value, target: m.target, metadata: {} } });
  }
  await prisma.dashboardAlert.create({ data: { tenantId: tenant.id, alertType: "STOCK_OUT", severity: "HIGH", title: "Stock crítico", description: "2 productos bajo mínimo", entityId: productByName["Pollo de Corral"], entityType: "PRODUCT", isResolved: false } });
  await prisma.auditLog.create({ data: { tenantId: tenant.id, userId: admin.id, action: "LOGIN", entityType: "User", entityId: admin.id, ipAddress: "127.0.0.1", userAgent: "seed", details: { source: "seed" } } });
  await prisma.auditLog.create({ data: { tenantId: tenant.id, userId: admin.id, action: "CREATE", entityType: "Albaran", entityId: albaran1.id, details: { internalNumber: albaran1.internalNumber } } });
  console.log("✅ staff + wiki (cat+article+version+2tags) + digital-menu + QR + 3 scans + config + 2 templates + alerts + metrics + audit");

  // ── L9: sprint + teamMember + tasks + notifications ───────────────────
  const teamMember = await prisma.teamMember.create({
    data: { tenantId: tenant.id, name: admin.name, role: "DEVELOPER", email: admin.email, isActive: true, availableHours: 40 },
  });
  const sprint = await prisma.sprint.create({
    data: {
      name: "Sprint Operación Semanal",
      description: "Seguimiento de la operación del restaurante",
      type: "DEVELOPMENT",
      status: "IN_PROGRESS",
      startDate: iso(0),
      endDate: iso(6),
      tenantId: tenant.id,
      objectives: JSON.stringify(["Cerrar inventario semanal", "Revisar mermas", "Actualizar carta"]),
      teamMembers: JSON.stringify([{ id: teamMember.id, name: teamMember.name, role: "DEVELOPER" }]),
      notes: "Sprint de operación",
      createdBy: admin.id,
      progress: 60.0,
      totalTasks: 3,
      completedTasks: 1,
    },
  });
  const taskDefs = [
    { title: "Cerrar inventario semanal", status: "IN_PROGRESS", priority: "HIGH", due: 4 },
    { title: "Revisar mermas de carne", status: "COMPLETED", priority: "MEDIUM", due: 2 },
    { title: "Actualizar carta de temporada", status: "TODO", priority: "LOW", due: 5 },
  ];
  for (const t of taskDefs) {
    const task = await prisma.task.create({
      data: {
        title: t.title,
        description: t.title,
        sprintId: sprint.id,
        status: t.status,
        priority: t.priority,
        assignedTo: teamMember.id,
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: iso(t.due),
      },
    });
    await prisma.notification.create({
      data: { type: "TASK", title: t.title, message: `Tarea ${t.status.toLowerCase()}: ${t.title}`, taskId: task.id, sprintId: sprint.id, recipientId: admin.id, priority: t.priority, read: t.status === "COMPLETED" },
    });
  }
  console.log("✅ sprint + teamMember + 3 tasks + notifications");

  console.log("\n🎉 Seed completed (L0-L9, todos los módulos).");
  console.log("📝 Login: admin@chefchek.local / admin123 (tenant: chefchek-demo)");
  console.log("📝 2.º tenant vacío para aislamiento: otro-restaurante");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
