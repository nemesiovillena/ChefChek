import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Fase 5 SICTED — el controlador HTTP del pack de auditoría: PDFs, CSV,
 * cobertura, sobre el guard stack real. Mismo patrón que los controladores
 * de fases 2/4 (que ya cazaron bugs reales de autorización ahí).
 */
describe("E2E - SictedAuditController (fase 5)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = { slug: "e2e-sicted-audit-http", name: "SICTED Audit HTTP" };
  let tenantId: string;
  let adminSession: string;
  let viewerSession: string;
  let templateId: string;

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
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.sicted.enabled",
        value: "true",
        updatedBy: "e2e-test",
      },
    });

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    for (const [email, role] of [
      ["audit-admin@test.com", "ADMIN"],
      ["audit-viewer@test.com", "VIEWER"],
    ] as const) {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: email,
          tenantId,
          role,
          isActive: true,
        },
      });
    }
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("x-tenant-slug", tenant.slug)
        .send({ email, password: "TestPass123!" });
      return res.body.data.session.id as string;
    };
    adminSession = await login("audit-admin@test.com");
    viewerSession = await login("audit-viewer@test.com");

    // Datos mínimos: una plantilla con una hoja marcada, para que los PDFs/CSV/cobertura tengan algo que mostrar.
    const template = await request(app.getHttpServer())
      .post("/api/v1/sicted/checklists/templates")
      .set({
        Authorization: `Bearer ${adminSession}`,
        "X-Tenant-Slug": tenant.slug,
      })
      .send({
        name: "Plantilla Auditoría HTTP",
        kind: "CLEANING",
        mode: "EXECUTION",
        area: "Cocina",
        frequency: "DAILY",
        items: [{ label: "Ítem", isRequired: true }],
      });
    templateId = template.body.data.id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.checklistEntry.deleteMany({ where: { tenantId } });
      await tx.checklistRun.deleteMany({ where: { tenantId } });
      await tx.checklistTemplateItem.deleteMany({ where: { tenantId } });
      await tx.checklistTemplate.deleteMany({ where: { tenantId } });
    });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { tenantId } } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  function api(session: string) {
    const base = "/api/v1/sicted/audit";
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`${base}${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          }),
    };
  }

  it("VIEWER no puede descargar plan.pdf (403); ADMIN sí (200, application/pdf)", async () => {
    const viewerRes = await api(viewerSession).get("/plan.pdf");
    expect(viewerRes.status).toBe(403);

    const adminRes = await api(adminSession).get("/plan.pdf");
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers["content-type"]).toContain("application/pdf");
  });

  it("registros.pdf exige templateId y month", async () => {
    const missing = await api(adminSession).get("/registros.pdf");
    expect(missing.status).toBe(400);

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const ok = await api(adminSession).get(
      `/registros.pdf?templateId=${templateId}&month=${month}`,
    );
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");
  });

  it("mantenimiento.pdf usa el año actual por defecto", async () => {
    const res = await api(adminSession).get("/mantenimiento.pdf");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("registros.csv exige from/to válidos", async () => {
    const invalid = await api(adminSession).get(
      "/registros.csv?from=abc&to=def",
    );
    expect(invalid.status).toBe(400);

    const ok = await api(adminSession).get(
      "/registros.csv?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z",
    );
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("text/csv");
  });

  it("coverage devuelve el reporte con expected/gaps", async () => {
    const res = await api(adminSession).get(
      "/coverage?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z",
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("expected");
    expect(res.body.data).toHaveProperty("gaps");
  });
});
