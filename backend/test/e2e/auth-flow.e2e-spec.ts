import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

describe("E2E - Auth Flow", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = "e2e-auth-test";
  const testEmail = "e2e-auth@test.com";
  const testPassword = "TestPass123!";

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
    await cleanupTestData();
    await app.close();
  });

  async function seedTestData() {
    const tenant = await prisma.tenant.create({
      data: { name: "E2E Auth Test", slug: tenantSlug, isActive: true },
    });

    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: "E2E Auth User",
        tenantId: tenant.id,
        role: "ADMIN",
        isActive: true,
      },
    });
  }

  async function cleanupTestData() {
    await prisma.session.deleteMany({
      where: { user: { email: testEmail } },
    });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.tenant.deleteMany({ where: { slug: tenantSlug } });
  }

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials and tenant slug", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenantSlug)
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.role).toBe("ADMIN");
      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.id).toBeDefined();
    });

    it("should reject invalid password", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenantSlug)
        .send({
          email: testEmail,
          password: "WrongPass!",
        })
        .expect(401);
    });

    it("should reject non-existent user", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenantSlug)
        .send({
          email: "noone@test.com",
          password: testPassword,
        })
        .expect(401);
    });

    it("should reject missing tenant slug", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      // Login without x-tenant-slug header returns success:false (TENANT_REQUIRED)
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/auth/validate", () => {
    it("should validate an active session", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenantSlug)
        .send({
          email: testEmail,
          password: testPassword,
        });

      const sessionId = loginRes.body.data.session.id;

      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Authorization", `Bearer ${sessionId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.isValid).toBe(true);
    });

    it("should reject invalid session id", async () => {
      // validateSession throws (401) for an invalid session id format
      await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Authorization", "Bearer invalid-session-id")
        .expect(401);
    });

    it("should reject missing authorization header", async () => {
      const res = await request(app.getHttpServer()).get(
        "/api/v1/auth/validate",
      );

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout and invalidate session", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenantSlug)
        .send({
          email: testEmail,
          password: testPassword,
        });

      const sessionId = loginRes.body.data.session.id;

      await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .send({ sessionId })
        .expect(204);

      // Session should be invalid after logout (validateSession throws 401)
      await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Authorization", `Bearer ${sessionId}`)
        .expect(401);
    });
  });
});
