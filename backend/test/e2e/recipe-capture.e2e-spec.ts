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

  async function cleanupBySlug() {
    const leftover = await prisma.tenant.findMany({
      where: { slug: { in: [tenantA.slug, tenantB.slug] } },
      select: { id: true },
    });
    if (leftover.length === 0) return;
    const ids = leftover.map((t) => t.id);
    await prisma.recipeCapture.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.configuration.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: ids } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
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

      expect(res.body.message).toContain("Configura el proveedor de IA");
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
  });
});
