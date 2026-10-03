import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Selectores de proveedor/albarán de SICTED sobre el guard stack real: un
 * USER con la sección Proveedores oculta (caso cuenta compartida) debe poder
 * elegir proveedor al registrar una incidencia aunque el listado general de
 * Proveedores le devuelva 403.
 */
describe("E2E - SictedSuppliersController (selectores)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = {
    slug: "e2e-sicted-suppliers-http",
    name: "SICTED Suppliers HTTP",
  };
  let tenantId: string;
  let userSession: string;
  let activeSupplierId: string;

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
    for (const [key, value] of [
      ["modules.sicted.enabled", "true"],
      ["roleAccess.USER.proveedores", "false"],
      ["roleAccess.USER.albaranes", "false"],
    ]) {
      await prisma.configuration.create({
        data: { tenantId, key, value, updatedBy: "e2e-test" },
      });
    }

    const active = await prisma.supplier.create({
      data: { tenantId, name: "Proveedor Activo" },
    });
    activeSupplierId = active.id;
    await prisma.supplier.create({
      data: { tenantId, name: "Proveedor Inactivo", isActive: false },
    });

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "prov-user@test.com",
        passwordHash,
        name: "prov-user",
        tenantId,
        role: "USER",
        isActive: true,
      },
    });
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenant.slug)
      .send({ email: "prov-user@test.com", password: "TestPass123!" });
    userSession = res.body.data.session.id as string;
  });

  afterAll(async () => {
    await prisma.supplier.deleteMany({ where: { tenantId } });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { tenantId } } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set({
        Authorization: `Bearer ${userSession}`,
        "X-Tenant-Slug": tenant.slug,
      });

  it("USER sin sección Proveedores recibe 403 en el listado general", async () => {
    const res = await get("/api/v1/products/suppliers");
    expect(res.status).toBe(403);
  });

  it("USER sin sección Proveedores ve los proveedores activos en SICTED", async () => {
    const res = await get("/api/v1/sicted/suppliers/options");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: activeSupplierId, name: "Proveedor Activo" },
    ]);
  });

  it("USER sin sección Albaranes obtiene los albaranes del proveedor", async () => {
    const res = await get(
      `/api/v1/sicted/suppliers/albaran-options?supplierId=${activeSupplierId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("albaran-options sin supplierId → 400", async () => {
    const res = await get("/api/v1/sicted/suppliers/albaran-options");
    expect(res.status).toBe(400);
  });
});
