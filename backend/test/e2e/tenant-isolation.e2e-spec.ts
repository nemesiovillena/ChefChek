import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

/**
 * Tenant isolation E2E tests: verify that users from one tenant
 * cannot access data belonging to another tenant.
 */
describe("E2E - Tenant Isolation", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tenantA = { slug: "e2e-tenant-a", name: "Tenant A Test" };
  const tenantB = { slug: "e2e-tenant-b", name: "Tenant B Test" };
  let tenantAId: string;
  let tenantBId: string;
  let sessionA: string;
  let sessionB: string;
  let productAId: string;

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
    await seedTenantsAndUsers();
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
  });

  async function seedTenantsAndUsers() {
    // Create two tenants
    const tA = await prisma.tenant.create({
      data: { name: tenantA.name, slug: tenantA.slug, isActive: true },
    });
    const tB = await prisma.tenant.create({
      data: { name: tenantB.name, slug: tenantB.slug, isActive: true },
    });
    tenantAId = tA.id;
    tenantBId = tB.id;

    // Create admin user for each tenant
    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "tenant-a@test.com",
        passwordHash,
        name: "Tenant A Admin",
        tenantId: tenantAId,
        role: "ADMIN",
        isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        email: "tenant-b@test.com",
        passwordHash,
        name: "Tenant B Admin",
        tenantId: tenantBId,
        role: "ADMIN",
        isActive: true,
      },
    });

    // Login both users
    const loginA = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantA.slug)
      .send({
        email: "tenant-a@test.com",
        password: "TestPass123!",
      });
    sessionA = loginA.body.data.session.id;

    const loginB = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantB.slug)
      .send({
        email: "tenant-b@test.com",
        password: "TestPass123!",
      });
    sessionB = loginB.body.data.session.id;

    // Create a product in Tenant A
    const productRes = await request(app.getHttpServer())
      .post("/api/v1/products")
      .set({
        Authorization: `Bearer ${sessionA}`,
        "X-Tenant-Slug": tenantA.slug,
      })
      .send({
        name: "Tenant A Exclusive Product",
        purchasePrice: 10,
        netPrice: 12,
        category: "Test",
        allergens: [],
      });
    productAId = productRes.body.data.id;
  }

  async function cleanupAll() {
    await prisma.product.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.session.deleteMany({
      where: {
        user: { email: { in: ["tenant-a@test.com", "tenant-b@test.com"] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["tenant-a@test.com", "tenant-b@test.com"] } },
    });
    await prisma.tenant.deleteMany({
      where: { slug: { in: [tenantA.slug, tenantB.slug] } },
    });
  }

  describe("Cross-tenant product access", () => {
    it("should NOT allow Tenant B to read Tenant A's product", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/products/${productAId}`)
        .set({
          Authorization: `Bearer ${sessionB}`,
          "X-Tenant-Slug": tenantB.slug,
        })
        .expect(404);
    });

    it("should NOT list Tenant A products when querying as Tenant B", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/products")
        .set({
          Authorization: `Bearer ${sessionB}`,
          "X-Tenant-Slug": tenantB.slug,
        })
        .expect(200);

      const productIds = res.body.data.map((p: any) => p.id);
      expect(productIds).not.toContain(productAId);
    });

    it("should NOT allow Tenant B to update Tenant A's product", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productAId}`)
        .set({
          Authorization: `Bearer ${sessionB}`,
          "X-Tenant-Slug": tenantB.slug,
        })
        .send({ name: "Hacked Name" })
        .expect(404);
    });

    it("should NOT allow Tenant B to delete Tenant A's product", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productAId}`)
        .set({
          Authorization: `Bearer ${sessionB}`,
          "X-Tenant-Slug": tenantB.slug,
        })
        .expect(404);
    });
  });

  describe("Tenant A can access its own data", () => {
    it("should allow Tenant A to read its own product", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${productAId}`)
        .set({
          Authorization: `Bearer ${sessionA}`,
          "X-Tenant-Slug": tenantA.slug,
        })
        .expect(200);

      expect(res.body.data.id).toBe(productAId);
    });

    it("should list Tenant A products when querying as Tenant A", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/products")
        .set({
          Authorization: `Bearer ${sessionA}`,
          "X-Tenant-Slug": tenantA.slug,
        })
        .expect(200);

      const productIds = res.body.data.map((p: any) => p.id);
      expect(productIds).toContain(productAId);
    });
  });
});
