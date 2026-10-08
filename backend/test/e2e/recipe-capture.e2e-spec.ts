import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

/**
 * E2E de Captura de recetas contra la app y la BD reales, sin llamar a ningún
 * proveedor de IA (eso es verificación manual). Cubre lo que solo se ve con
 * los guards montados: módulo apagado por defecto, validación de entrada, IA
 * sin configurar y aislamiento entre tenants.
 */
describe("E2E - Captura de recetas", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tenantA = { slug: "e2e-capture-tenant-a", name: "Capture Tenant A" };
  const tenantB = { slug: "e2e-capture-tenant-b", name: "Capture Tenant B" };
  let tenantAId: string;
  let tenantBId: string;
  let sessionA: string;
  let sessionB: string;

  const as = (session: string, slug: string) => ({
    Authorization: `Bearer ${session}`,
    "X-Tenant-Slug": slug,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await cleanupBySlug();
    await seed();
  });

  afterAll(async () => {
    await cleanupBySlug();
    await app.close();
  });

  // Borrado físico por SQL directo, y solo de los dos tenants de este test:
  // el `deleteMany` de Prisma marca `deletedAt` en tenants, recetas y
  // artículos, y un tenant borrado lógicamente sigue ocupando su slug único,
  // con lo que la siguiente ejecución fallaría al sembrar. El resto de tablas
  // cae en cascada desde el tenant.
  async function cleanupBySlug() {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "tenants" WHERE "slug" = ANY($1)`,
      [tenantA.slug, tenantB.slug],
    );
  }

  async function seed() {
    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    const create = async (
      tenant: { slug: string; name: string },
      email: string,
    ) => {
      const t = await prisma.tenant.create({
        data: { name: tenant.name, slug: tenant.slug, isActive: true },
      });
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: `${tenant.name} Admin`,
          tenantId: t.id,
          role: "ADMIN",
          isActive: true,
        },
      });
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenant.slug)
        .send({ email, password: "TestPass123!" });
      return { id: t.id, session: login.body.data.session.id as string };
    };
    const a = await create(tenantA, "capture-a@test.com");
    const b = await create(tenantB, "capture-b@test.com");
    tenantAId = a.id;
    tenantBId = b.id;
    sessionA = a.session;
    sessionB = b.session;
  }

  async function enableModule(tenantId: string) {
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.captura-recetas.enabled",
        value: "true",
        category: "MODULES",
        updatedBy: "e2e",
      },
    });
  }

  it("el módulo está apagado por defecto: la API no responde", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/recipe-captures")
      .set(as(sessionA, tenantA.slug))
      .expect(403);
  });

  describe("con el módulo activo", () => {
    beforeAll(async () => {
      await enableModule(tenantAId);
      await enableModule(tenantBId);
    });

    it("lista vacía al empezar", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recipe-captures")
        .set(as(sessionA, tenantA.slug))
        .expect(200);
      expect(res.body.data).toEqual([]);
    });

    it.each([
      ["URL con esquema no http", { source: "URL", url: "file:///etc/passwd" }],
      ["URL sin protocolo", { source: "URL", url: "recetas.es/tarta" }],
      ["texto demasiado corto", { source: "TEXTO", text: "hola" }],
      [
        "texto por encima del límite",
        { source: "TEXTO", text: "a".repeat(20_001) },
      ],
      ["origen desconocido", { source: "ARCHIVO" }],
    ])("rechaza %s con 400", async (_name, body) => {
      await request(app.getHttpServer())
        .post("/api/v1/recipe-captures")
        .set(as(sessionA, tenantA.slug))
        .send(body)
        .expect(400);
    });

    it("sin IA configurada responde 400 accionable y no crea ninguna captura", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/recipe-captures")
        .set(as(sessionA, tenantA.slug))
        .send({ source: "URL", url: "https://recetas.example.com/tarta" })
        .expect(400);

      expect(res.body.message).toContain("Configura el modelo de IA");
      expect(
        await prisma.recipeCapture.count({ where: { tenantId: tenantAId } }),
      ).toBe(0);
    });

    it("aísla las capturas entre tenants y oculta las descartadas", async () => {
      const capture = await prisma.recipeCapture.create({
        data: {
          tenantId: tenantAId,
          source: "TEXTO",
          status: "PENDIENTE",
          name: "Receta privada de A",
          ingredients: {
            create: [
              {
                rawText: "1 kg de tomate",
                name: "tomate",
                quantity: 1,
                unit: "kg",
              },
            ],
          },
        },
        include: { ingredients: true },
      });
      const url = `/api/v1/recipe-captures/${capture.id}`;
      const ingredientUrl = `${url}/ingredients/${capture.ingredients[0].id}`;

      await request(app.getHttpServer())
        .get(url)
        .set(as(sessionB, tenantB.slug))
        .expect(404);
      await request(app.getHttpServer())
        .patch(ingredientUrl)
        .set(as(sessionB, tenantB.slug))
        .send({ matchedProductId: null })
        .expect(404);
      await request(app.getHttpServer())
        .delete(url)
        .set(as(sessionB, tenantB.slug))
        .expect(404);

      const own = await request(app.getHttpServer())
        .get(url)
        .set(as(sessionA, tenantA.slug))
        .expect(200);
      expect(own.body.data.ingredients).toHaveLength(1);

      await request(app.getHttpServer())
        .patch(ingredientUrl)
        .set(as(sessionA, tenantA.slug))
        .send({ matchedProductId: null })
        .expect(200);

      await request(app.getHttpServer())
        .delete(url)
        .set(as(sessionA, tenantA.slug))
        .expect(204);
      await request(app.getHttpServer())
        .get(url)
        .set(as(sessionA, tenantA.slug))
        .expect(404);
      // Descartar no borra: la fila sigue en la base de datos.
      expect(
        (
          await prisma.recipeCapture.findUniqueOrThrow({
            where: { id: capture.id },
          })
        ).status,
      ).toBe("DESCARTADA");
    });
    describe("pasar a Recetas", () => {
      let captureId: string;
      const promoteUrl = () => `/api/v1/recipe-captures/${captureId}/promote`;

      beforeAll(async () => {
        const harina = await prisma.product.create({
          data: {
            tenantId: tenantAId,
            name: "HARINA TRIGO",
            referenceUnit: "kg",
            purchasePrice: 1,
            netPrice: 1,
          } as any,
        });
        const capture = await prisma.recipeCapture.create({
          data: {
            tenantId: tenantAId,
            source: "URL",
            sourceUrl: "https://recetas.example.com/bizcocho",
            status: "PENDIENTE",
            name: "Bizcocho e2e",
            elaboration: JSON.stringify({
              steps: [{ description: "Hornear" }],
            }),
            portions: 8,
            ingredients: {
              create: [
                {
                  rawText: "250 g de harina",
                  name: "harina",
                  quantity: 250,
                  unit: "g",
                  matchedProductId: harina.id,
                  sortOrder: 0,
                },
                {
                  rawText: "100 ml de harina líquida",
                  name: "harina",
                  quantity: 100,
                  unit: "ml",
                  matchedProductId: harina.id,
                  sortOrder: 1,
                },
                { rawText: "sal al gusto", name: "sal", sortOrder: 2 },
              ],
            },
          },
        });
        captureId = capture.id;
      });

      it("otro tenant no puede pasarla", async () => {
        await request(app.getHttpServer())
          .post(promoteUrl())
          .set(as(sessionB, tenantB.slug))
          .expect(404);
      });

      it("un usuario con la sección Recetas oculta no puede pasarla", async () => {
        const passwordHash = await bcrypt.hash("TestPass123!", 10);
        await prisma.user.create({
          data: {
            email: "capture-a-user@test.com",
            passwordHash,
            name: "Capture A User",
            tenantId: tenantAId,
            role: "USER",
            isActive: true,
          },
        });
        await prisma.configuration.create({
          data: {
            tenantId: tenantAId,
            key: "roleAccess.USER.recipes",
            value: "false",
            category: "ROLE_ACCESS",
            updatedBy: "e2e",
          },
        });
        const login = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("x-tenant-slug", tenantA.slug)
          .send({ email: "capture-a-user@test.com", password: "TestPass123!" });

        await request(app.getHttpServer())
          .post(promoteUrl())
          .set(as(login.body.data.session.id, tenantA.slug))
          .expect(403);
        expect(
          await prisma.recipe.count({ where: { tenantId: tenantAId } }),
        ).toBe(0);
      });

      it("crea una sola receta, inactiva, con la línea compatible y el resto en notas", async () => {
        const first = await request(app.getHttpServer())
          .post(promoteUrl())
          .set(as(sessionA, tenantA.slug))
          .expect(200);
        expect(first.body.data).toMatchObject({ lines: 1, toNotes: 2 });
        const recipeId = first.body.data.recipeId;

        // Repetir la llamada (doble clic) devuelve la misma receta.
        const second = await request(app.getHttpServer())
          .post(promoteUrl())
          .set(as(sessionA, tenantA.slug))
          .expect(200);
        expect(second.body.data.recipeId).toBe(recipeId);

        const recipes = await prisma.recipe.findMany({
          where: { tenantId: tenantAId },
          include: { ingredients: true },
        });
        expect(recipes).toHaveLength(1);
        expect(recipes[0]).toMatchObject({
          id: recipeId,
          name: "Bizcocho e2e",
          sourceUrl: "https://recetas.example.com/bizcocho",
          isActive: false,
          portions: 8,
        });
        expect(recipes[0].ingredients).toHaveLength(1);
        expect(recipes[0].ingredients[0]).toMatchObject({
          quantity: 250,
          unit: "g",
        });
        expect(recipes[0].notes).toBe(
          [
            "Ingredientes pendientes de vincular (alérgenos incompletos):",
            "- 100 ml de harina líquida (unidad no compatible con el artículo)",
            "- sal al gusto",
          ].join("\n"),
        );

        const capture = await prisma.recipeCapture.findUniqueOrThrow({
          where: { id: captureId },
        });
        expect(capture).toMatchObject({ status: "PASADA", recipeId });

        // La receta se abre y se guarda desde Recetas sin perder las notas.
        const read = await request(app.getHttpServer())
          .get(`/api/v1/recipes/${recipeId}`)
          .set(as(sessionA, tenantA.slug))
          .expect(200);
        expect(read.body.data.notes).toContain("sal al gusto");
        expect(read.body.data.sourceUrl).toBe(
          "https://recetas.example.com/bizcocho",
        );
      });
    });
  });
});
