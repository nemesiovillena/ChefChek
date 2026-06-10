import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Crear tenant principal
  const tenant = await prisma.tenant.upsert({
    where: { slug: "chefchek-demo" },
    update: {},
    create: {
      name: "ChefChek Demo",
      slug: "chefchek-demo",
      domain: "demo.chefchek.local",
      isActive: true,
    },
  });
  console.log("✅ Tenant created:", tenant.name);

  // Crear usuario admin
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: "admin@chefchek.local",
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      email: "admin@chefchek.local",
      passwordHash,
      name: "Admin User",
      role: "ADMIN",
      tenantId: tenant.id,
      isActive: true,
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Crear categorías padre (artículos)
  const alimentacion = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "alimentacion" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Alimentación",
      slug: "alimentacion",
      description: "Productos alimentarios no congelados",
      isActive: true,
      sortOrder: 1,
    },
  });
  const congelados = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "congelados" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Congelados",
      slug: "congelados",
      description: "Productos congelados",
      isActive: true,
      sortOrder: 2,
    },
  });
  const alcoholes = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "alcoholes" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Alcoholes",
      slug: "alcoholes",
      description: "Bebidas alcohólicas",
      isActive: true,
      sortOrder: 3,
    },
  });
  const bebidasNoAlc = await prisma.category.upsert({
    where: {
      tenantId_slug: { tenantId: tenant.id, slug: "bebidas-no-alcoholicas" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Bebidas no alcohólicas",
      slug: "bebidas-no-alcoholicas",
      description: "Refrescos, zumos, aguas e infusiones",
      isActive: true,
      sortOrder: 4,
    },
  });
  const limpieza = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "limpieza" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Limpieza",
      slug: "limpieza",
      description: "Productos de limpieza y desinfección",
      isActive: true,
      sortOrder: 5,
    },
  });
  const desechables = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "desechables" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Desechables",
      slug: "desechables",
      description: "Material desechable y embalaje",
      isActive: true,
      sortOrder: 6,
    },
  });
  const utensilios = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "utensilios" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Utensilios",
      slug: "utensilios",
      description: "Utensilios de cocina y sala",
      isActive: true,
      sortOrder: 7,
    },
  });

  // Subcategorías
  const subcatData: {
    name: string;
    slug: string;
    description: string;
    parentId: string;
    sortOrder: number;
  }[] = [
    // Alimentación
    {
      name: "Aceite",
      slug: "aceite",
      description: "Aceites y grasas",
      parentId: alimentacion.id,
      sortOrder: 1,
    },
    {
      name: "Café",
      slug: "cafe",
      description: "Café y sucedáneos",
      parentId: alimentacion.id,
      sortOrder: 2,
    },
    {
      name: "Lácteos",
      slug: "lacteos",
      description: "Leche, queso, yogur y derivados",
      parentId: alimentacion.id,
      sortOrder: 3,
    },
    {
      name: "Pan",
      slug: "pan",
      description: "Pan, bollería y masas",
      parentId: alimentacion.id,
      sortOrder: 4,
    },
    {
      name: "Arroz y Pasta",
      slug: "arroz-pasta",
      description: "Arroces, pastas y cereales",
      parentId: alimentacion.id,
      sortOrder: 5,
    },
    {
      name: "Conservas",
      slug: "conservas",
      description: "Conservas y encurtidos",
      parentId: alimentacion.id,
      sortOrder: 6,
    },
    {
      name: "Condimentos",
      slug: "condimentos",
      description: "Especias, hierbas y salsas",
      parentId: alimentacion.id,
      sortOrder: 7,
    },
    {
      name: "Verduras",
      slug: "verduras",
      description: "Verduras y hortalizas frescas",
      parentId: alimentacion.id,
      sortOrder: 8,
    },
    // Congelados
    {
      name: "Pescado",
      slug: "pescado-congelado",
      description: "Pescado y marisco congelado",
      parentId: congelados.id,
      sortOrder: 1,
    },
    {
      name: "Carne",
      slug: "carne-congelada",
      description: "Carne congelada",
      parentId: congelados.id,
      sortOrder: 2,
    },
    {
      name: "Helados",
      slug: "helados",
      description: "Helados y postres congelados",
      parentId: congelados.id,
      sortOrder: 3,
    },
    {
      name: "Verduras",
      slug: "verduras-congeladas",
      description: "Verduras congeladas",
      parentId: congelados.id,
      sortOrder: 4,
    },
    {
      name: "Precocinados",
      slug: "precocinados",
      description: "Platos precocinados congelados",
      parentId: congelados.id,
      sortOrder: 5,
    },
    // Alcoholes
    {
      name: "Brandy",
      slug: "brandy",
      description: "Brandy y cognac",
      parentId: alcoholes.id,
      sortOrder: 1,
    },
    {
      name: "Ginebra",
      slug: "ginebra",
      description: "Ginebras y gin",
      parentId: alcoholes.id,
      sortOrder: 2,
    },
    {
      name: "Ron",
      slug: "ron",
      description: "Ron y rones añejos",
      parentId: alcoholes.id,
      sortOrder: 3,
    },
    {
      name: "Whisky",
      slug: "whisky",
      description: "Whisky y bourbon",
      parentId: alcoholes.id,
      sortOrder: 4,
    },
    {
      name: "Vino",
      slug: "vino",
      description: "Vinos tintos, blancos y rosados",
      parentId: alcoholes.id,
      sortOrder: 5,
    },
    {
      name: "Cerveza",
      slug: "cerveza",
      description: "Cervezas y lagers",
      parentId: alcoholes.id,
      sortOrder: 6,
    },
    {
      name: "Licores",
      slug: "licores",
      description: "Licores y cremas",
      parentId: alcoholes.id,
      sortOrder: 7,
    },
    // Bebidas no alcohólicas
    {
      name: "Refrescos",
      slug: "refrescos",
      description: "Bebidas carbonatadas",
      parentId: bebidasNoAlc.id,
      sortOrder: 1,
    },
    {
      name: "Zumos",
      slug: "zumos",
      description: "Zumos y néctares",
      parentId: bebidasNoAlc.id,
      sortOrder: 2,
    },
    {
      name: "Aguas",
      slug: "aguas",
      description: "Aguas minerales",
      parentId: bebidasNoAlc.id,
      sortOrder: 3,
    },
    {
      name: "Infusiones",
      slug: "infusiones",
      description: "Tés e infusiones",
      parentId: bebidasNoAlc.id,
      sortOrder: 4,
    },
    // Limpieza
    {
      name: "Cocina",
      slug: "limpieza-cocina",
      description: "Limpieza de cocina",
      parentId: limpieza.id,
      sortOrder: 1,
    },
    {
      name: "Sala",
      slug: "limpieza-sala",
      description: "Limpieza de sala",
      parentId: limpieza.id,
      sortOrder: 2,
    },
    {
      name: "Lavandería",
      slug: "lavanderia",
      description: "Productos de lavandería",
      parentId: limpieza.id,
      sortOrder: 3,
    },
    {
      name: "Desinfección",
      slug: "desinfeccion",
      description: "Desinfectantes y lejías",
      parentId: limpieza.id,
      sortOrder: 4,
    },
    // Desechables
    {
      name: "Papel",
      slug: "papel",
      description: "Papel y celulosa",
      parentId: desechables.id,
      sortOrder: 1,
    },
    {
      name: "Plásticos",
      slug: "plasticos",
      description: "Contenedores y bolsas",
      parentId: desechables.id,
      sortOrder: 2,
    },
    {
      name: "Embalaje",
      slug: "embalaje",
      description: "Embalaje para takeaway",
      parentId: desechables.id,
      sortOrder: 3,
    },
    // Utensilios
    {
      name: "Cocina",
      slug: "utensilios-cocina",
      description: "Utensilios de cocina",
      parentId: utensilios.id,
      sortOrder: 1,
    },
    {
      name: "Sala",
      slug: "utensilios-sala",
      description: "Utensilios de sala",
      parentId: utensilios.id,
      sortOrder: 2,
    },
    {
      name: "Mantenimiento",
      slug: "mantenimiento",
      description: "Herramientas de mantenimiento",
      parentId: utensilios.id,
      sortOrder: 3,
    },
  ];

  const subcategories = await Promise.all(
    subcatData.map((sc) =>
      prisma.category.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: sc.slug } },
        update: {},
        create: {
          tenantId: tenant.id,
          name: sc.name,
          slug: sc.slug,
          description: sc.description,
          parentId: sc.parentId,
          isActive: true,
          sortOrder: sc.sortOrder,
        },
      }),
    ),
  );

  // Mapa de subcategorías por slug para referenciar en productos
  const subcatBySlug = Object.fromEntries(
    subcategories.map((sc) => [sc.slug, sc]),
  );
  console.log(`✅ 7 parent + ${subcategories.length} subcategories created`);

  // Crear categorías de recetas
  const recipeCategories = await Promise.all([
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Aperitivos",
        slug: "aperitivos",
        description: "Entrantes y tapas",
        icon: "🍤",
        color: "#FF9800",
        isActive: true,
        sortOrder: 10,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Arroces",
        slug: "arroces",
        description: "Paellas, risottos y otros arroces",
        icon: "🍚",
        color: "#8BC34A",
        isActive: true,
        sortOrder: 11,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Pescados",
        slug: "pescados",
        description: "Pescados y mariscos",
        icon: "🐟",
        color: "#2196F3",
        isActive: true,
        sortOrder: 12,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Carnes",
        slug: "carnes-recetas",
        description: "Platos de carne",
        icon: "🥩",
        color: "#F44336",
        isActive: true,
        sortOrder: 13,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Pasta",
        slug: "pasta",
        description: "Pizzas, pastas y otras masas",
        icon: "🍝",
        color: "#FF5722",
        isActive: true,
        sortOrder: 14,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Postres",
        slug: "postres",
        description: "Dulces y postres",
        icon: "🍰",
        color: "#E91E63",
        isActive: true,
        sortOrder: 15,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Sopas",
        slug: "sopas",
        description: "Sopas, cremas y caldos",
        icon: "🍲",
        color: "#9C27B0",
        isActive: true,
        sortOrder: 16,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: "Ensaladas",
        slug: "ensaladas",
        description: "Ensaladas frescas",
        icon: "🥗",
        color: "#4CAF50",
        isActive: true,
        sortOrder: 17,
      },
    }),
  ]);
  console.log(`✅ ${recipeCategories.length} recipe categories created`);

  // Crear proveedores
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Proveedor Local S.L.",
        contactPerson: "Juan Pérez",
        email: "juan@proveedorlocal.com",
        phone: "+34 600 123 456",
        averageDeliveryTime: 2,
        reliabilityScore: 90,
        priceTier: "MEDIUM",
        preferredStatus: "PREFERRED",
        orderMethods: ["EMAIL", "PHONE"],
        isActive: true,
      },
    }),
    prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Arrocerías del Sur",
        contactPerson: "María García",
        email: "maria@arrocerias.com",
        phone: "+34 600 789 012",
        averageDeliveryTime: 3,
        reliabilityScore: 85,
        priceTier: "MEDIUM",
        preferredStatus: "PREFERRED",
        orderMethods: ["EMAIL"],
        isActive: true,
      },
    }),
    prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Carnicerías Premium",
        contactPerson: "Carlos López",
        email: "carlos@carniceriaspremium.com",
        phone: "+34 600 345 678",
        averageDeliveryTime: 1,
        reliabilityScore: 95,
        priceTier: "HIGH",
        preferredStatus: "PREFERRED",
        orderMethods: ["PHONE", "EMAIL"],
        isActive: true,
      },
    }),
    prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Oliva del Mediterráneo",
        contactPerson: "Ana Martínez",
        email: "ana@olivamediterraneo.com",
        phone: "+34 600 901 234",
        averageDeliveryTime: 4,
        reliabilityScore: 88,
        priceTier: "MEDIUM",
        preferredStatus: "ALTERNATIVE",
        orderMethods: ["EMAIL", "WEB"],
        isActive: true,
      },
    }),
    prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Azafranes de Castilla",
        contactPerson: "Pedro Sánchez",
        email: "pedro@azafranes.com",
        phone: "+34 600 567 890",
        averageDeliveryTime: 5,
        reliabilityScore: 82,
        priceTier: "HIGH",
        preferredStatus: "ALTERNATIVE",
        orderMethods: ["WEB"],
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ ${suppliers.length} suppliers created`);

  // Crear productos (referencian subcategorías)
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Tomates",
        description: "Tomates frescos de calidad",
        categoryId: subcatBySlug["verduras"].id,
        supplierId: suppliers[0].id,
        purchaseUnit: "Caja 10kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 25.5,
        netPrice: 27.3,
        profitMargin: 7.0,
        wastePercentage: 5.0,
        yieldFactor: 0.95,
        allergens: [1],
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Arroz Bomba",
        description: "Arroz de alta calidad para paellas",
        categoryId: subcatBySlug["arroz-pasta"].id,
        supplierId: suppliers[1].id,
        purchaseUnit: "Saco 25kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 45.0,
        netPrice: 48.15,
        profitMargin: 7.0,
        wastePercentage: 3.0,
        yieldFactor: 0.97,
        allergens: [2],
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Pollo de Corral",
        description: "Pollo fresco de granja",
        categoryId: subcatBySlug["carne-congelada"].id,
        supplierId: suppliers[2].id,
        purchaseUnit: "Caja 20kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 65.0,
        netPrice: 69.55,
        profitMargin: 7.0,
        wastePercentage: 8.0,
        yieldFactor: 0.92,
        allergens: [3],
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Aceite de Oliva Virgen Extra",
        description: "Aceite de oliva de primera prensión en frío",
        categoryId: subcatBySlug["aceite"].id,
        supplierId: suppliers[3].id,
        purchaseUnit: "Garrafa 5L",
        storageUnit: "Litros",
        recipeUnit: "Mililitros",
        purchasePrice: 38.0,
        netPrice: 40.66,
        profitMargin: 7.0,
        wastePercentage: 2.0,
        yieldFactor: 0.98,
        allergens: [],
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Azafrán en Hebras",
        description: "Azafrán de La Mancha D.O.P.",
        categoryId: subcatBySlug["condimentos"].id,
        supplierId: suppliers[4].id,
        purchaseUnit: "Gramo 1g",
        storageUnit: "Gramos",
        recipeUnit: "Gramos",
        purchasePrice: 12.0,
        netPrice: 13.2,
        profitMargin: 10.0,
        wastePercentage: 1.0,
        yieldFactor: 0.99,
        allergens: [],
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ ${products.length} products created`);

  // Crear recetas
  const paella = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      name: "Paella Valenciana",
      description: "Paella tradicional valenciana con pollo y verduras",
      elaboration: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "1. Preparar el caldo con pollo y verduras.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "2. Añadir el arroz y cocinar a fuego medio.",
              },
            ],
          },
        ],
      }),
      totalCost: 15.8,
      totalCostPerUnit: 2.1,
      portions: 8,
      portionSize: 250,
      version: 1,
      isActive: true,
      isPublic: true,
    },
  });

  // Añadir ingredientes a la paella
  await Promise.all([
    prisma.recipeIngredient.create({
      data: {
        recipeId: paella.id,
        productId: products[1].id, // Arroz
        quantity: 500,
        unit: "Gramos",
      },
    }),
    prisma.recipeIngredient.create({
      data: {
        recipeId: paella.id,
        productId: products[2].id, // Pollo
        quantity: 300,
        unit: "Gramos",
      },
    }),
    prisma.recipeIngredient.create({
      data: {
        recipeId: paella.id,
        productId: products[3].id, // Aceite
        quantity: 50,
        unit: "Mililitros",
      },
    }),
    prisma.recipeIngredient.create({
      data: {
        recipeId: paella.id,
        productId: products[4].id, // Azafrán
        quantity: 2,
        unit: "Gramos",
      },
    }),
  ]);
  console.log("✅ Paella Valenciana recipe created with ingredients");

  // Asignar categorías a la paella
  await Promise.all([
    prisma.recipeCategory.create({
      data: {
        recipeId: paella.id,
        categoryId: recipeCategories[1].id, // Arroces
      },
    }),
    prisma.recipeCategory.create({
      data: {
        recipeId: paella.id,
        categoryId: recipeCategories[3].id, // Carnes
      },
    }),
  ]);
  console.log("✅ Paella Valenciana assigned to categories");

  // Crear menú
  const menu = await prisma.menu.create({
    data: {
      tenantId: tenant.id,
      name: "Menú del Día",
      description: "Menú especial del restaurante",
      isActive: true,
    },
  });

  // Añadir items al menú
  await prisma.menuItem.create({
    data: {
      menuId: menu.id,
      recipeId: paella.id,
      category: "PRINCIPALES",
      sortOrder: 1,
      isActive: true,
    },
  });
  console.log("✅ Menu created with items");

  // Crear sprint de seguimiento
  const sprint = await prisma.sprint.create({
    data: {
      name: "Sprint 16: Tracker Implementation",
      description: "Implementación del sistema de seguimiento de sprints",
      type: "DEVELOPMENT",
      status: "IN_PROGRESS",
      startDate: new Date("2026-05-24"),
      endDate: new Date("2026-05-31"),
      tenantId: tenant.id,
      objectives: JSON.stringify([
        "Implementar Sprint Tracker",
        "Crear sistema de tareas",
        "Añadir notificaciones",
      ]),
      teamMembers: JSON.stringify([
        { id: admin.id, name: admin.name, role: "DEVELOPER" },
      ]),
      notes: "Sprint para sistema interno de seguimiento",
      createdBy: admin.id,
      progress: 75.0,
      totalTasks: 5,
      completedTasks: 3,
    },
  });
  console.log("✅ Sprint created");

  // Crear TeamMember para el admin
  const teamMember = await prisma.teamMember.create({
    data: {
      name: admin.name,
      role: "DEVELOPER",
      email: admin.email,
      tenantId: tenant.id,
    },
  });
  console.log("✅ TeamMember created");

  // Crear tareas
  await Promise.all([
    prisma.task.create({
      data: {
        title: "Crear Sprint Tracker Backend",
        description: "Implementar backend para sistema de sprint tracker",
        sprintId: sprint.id,
        status: "COMPLETED",
        priority: "HIGH",
        assignedTo: teamMember.id,
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: new Date("2026-05-28"),
      },
    }),
    prisma.task.create({
      data: {
        title: "Crear Sprint Tracker Frontend",
        description: "Implementar frontend para sistema de sprint tracker",
        sprintId: sprint.id,
        status: "COMPLETED",
        priority: "HIGH",
        assignedTo: teamMember.id,
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: new Date("2026-05-29"),
      },
    }),
    prisma.task.create({
      data: {
        title: "Añadir sistema de notificaciones",
        description: "Implementar sistema de notificaciones para tareas",
        sprintId: sprint.id,
        status: "COMPLETED",
        priority: "MEDIUM",
        assignedTo: teamMember.id,
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: new Date("2026-05-30"),
      },
    }),
    prisma.task.create({
      data: {
        title: "Crear sistema de roles y permisos",
        description: "Implementar sistema de roles RBAC completo",
        sprintId: sprint.id,
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedTo: teamMember.id,
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: new Date("2026-05-31"),
      },
    }),
    prisma.task.create({
      data: {
        title: "Testing y documentación",
        description: "Realizar testing completo y documentar sistema",
        sprintId: sprint.id,
        status: "TODO",
        priority: "MEDIUM",
        tenantId: tenant.id,
        createdBy: admin.id,
        dueDate: new Date("2026-06-01"),
      },
    }),
  ]);
  console.log("✅ 5 tasks created");

  console.log("🎉 Seed completed successfully!");
  console.log("\n📝 Test credentials:");
  console.log("   Email: admin@chefchek.local");
  console.log("   Password: admin123");
  console.log("   Tenant: chefchek-demo");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
