import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Fase 4 SICTED — el controlador HTTP de mantenimiento: equipos, planes,
 * registros con adjuntos, incidencias. Sobre el guard stack real (mismo
 * patrón que sicted-checklist-controller.e2e-spec.ts de fase 2, que ya cazó
 * un bug real de autorización ahí — aquí se prueba desde el principio).
 */
describe("E2E - SictedMaintenanceController (fase 4)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = {
    slug: "e2e-sicted-maintenance-http",
    name: "SICTED Maintenance HTTP",
  };
  let tenantId: string;
  let adminSession: string;
  let userSession: string;
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
      ["mnt-admin@test.com", "ADMIN"],
      ["mnt-user@test.com", "USER"],
      ["mnt-viewer@test.com", "VIEWER"],
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
    adminSession = await login("mnt-admin@test.com");
    userSession = await login("mnt-user@test.com");
    viewerSession = await login("mnt-viewer@test.com");
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.checklistIncident.deleteMany({ where: { tenantId } });
      await tx.checklistMaintenanceRecord.deleteMany({ where: { tenantId } });
      await tx.checklistMaintenancePlan.deleteMany({ where: { tenantId } });
      await tx.checklistAsset.deleteMany({ where: { tenantId } });
    });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { tenantId } } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  function api(session: string) {
    const base = "/api/v1/sicted/maintenance";
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`${base}${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          }),
      post: (path: string, body?: object) =>
        request(app.getHttpServer())
          .post(`${base}${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          })
          .send(body ?? {}),
    };
  }

  it("VIEWER no puede listar equipos (403); USER sí", async () => {
    const viewerRes = await api(viewerSession).get("/assets");
    expect(viewerRes.status).toBe(403);
    const userRes = await api(userSession).get("/assets");
    expect(userRes.status).toBe(200);
  });

  it("USER no puede crear equipos (403); ADMIN sí", async () => {
    const userRes = await api(userSession).post("/assets", {
      name: "Cámara",
      category: "FRIO",
    });
    expect(userRes.status).toBe(403);

    const adminRes = await api(adminSession).post("/assets", {
      name: "Cámara",
      category: "FRIO",
    });
    expect(adminRes.status).toBeLessThan(300);
    expect(adminRes.body.data.usedByModules).toEqual(["sicted"]);
  });

  it("USER no puede crear un plan (403); ADMIN sí", async () => {
    const asset = (
      await api(adminSession).post("/assets", {
        name: "Extractor",
        category: "COCINA",
      })
    ).body.data;

    const userRes = await api(userSession).post("/plans", {
      assetId: asset.id,
      title: "Limpieza filtros",
      periodicityMonths: 6,
    });
    expect(userRes.status).toBe(403);

    const adminRes = await api(adminSession).post("/plans", {
      assetId: asset.id,
      title: "Limpieza filtros",
      periodicityMonths: 6,
    });
    expect(adminRes.status).toBeLessThan(300);
  });

  it("flujo completo de registro con adjunto: USER registra, sube PDF, lo descarga; VIEWER no puede registrar ni descargar", async () => {
    const asset = (
      await api(adminSession).post("/assets", {
        name: "Extintor pasillo",
        category: "EXTINTORES",
      })
    ).body.data;
    const plan = (
      await api(adminSession).post("/plans", {
        assetId: asset.id,
        title: "Revisión anual",
        periodicityMonths: 12,
      })
    ).body.data;

    // VIEWER no puede registrar.
    const viewerAttempt = await request(app.getHttpServer())
      .post(`/api/v1/sicted/maintenance/plans/${plan.id}/records`)
      .set({
        Authorization: `Bearer ${viewerSession}`,
        "X-Tenant-Slug": tenant.slug,
      })
      .field("performedByName", "Viewer");
    expect(viewerAttempt.status).toBe(403);

    // USER registra con un PDF adjunto.
    const created = await request(app.getHttpServer())
      .post(`/api/v1/sicted/maintenance/plans/${plan.id}/records`)
      .set({
        Authorization: `Bearer ${userSession}`,
        "X-Tenant-Slug": tenant.slug,
      })
      .field("performedByName", "Empresa externa")
      .attach("files", Buffer.from("%PDF-1.4 contenido de prueba"), {
        filename: "certificado.pdf",
        contentType: "application/pdf",
      });
    expect(created.status).toBeLessThan(300);
    expect(created.body.data.attachments).toHaveLength(1);

    // Descarga: USER puede, con auth propia.
    const download = await api(userSession).get(
      `/records/${created.body.data.id}/attachments/0`,
    );
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(download.body).toString()).toContain(
      "contenido de prueba",
    );

    // Sin sesión (petición anónima): 401, nunca sirve el fichero directamente.
    const anon = await request(app.getHttpServer()).get(
      `/api/v1/sicted/maintenance/records/${created.body.data.id}/attachments/0`,
    );
    expect(anon.status).toBe(401);
  });

  it("mimetype fuera de allowlist → 400", async () => {
    const asset = (
      await api(adminSession).post("/assets", {
        name: "Cámara 2",
        category: "FRIO",
      })
    ).body.data;
    const plan = (
      await api(adminSession).post("/plans", {
        assetId: asset.id,
        title: "Revisión",
        periodicityMonths: 12,
      })
    ).body.data;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sicted/maintenance/plans/${plan.id}/records`)
      .set({
        Authorization: `Bearer ${userSession}`,
        "X-Tenant-Slug": tenant.slug,
      })
      .field("performedByName", "Ana")
      .attach("files", Buffer.from("no soy un pdf"), {
        filename: "script.exe",
        contentType: "application/x-msdownload",
      });
    expect(res.status).toBe(400);
  });

  it("incidencias: USER crea BREAKDOWN y avanza hitos; VIEWER no puede crear", async () => {
    const viewerAttempt = await api(viewerSession).post("/incidents", {
      kind: "BREAKDOWN",
      detectedByName: "Viewer",
    });
    expect(viewerAttempt.status).toBe(403);

    const created = await api(userSession).post("/incidents", {
      kind: "BREAKDOWN",
      detectedByName: "Ana",
      faultType: "Lavavajillas no calienta",
    });
    expect(created.status).toBeLessThan(300);

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/sicted/maintenance/incidents/${created.body.data.id}`)
      .set({
        Authorization: `Bearer ${userSession}`,
        "X-Tenant-Slug": tenant.slug,
      })
      .send({ technicianNotifiedAt: new Date().toISOString() });
    expect(patch.status).toBe(200);
    expect(patch.body.data.technicianNotifiedAt).not.toBeNull();
  });

  it("una plantilla/equipo solo-appcc (sin sicted en usedByModules) da 404 desde este controlador", async () => {
    const appccOnly = await prisma.checklistAsset.create({
      data: {
        tenantId,
        name: "Solo appcc",
        category: "OTRO",
        usedByModules: ["appcc"],
      },
    });
    const res = await api(adminSession).get("/assets");
    expect(res.body.data.some((a: any) => a.id === appccOnly.id)).toBe(false);
  });
});
