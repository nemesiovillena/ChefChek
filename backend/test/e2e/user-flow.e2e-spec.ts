import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

describe("E2E - User Flow (Full)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionId: string;
  let tenantId: string;
  const tenantSlug = "e2e-user-flow-test";
  const testEmail = "e2e-user-flow@test.com";

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
    await seedTestData();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function seedTestData() {
    const tenant = await prisma.tenant.create({
      data: { name: "E2E User Flow Test", slug: tenantSlug, isActive: true },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: "E2E User Flow",
        tenantId,
        role: "ADMIN",
        isActive: true,
      },
    });
  }

  async function cleanup() {
    await prisma.recipe.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { email: testEmail } } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.tenant.deleteMany({ where: { slug: tenantSlug } });
  }

  function authHeaders() {
    return {
      Authorization: `Bearer ${sessionId}`,
      "X-Tenant-Slug": tenantSlug,
    };
  }

  describe("Complete user journey", () => {
    it("login → create product → create recipe → list recipes → cleanup", async () => {
      // Step 1: Login
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testEmail,
          password: "TestPass123!",
          tenantId: tenantSlug,
        })
        .expect(201);

      expect(loginRes.body.success).toBe(true);
      sessionId = loginRes.body.data.session.id;

      // Step 2: Create product
      const productRes = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({
          name: "Harina E2E",
          purchaseUnit: "kg",
          storageUnit: "kg",
          recipeUnit: "g",
          purchasePrice: 1.2,
          netPrice: 1.5,
          category: "Panaderia",
          allergens: [1],
        })
        .expect(201);

      expect(productRes.body.success).toBe(true);
      const productId = productRes.body.data.id;

      // Step 3: Create recipe using that product
      const recipeRes = await request(app.getHttpServer())
        .post("/api/v1/recipes")
        .set(authHeaders())
        .send({
          name: "Pan E2E",
          description: "Receta de test",
          elaboration: "Mezclar y hornear",
          portions: 10,
          ingredients: [{ productId, quantity: 500, unit: "g" }],
        })
        .expect(201);

      expect(recipeRes.body.success).toBe(true);
      const recipeId = recipeRes.body.data.id;

      // Step 4: List recipes
      const listRes = await request(app.getHttpServer())
        .get("/api/v1/recipes")
        .set(authHeaders())
        .expect(200);

      expect(listRes.body.success).toBe(true);
      const recipeIds = listRes.body.data.map((r: any) => r.id);
      expect(recipeIds).toContain(recipeId);

      // Step 5: Get single recipe
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/recipes/${recipeId}`)
        .set(authHeaders())
        .expect(200);

      expect(getRes.body.data.name).toBe("Pan E2E");
    });
  });

  describe("Error handling", () => {
    it("should reject access without auth", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/products")
        .set("X-Tenant-Slug", tenantSlug)
        .expect(401);
    });

    it("should reject access without tenant header", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/products")
        .set("Authorization", `Bearer ${sessionId}`)
        .expect(403);
    });

    it("should return 404 for non-existent product", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/products/non-existent-id")
        .set(authHeaders())
        .expect(404);
    });
  });
});
