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

  // Crear productos
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Tomates",
        description: "Tomates frescos de calidad",
        category: "VERDURAS",
        supplier: "Proveedor Local S.L.",
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
        category: "GRANOS",
        supplier: "Arrocerías del Sur",
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
        category: "CARNES",
        supplier: "Carnicerías Premium",
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
        category: "ACEITES",
        supplier: "Oliva del Mediterráneo",
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
        category: "ESPECIAS",
        supplier: "Azafranes de Castilla",
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
