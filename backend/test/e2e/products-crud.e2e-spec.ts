import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

describe("E2E - Products CRUD", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionId: string;
  let tenantId: string;
  const tenantSlug = "e2e-products-test";
  const testEmail = "e2e-products@test.com";

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

    const tenant = await prisma.tenant.create({
      data: { name: "E2E Products Test", slug: tenantSlug, isActive: true },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: "E2E Products User",
        tenantId,
        role: "ADMIN",
        isActive: true,
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({
        email: testEmail,
        password: "TestPass123!",
      });

    sessionId = loginRes.body.data.session.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { email: testEmail } } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.tenant.deleteMany({ where: { slug: tenantSlug } });
    await app.close();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${sessionId}`,
      "X-Tenant-Slug": tenantSlug,
    };
  }

  describe("POST /api/v1/products", () => {
    it("should create a product", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({
          name: "Tomate E2E",
          description: "Tomate para tests",
          purchasePrice: 2.5,
          netPrice: 3.0,
          allergens: [],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Tomate E2E");
    });

    it("should reject without auth", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/products")
        .set("X-Tenant-Slug", tenantSlug)
        .send({ name: "No Auth Product" })
        .expect(401);
    });

    it("should create without tenant header (tenant derived from user)", async () => {
      // The backend derives the tenant from the authenticated user, not the
      // X-Tenant-Slug header, so creation succeeds without it.
      await request(app.getHttpServer())
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${sessionId}`)
        .send({ name: "No Tenant Product" })
        .expect(201);
    });

    it("should reject invalid product data", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({})
        .expect(400);
    });
  });

  describe("GET /api/v1/products", () => {
    it("should list products for tenant", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/products")
        .set(authHeaders())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject without auth", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/products")
        .set("X-Tenant-Slug", tenantSlug)
        .expect(401);
    });
  });

  describe("GET /api/v1/products/:id", () => {
    let productId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({
          name: "Cebolla E2E",
          purchasePrice: 1.5,
          netPrice: 2.0,
          allergens: [],
        });
      productId = res.body.data.id;
    });

    it("should get a product by id", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .set(authHeaders())
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(productId);
    });

    it("should return 404 for non-existent product", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/products/non-existent-id")
        .set(authHeaders())
        .expect(404);
    });
  });

  describe("PATCH /api/v1/products/:id", () => {
    let productId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({
          name: "Pimiento E2E",
          purchasePrice: 3.0,
          netPrice: 4.0,
          allergens: [],
        });
      productId = res.body.data.id;
    });

    it("should update a product", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set(authHeaders())
        .send({ netPrice: 4.5 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("DELETE /api/v1/products/:id", () => {
    let productId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(authHeaders())
        .send({
          name: "Ajo E2E",
          purchasePrice: 5.0,
          netPrice: 6.0,
          allergens: [],
        });
      productId = res.body.data.id;
    });

    it("should delete a product", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set(authHeaders())
        .expect(204);
    });

    it("should return 404 after deletion", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .set(authHeaders())
        .expect(404);
    });
  });
});
