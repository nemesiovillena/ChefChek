import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Fase 1 SICTED — éxito criterio: GET /api/v1/sicted/ping devuelve 403 con
 * el módulo apagado, 200 con el módulo activo, y 403 para VIEWER cuando la
 * sección `sicted` está restringida para ese rol (aunque el módulo esté
 * activo). Ver plans/260921-2256-sicted-calidad-turistica/phase-01-*.md.
 */
describe("E2E - SICTED module access (fase 1)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = { slug: "e2e-sicted-tenant", name: "SICTED E2E Tenant" };
  let tenantId: string;
  let adminSession: string;
  let viewerSession: string;

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

    const t = await prisma.tenant.create({
      data: { name: tenant.name, slug: tenant.slug, isActive: true },
    });
    tenantId = t.id;

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "sicted-admin@test.com",
        passwordHash,
        name: "SICTED Admin",
        tenantId,
        role: "ADMIN",
        isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        email: "sicted-viewer@test.com",
        passwordHash,
        name: "SICTED Viewer",
        tenantId,
        role: "VIEWER",
        isActive: true,
      },
    });

    const loginAdmin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenant.slug)
      .send({ email: "sicted-admin@test.com", password: "TestPass123!" });
    adminSession = loginAdmin.body.data.session.id;

    const loginViewer = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenant.slug)
      .send({ email: "sicted-viewer@test.com", password: "TestPass123!" });
    viewerSession = loginViewer.body.data.session.id;
  });

  afterAll(async () => {
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({
      where: { user: { tenantId } },
    });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  function ping(session: string) {
    return request(app.getHttpServer())
      .get("/api/v1/sicted/ping")
      .set({
        Authorization: `Bearer ${session}`,
        "X-Tenant-Slug": tenant.slug,
      });
  }

  it("módulo apagado (defaultEnabled=false, sin config) -> 403", async () => {
    const res = await ping(adminSession);
    expect(res.status).toBe(403);
  });

  it("módulo activo -> 200", async () => {
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.sicted.enabled",
        value: "true",
        updatedBy: "e2e-test",
      },
    });

    const res = await ping(adminSession);
    expect(res.status).toBe(200);
    expect(res.body.data.module).toBe("sicted");
  });

  it("módulo activo pero sección restringida para VIEWER -> 403", async () => {
    await prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: "roleAccess.VIEWER.sicted" } },
      create: {
        tenantId,
        key: "roleAccess.VIEWER.sicted",
        value: "false",
        updatedBy: "e2e-test",
      },
      update: { value: "false", updatedBy: "e2e-test" },
    });

    const res = await ping(viewerSession);
    expect(res.status).toBe(403);
  });
});
