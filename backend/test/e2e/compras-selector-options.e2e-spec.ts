import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Selectores de artículo/proveedor de Compras sobre el guard stack real: un
 * USER con las secciones Artículos y Proveedores ocultas (caso cuenta de
 * cocina) debe poder sincronizar una lista con el catálogo del proveedor y
 * buscar artículos aunque los listados generales le devuelvan 403.
 */
describe("E2E - Compras (selectores de artículo y proveedor)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = {
    slug: "e2e-compras-selector-options",
    name: "Compras Selector Options",
  };
  let tenantId: string;
  let userSession: string;
  let supplierId: string;
  let otherSupplierId: string;
  let mainProductId: string;
  let offerProductId: string;

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
      ["modules.compras.enabled", "true"],
      ["roleAccess.USER.articulos", "false"],
      ["roleAccess.USER.proveedores", "false"],
    ]) {
      await prisma.configuration.create({
        data: { tenantId, key, value, updatedBy: "e2e-test" },
      });
    }

    const supplier = await prisma.supplier.create({
      data: { tenantId, name: "Proveedor Catálogo" },
    });
    supplierId = supplier.id;
    const other = await prisma.supplier.create({
      data: { tenantId, name: "Otro Proveedor" },
    });
    otherSupplierId = other.id;
    await prisma.supplier.create({
      data: { tenantId, name: "Proveedor Inactivo", isActive: false },
    });

    const product = (name: string, extra: Record<string, unknown> = {}) =>
      prisma.product.create({
        data: {
          tenantId,
          name,
          referenceUnit: "kg",
          purchasePrice: 1,
          netPrice: 1,
          ...extra,
        } as any,
      });
    const main = await product("Aceite de oliva", {
      supplierId,
      purchaseFormat: "Garrafa 5L",
    });
    mainProductId = main.id;
    const viaOffer = await product("Harina de trigo", {
      supplierId: otherSupplierId,
    });
    offerProductId = viaOffer.id;
    await prisma.productSupplierOffer.create({
      data: {
        tenantId,
        productId: viaOffer.id,
        supplierId,
        purchasePrice: 1,
        netPrice: 1,
      } as any,
    });
    await product("Aceite descatalogado", { supplierId, isActive: false });
    await product("Aceite de girasol", { supplierId: otherSupplierId });

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "compras-user@test.com",
        passwordHash,
        name: "compras-user",
        tenantId,
        role: "USER",
        isActive: true,
      },
    });
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenant.slug)
      .send({ email: "compras-user@test.com", password: "TestPass123!" });
    userSession = res.body.data.session.id as string;
  });

  afterAll(async () => {
    await prisma.productSupplierOffer.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
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

  it("USER sin sección Artículos recibe 403 en el listado general", async () => {
    const res = await get(
      `/api/v1/products?supplier=${supplierId}&isActive=true&export=true`,
    );
    expect(res.status).toBe(403);
  });

  it("USER sin sección Artículos obtiene el catálogo activo del proveedor", async () => {
    const res = await get(
      `/api/v1/compras/product-options?supplierId=${supplierId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: mainProductId,
        name: "Aceite de oliva",
        referenceUnit: "kg",
        purchaseFormat: "Garrafa 5L",
      },
      expect.objectContaining({ id: offerProductId, name: "Harina de trigo" }),
    ]);
  });

  it("la búsqueda se limita al proveedor cuando se indica", async () => {
    const scoped = await get(
      `/api/v1/compras/product-options?supplierId=${supplierId}&search=aceite`,
    );
    expect(scoped.status).toBe(200);
    expect(scoped.body.data.map((p: any) => p.name)).toEqual([
      "Aceite de oliva",
      "Aceite descatalogado",
    ]);

    const all = await get("/api/v1/compras/product-options?search=girasol");
    expect(all.body.data.map((p: any) => p.name)).toEqual([
      "Aceite de girasol",
    ]);
  });

  it("sin proveedor ni búsqueda no devuelve nada", async () => {
    const res = await get("/api/v1/compras/product-options");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("USER sin sección Proveedores ve los proveedores activos en Compras", async () => {
    const denied = await get("/api/v1/products/suppliers");
    expect(denied.status).toBe(403);

    const res = await get("/api/v1/compras/supplier-options");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: otherSupplierId, name: "Otro Proveedor" },
      { id: supplierId, name: "Proveedor Catálogo" },
    ]);
  });
});
