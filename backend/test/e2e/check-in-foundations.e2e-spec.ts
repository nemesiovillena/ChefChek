import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Check-In, fundaciones: acceso por módulo y rol, fichas de empleado con PIN
 * de kiosco, convenio, geovalla del centro y textos legales que habilitan el
 * fichaje. HTTP real + Postgres real (guards, validación y constraints).
 */
describe("E2E - Check-In fundaciones", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-check-in-tenant";
  const otherSlug = "e2e-check-in-other";
  let tenantId: string;
  let otherTenantId: string;
  let locationId: string;
  let secondLocationId: string;
  let plainUserId: string;
  let adminSession: string;
  let userSession: string;
  let otherAdminSession: string;
  let employeeId: string;

  const body = (res: request.Response) => res.body?.data ?? res.body;

  function api(session: string, tenantSlug = slug) {
    const headers = {
      Authorization: `Bearer ${session}`,
      "X-Tenant-Slug": tenantSlug,
    };
    const server = app.getHttpServer();
    return {
      get: (path: string) => request(server).get(path).set(headers),
      post: (path: string, data?: object) =>
        request(server).post(path).set(headers).send(data),
      patch: (path: string, data: object) =>
        request(server).patch(path).set(headers).send(data),
      put: (path: string, data: object) =>
        request(server).put(path).set(headers).send(data),
      delete: (path: string) => request(server).delete(path).set(headers),
    };
  }

  async function login(email: string, tenantSlug: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({ email, password: "TestPass123!" });
    return res.body.data.session.id as string;
  }

  async function enableModule(id: string) {
    await prisma.configuration.create({
      data: {
        tenantId: id,
        key: "modules.check-in.enabled",
        value: "true",
        updatedBy: "e2e-test",
      },
    });
  }

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

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    const tenant = await prisma.tenant.create({
      data: { name: "Check-In E2E", slug, isActive: true },
    });
    tenantId = tenant.id;
    const other = await prisma.tenant.create({
      data: { name: "Check-In E2E Otro", slug: otherSlug, isActive: true },
    });
    otherTenantId = other.id;

    const makeUser = (
      email: string,
      role: "ADMIN" | "USER",
      owner: string,
      isSharedAccount = false,
    ) =>
      prisma.user.create({
        data: {
          email,
          passwordHash,
          name: email.split("@")[0],
          tenantId: owner,
          role,
          isActive: true,
          isSharedAccount,
        },
      });
    await makeUser("ci-admin@test.com", "ADMIN", tenantId);
    plainUserId = (await makeUser("ci-user@test.com", "USER", tenantId)).id;
    await makeUser("ci-kiosk@test.com", "USER", tenantId, true);
    await makeUser("ci-other-admin@test.com", "ADMIN", otherTenantId);

    locationId = (
      await prisma.location.create({
        data: { tenantId, name: "Restaurante", isDefault: true },
      })
    ).id;
    secondLocationId = (
      await prisma.location.create({ data: { tenantId, name: "Obrador" } })
    ).id;

    adminSession = await login("ci-admin@test.com", slug);
    userSession = await login("ci-user@test.com", slug);
    otherAdminSession = await login("ci-other-admin@test.com", otherSlug);
  });

  afterAll(async () => {
    const tenantIds = [tenantId, otherTenantId];
    await prisma.checkInLegalText.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.checkInSettings.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.employee.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.configuration.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: tenantIds } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    // Borrado físico: location.delete() haría soft-delete y bloquearía el
    // borrado del tenant en la siguiente ejecución.
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ANY(${tenantIds})`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ANY(${tenantIds})`;
    await app.close();
  });

  it("con el módulo apagado responde 403", async () => {
    const res = await api(adminSession).get("/api/v1/check-in/readiness");
    expect(res.status).toBe(403);
  });

  it("con el módulo activo, un USER consulta el estado pero no gestiona", async () => {
    await enableModule(tenantId);
    await enableModule(otherTenantId);

    const readiness = await api(userSession).get("/api/v1/check-in/readiness");
    expect(readiness.status).toBe(200);
    expect(body(readiness).ready).toBe(false);

    expect(
      (await api(userSession).get("/api/v1/check-in/employees")).status,
    ).toBe(403);
    expect(
      (await api(userSession).get("/api/v1/check-in/settings")).status,
    ).toBe(403);
    expect(
      (
        await api(userSession).post(
          "/api/v1/check-in/legal-texts/GEOLOCALIZACION/validate",
        )
      ).status,
    ).toBe(403);
  });

  it("crea un empleado con cuenta y dos centros, sin exponer el PIN", async () => {
    const linkable = await api(adminSession).get(
      "/api/v1/check-in/employees/linkable-users",
    );
    const emails = body(linkable).map((u: any) => u.email);
    expect(emails).toContain("ci-user@test.com");
    expect(emails).not.toContain("ci-kiosk@test.com");

    const res = await api(adminSession).post("/api/v1/check-in/employees", {
      firstName: "Marta",
      lastName: "Ruiz",
      nationalId: "00000000T",
      weeklyHours: 30,
      userId: plainUserId,
      locationIds: [locationId, secondLocationId],
      defaultLocationId: secondLocationId,
      hireDate: "2026-01-15",
    });
    expect(res.status).toBe(201);
    const employee = body(res);
    employeeId = employee.id;
    expect(employee.locationIds.sort()).toEqual(
      [locationId, secondLocationId].sort(),
    );
    expect(employee.defaultLocationId).toBe(secondLocationId);
    expect(employee.hasPin).toBe(false);
    expect(employee.pinHash).toBeUndefined();

    // La cuenta ya no está libre y no puede vincularse a otro empleado.
    const again = await api(adminSession).post("/api/v1/check-in/employees", {
      firstName: "Otro",
      lastName: "Empleado",
      userId: plainUserId,
    });
    expect(again.status).toBe(409);
  });

  it("asigna el PIN de kiosco con la longitud configurada", async () => {
    const tooLong = await api(adminSession).put(
      `/api/v1/check-in/employees/${employeeId}/pin`,
      { pin: "123456" },
    );
    expect(tooLong.status).toBe(400);

    const ok = await api(adminSession).put(
      `/api/v1/check-in/employees/${employeeId}/pin`,
      { pin: "4821" },
    );
    expect(ok.status).toBe(204);

    const stored = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    expect(stored?.pinHash).toBeTruthy();
    expect(stored?.pinHash).not.toContain("4821");

    const view = await api(adminSession).get(
      `/api/v1/check-in/employees/${employeeId}`,
    );
    expect(body(view).hasPin).toBe(true);
    expect(JSON.stringify(view.body)).not.toContain(stored!.pinHash!);
  });

  it("otro tenant no ve ni modifica al empleado", async () => {
    const other = api(otherAdminSession, otherSlug);
    expect(body(await other.get("/api/v1/check-in/employees"))).toEqual([]);
    expect(
      (await other.get(`/api/v1/check-in/employees/${employeeId}`)).status,
    ).toBe(404);
    expect(
      (
        await other.patch(`/api/v1/check-in/employees/${employeeId}`, {
          firstName: "Intruso",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await other.patch(
          `/api/v1/check-in/work-centers/${locationId}/geofence`,
          { geofenceRadiusM: 50 },
        )
      ).status,
    ).toBe(404);
  });

  it("dar de baja conserva la ficha y la saca del listado por defecto", async () => {
    const res = await api(adminSession).patch(
      `/api/v1/check-in/employees/${employeeId}`,
      { isActive: false, terminationDate: "2026-09-30" },
    );
    expect(res.status).toBe(200);
    expect(
      body(await api(adminSession).get("/api/v1/check-in/employees")),
    ).toEqual([]);
    const all = await api(adminSession).get(
      "/api/v1/check-in/employees?includeInactive=true",
    );
    expect(body(all)).toHaveLength(1);
  });

  it("aplica el convenio de hostelería y guarda el interruptor de pausas", async () => {
    const initial = body(
      await api(adminSession).get("/api/v1/check-in/settings"),
    );
    expect(initial.settings.breaksCountAsWork).toBe(false);
    expect(initial.presets.map((p: any) => p.key)).toContain("hosteleria");

    const applied = await api(adminSession).post(
      "/api/v1/check-in/settings/agreement",
      { agreementKey: "hosteleria" },
    );
    expect(body(applied).agreementKey).toBe("hosteleria");

    const updated = await api(adminSession).patch("/api/v1/check-in/settings", {
      breaksCountAsWork: true,
      vacationDays: 31,
    });
    expect(body(updated).breaksCountAsWork).toBe(true);
    expect(body(updated).vacationDays).toBe(31);

    const invalid = await api(adminSession).patch("/api/v1/check-in/settings", {
      nightStart: "25:00",
    });
    expect(invalid.status).toBe(400);
  });

  it("guarda la geovalla del centro y exige latitud y longitud juntas", async () => {
    const half = await api(adminSession).patch(
      `/api/v1/check-in/work-centers/${locationId}/geofence`,
      { latitude: 38.63 },
    );
    expect(half.status).toBe(400);

    const ok = await api(adminSession).patch(
      `/api/v1/check-in/work-centers/${locationId}/geofence`,
      {
        latitude: 38.63,
        longitude: -0.86,
        geofenceRadiusM: 120,
        geofenceMode: "BLOCK",
      },
    );
    expect(ok.status).toBe(200);
    expect(body(ok)).toMatchObject({
      latitude: 38.63,
      longitude: -0.86,
      geofenceRadiusM: 120,
      geofenceMode: "BLOCK",
    });

    const centers = body(
      await api(adminSession).get("/api/v1/check-in/work-centers"),
    );
    expect(centers).toHaveLength(2);
  });

  it("los textos legales validados habilitan el fichaje", async () => {
    const admin = api(adminSession);
    const texts = body(await admin.get("/api/v1/check-in/legal-texts"));
    expect(texts).toHaveLength(3);
    expect(texts.every((t: any) => t.current === null)).toBe(true);

    // El borrador trae campos entre corchetes: no se puede validar tal cual.
    const premature = await admin.post(
      "/api/v1/check-in/legal-texts/GEOLOCALIZACION/validate",
    );
    expect(premature.status).toBe(400);

    for (const text of texts) {
      const saved = await admin.put(
        `/api/v1/check-in/legal-texts/${text.kind}`,
        { content: `Texto definitivo de la empresa para ${text.kind}.` },
      );
      expect(saved.status).toBe(200);
      const validated = await admin.post(
        `/api/v1/check-in/legal-texts/${text.kind}/validate`,
      );
      expect(validated.status).toBe(201);
      expect(body(validated).validatedByName).toBe("ci-admin");
    }

    expect(body(await admin.get("/api/v1/check-in/readiness"))).toEqual({
      ready: true,
      missing: [],
    });
    // La validación es por tenant.
    expect(
      body(
        await api(otherAdminSession, otherSlug).get(
          "/api/v1/check-in/readiness",
        ),
      ).ready,
    ).toBe(false);
  });

  it("editar un texto validado abre versión nueva sin bloquear el fichaje", async () => {
    const admin = api(adminSession);
    await admin.put("/api/v1/check-in/legal-texts/GEOLOCALIZACION", {
      content: "Texto de geolocalización revisado por segunda vez.",
    });
    const state = body(await admin.get("/api/v1/check-in/legal-texts")).find(
      (t: any) => t.kind === "GEOLOCALIZACION",
    );
    expect(state.latest.version).toBe(2);
    expect(state.current.version).toBe(1);
    expect(state.hasPendingChanges).toBe(true);
    expect(body(await admin.get("/api/v1/check-in/readiness")).ready).toBe(
      true,
    );
  });

  it("rechaza un tipo de texto inexistente", async () => {
    const res = await api(adminSession).put(
      "/api/v1/check-in/legal-texts/INVENTADO",
      { content: "Contenido suficientemente largo para pasar la validación." },
    );
    expect(res.status).toBe(400);
  });
});
