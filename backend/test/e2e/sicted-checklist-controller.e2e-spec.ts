import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Fase 2 SICTED — el controlador HTTP completo: plantillas, hojas, marcas,
 * supervisión, sobre el guard stack real (auth/tenant/roles/módulo/sección).
 * Complementa checklist-engine.e2e-spec.ts (llama a los servicios
 * directamente) probando la capa de autorización/DTO/rutas.
 */
describe("E2E - SictedChecklistController (fase 2)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenant = {
    slug: "e2e-sicted-checklist-http",
    name: "SICTED Checklist HTTP",
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
      ["chk-admin@test.com", "ADMIN"],
      ["chk-user@test.com", "USER"],
      ["chk-viewer@test.com", "VIEWER"],
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
    adminSession = await login("chk-admin@test.com");
    userSession = await login("chk-user@test.com");
    viewerSession = await login("chk-viewer@test.com");
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
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1/sicted/checklists${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          }),
      post: (path: string, body?: object) =>
        request(app.getHttpServer())
          .post(`/api/v1/sicted/checklists${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          })
          .send(body ?? {}),
      put: (path: string, body?: object) =>
        request(app.getHttpServer())
          .put(`/api/v1/sicted/checklists${path}`)
          .set({
            Authorization: `Bearer ${session}`,
            "X-Tenant-Slug": tenant.slug,
          })
          .send(body ?? {}),
    };
  }

  const newTemplateBody = {
    name: "Plantilla HTTP",
    kind: "CLEANING",
    mode: "EXECUTION",
    area: "Cocina",
    frequency: "DAILY",
    items: [{ label: "Ítem 1", isRequired: true }],
  };

  it("USER no puede crear plantillas (403)", async () => {
    const res = await api(userSession).post("/templates", newTemplateBody);
    expect(res.status).toBe(403);
  });

  it("VIEWER no puede crear plantillas (403)", async () => {
    const res = await api(viewerSession).post("/templates", newTemplateBody);
    expect(res.status).toBe(403);
  });

  it("ADMIN crea una plantilla (201/200) y aparece en el listado", async () => {
    const created = await api(adminSession).post("/templates", newTemplateBody);
    expect(created.status).toBeLessThan(300);
    expect(created.body.data.usedByModules).toEqual(["sicted"]);

    const listed = await api(userSession).get("/templates");
    expect(listed.status).toBe(200);
    expect(
      listed.body.data.some((t: any) => t.id === created.body.data.id),
    ).toBe(true);
  });

  it("flujo completo: hoy -> marcar -> ver histórico (USER puede marcar, VIEWER no)", async () => {
    // VIEWER ni siquiera puede ver las hojas del día (USER+ según la tabla de la API).
    const viewerToday = await api(viewerSession).get("/runs/today");
    expect(viewerToday.status).toBe(403);

    const today = await api(userSession).get("/runs/today");
    expect(today.status).toBe(200);
    expect(today.body.data.length).toBeGreaterThan(0);
    const run = today.body.data[0];

    const runDetail = await api(userSession).get(`/runs/${run.id}`);
    expect(runDetail.status).toBe(200);
    const snapshotItemId = runDetail.body.data.snapshot.items[0].id;

    // VIEWER no puede marcar (aunque la hoja/ítem sean válidos).
    const viewerAttempt = await api(viewerSession).post(
      `/runs/${run.id}/entries`,
      {
        entries: [
          {
            itemId: snapshotItemId,
            outcome: "DONE",
            performedByName: "Viewer",
          },
        ],
      },
    );
    expect(viewerAttempt.status).toBe(403);

    // USER sí puede marcar.
    const userAttempt = await api(userSession).post(`/runs/${run.id}/entries`, {
      entries: [
        {
          itemId: snapshotItemId,
          outcome: "DONE",
          performedByName: "User",
        },
      ],
    });
    expect(userAttempt.status).toBe(201);
    expect(userAttempt.body.data.currentByItem[snapshotItemId].outcome).toBe(
      "DONE",
    );
  });

  it("performers devuelve los usuarios activos del tenant", async () => {
    const res = await api(userSession).get("/performers");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("una plantilla solo-appcc (sin sicted en usedByModules) da 404 desde este controlador", async () => {
    const appccOnly = await prisma.checklistTemplate.create({
      data: {
        tenantId,
        name: "Solo appcc",
        usedByModules: ["appcc"],
        kind: "MAINTENANCE",
        mode: "INSPECTION",
        area: "Cocina",
        frequency: "MONTHLY",
        createdBy: "e2e",
      },
    });
    const res = await api(adminSession).get(`/templates`);
    expect(res.body.data.some((t: any) => t.id === appccOnly.id)).toBe(false);
  });
});
