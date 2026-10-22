import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Portal del empleado ("Mi espacio"): mis datos, cambio de datos con
 * aprobación, peticiones libres y la lista única de solicitudes. HTTP real +
 * Postgres real. Lo crítico es el aislamiento: nadie ve ni toca lo de otro.
 */
describe("E2E - RRHH: Mi espacio y solicitudes", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-rrhh-mi-espacio";
  const otherSlug = "e2e-rrhh-mi-espacio-other";
  let tenantId: string;
  let otherTenantId: string;
  let martaUserId: string;
  let martaEmployeeId: string;
  let adminSession: string;
  let secondAdminSession: string;
  let martaSession: string;
  let luisSession: string;
  let noFichaSession: string;
  let sharedAdminSession: string;
  let otherAdminSession: string;
  let dataChangeId: string;

  const body = (res: request.Response) => res.body?.data ?? res.body;
  const ME = "/api/v1/rrhh/me";
  const INBOX = "/api/v1/rrhh/requests";

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
    };
  }

  async function login(email: string, tenantSlug = slug) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({ email, password: "TestPass123!" });
    return res.body.data.session.id as string;
  }

  const setModule = (owner: string, moduleId: string, enabled: boolean) =>
    prisma.configuration.upsert({
      where: {
        tenantId_key: { tenantId: owner, key: `modules.${moduleId}.enabled` },
      },
      update: { value: String(enabled) },
      create: {
        tenantId: owner,
        key: `modules.${moduleId}.enabled`,
        value: String(enabled),
        updatedBy: "e2e-test",
      },
    });

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
    const makeTenant = async (name: string, s: string, modules: string[]) => {
      const tenant = await prisma.tenant.create({
        data: { name, slug: s, isActive: true },
      });
      for (const moduleId of modules) {
        await setModule(tenant.id, moduleId, true);
      }
      return tenant.id;
    };
    tenantId = await makeTenant("Mi espacio E2E", slug, [
      "check-in",
      "turnos",
      "rrhh",
    ]);
    // El otro tenant tiene Check-In pero no el portal.
    otherTenantId = await makeTenant("Mi espacio E2E Otro", otherSlug, [
      "check-in",
    ]);

    const makeUser = (
      email: string,
      role: "ADMIN" | "USER",
      owner = tenantId,
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
    const admin = await makeUser("me-admin@test.com", "ADMIN");
    await makeUser("me-admin2@test.com", "ADMIN");
    const marta = await makeUser("me-marta@test.com", "USER");
    const luis = await makeUser("me-luis@test.com", "USER");
    await makeUser("me-noficha@test.com", "USER");
    await makeUser("me-shared@test.com", "ADMIN", tenantId, true);
    await makeUser("me-other-admin@test.com", "ADMIN", otherTenantId);
    martaUserId = marta.id;
    // El puesto que ve cada persona es el de Empleados → Puestos.
    const cook = await prisma.sictedJobProfile.create({
      data: { tenantId, title: "Cocinera" },
    });
    await prisma.sictedJobAssignment.create({
      data: {
        tenantId,
        profileId: cook.id,
        userId: marta.id,
        userName: marta.name,
      },
    });

    const center = await prisma.location.create({
      data: { tenantId, name: "Restaurante", isDefault: true, timezone: "UTC" },
    });
    const employee = (firstName: string, userId: string) =>
      prisma.employee.create({
        data: {
          tenantId,
          userId,
          firstName,
          lastName: "Prueba",
          jobTitle: "Cocinera",
          weeklyHours: 40,
          hourlyCost: 14.5,
          defaultLocationId: center.id,
          locations: { create: [{ tenantId, locationId: center.id }] },
        },
      });
    martaEmployeeId = (await employee("Marta", marta.id)).id;
    await employee("Luis", luis.id);
    await employee("Admin", admin.id);

    adminSession = await login("me-admin@test.com");
    secondAdminSession = await login("me-admin2@test.com");
    martaSession = await login("me-marta@test.com");
    luisSession = await login("me-luis@test.com");
    noFichaSession = await login("me-noficha@test.com");
    sharedAdminSession = await login("me-shared@test.com");
    otherAdminSession = await login("me-other-admin@test.com", otherSlug);
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.timePunchAdjustment.deleteMany({
        where: { tenantId: { in: ids } },
      });
    });
    await prisma.employeeRequest.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.absence.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.absenceType.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.checkInSettings.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.employee.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.sictedJobAssignment.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.sictedJobProfile.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.configuration.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: ids } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ANY(${ids})`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ANY(${ids})`;
    await app.close();
  });

  it("el portal está apagado por defecto", async () => {
    const res = await api(otherAdminSession, otherSlug).get(`${ME}/profile`);
    expect(res.status).toBe(403);
    expect((await api(otherAdminSession, otherSlug).get(INBOX)).status).toBe(
      403,
    );
  });

  it("cada persona ve sus datos, sin el coste hora", async () => {
    const res = await api(martaSession).get(`${ME}/profile`);
    expect(res.status).toBe(200);
    expect(body(res)).toMatchObject({
      employeeId: martaEmployeeId,
      name: "Marta Prueba",
      email: "me-marta@test.com",
      personal: { phone: null, nationalId: null },
      job: { jobTitle: "Cocinera", weeklyHours: 40, centers: ["Restaurante"] },
    });
    expect(JSON.stringify(body(res))).not.toMatch(/cost/i);
  });

  it("sin ficha o desde una cuenta compartida no hay espacio propio", async () => {
    for (const session of [noFichaSession, sharedAdminSession]) {
      for (const path of ["profile", "requests"]) {
        expect((await api(session).get(`${ME}/${path}`)).status).toBe(403);
      }
      expect(
        (
          await api(session).post(`${ME}/requests`, {
            kind: "OTHER",
            message: "Hola",
          })
        ).status,
      ).toBe(403);
    }
  });

  it("pide un cambio de datos y no se aplica hasta que se aprueba", async () => {
    const empty = await api(martaSession).post(`${ME}/requests`, {
      kind: "DATA_CHANGE",
      changes: { phone: "   " },
    });
    expect(empty.status).toBe(400);
    // Solo se pueden proponer datos personales: ni nombre, ni puesto, ni coste.
    for (const changes of [
      { hourlyCost: 99 },
      { jobTitle: "Jefa" },
      { firstName: "Otra" },
    ]) {
      const res = await api(martaSession).post(`${ME}/requests`, {
        kind: "DATA_CHANGE",
        changes,
      });
      expect(res.status).toBe(400);
    }

    const res = await api(martaSession).post(`${ME}/requests`, {
      kind: "DATA_CHANGE",
      changes: { phone: "600 111 222", nationalId: "12345678Z" },
      message: "He cambiado de número",
    });
    expect(res.status).toBe(201);
    dataChangeId = body(res).id;
    expect(body(res)).toMatchObject({
      status: "PENDING",
      summary:
        "Teléfono: 600 111 222 · DNI/NIE: 12345678Z · He cambiado de número",
    });

    const profile = body(await api(martaSession).get(`${ME}/profile`));
    expect(profile.personal).toMatchObject({ phone: null, nationalId: null });

    const again = await api(martaSession).post(`${ME}/requests`, {
      kind: "DATA_CHANGE",
      changes: { city: "Elche" },
    });
    expect(again.status).toBe(409);
  });

  it("nadie ve ni retira las solicitudes de otra persona", async () => {
    expect(body(await api(luisSession).get(`${ME}/requests`))).toEqual([]);
    expect(
      (await api(luisSession).post(`${ME}/requests/${dataChangeId}/cancel`))
        .status,
    ).toBe(404);
    // La bandeja y las decisiones son de gerencia, desde su cuenta personal.
    for (const session of [martaSession, luisSession, sharedAdminSession]) {
      expect((await api(session).get(INBOX)).status).toBe(403);
      expect(
        (
          await api(session).post(`${INBOX}/${dataChangeId}/decision`, {
            approve: true,
          })
        ).status,
      ).toBe(403);
    }
    const stillPending = await prisma.employeeRequest.findUniqueOrThrow({
      where: { id: dataChangeId },
    });
    expect(stillPending.status).toBe("PENDING");
  });

  it("gerencia aprueba y entonces cambian la cuenta y la ficha", async () => {
    const inbox = body(await api(adminSession).get(INBOX));
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      id: dataChangeId,
      employeeName: "Marta Prueba",
      kind: "DATA_CHANGE",
      changes: { phone: "600 111 222", nationalId: "12345678Z" },
    });

    const noNote = await api(adminSession).post(
      `${INBOX}/${dataChangeId}/decision`,
      { approve: false },
    );
    expect(noNote.status).toBe(400);

    const res = await api(adminSession).post(
      `${INBOX}/${dataChangeId}/decision`,
      { approve: true },
    );
    expect(res.status).toBe(201);
    expect(body(res)).toMatchObject({
      status: "APPROVED",
      decidedByName: "me-admin",
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: martaUserId },
    });
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: martaEmployeeId },
    });
    expect(user.phone).toBe("600 111 222");
    expect(employee.nationalId).toBe("12345678Z");
    // Lo que no se pidió cambiar sigue igual.
    expect(employee.jobTitle).toBe("Cocinera");
    expect(employee.hourlyCost).toBe(14.5);

    const twice = await api(adminSession).post(
      `${INBOX}/${dataChangeId}/decision`,
      { approve: false, note: "Tarde" },
    );
    expect(twice.status).toBe(409);
    expect(body(await api(adminSession).get(INBOX))).toEqual([]);
    expect(body(await api(adminSession).get(`${INBOX}?all=true`))).toHaveLength(
      1,
    );
  });

  it("rechazar exige explicación y no cambia nada", async () => {
    const created = body(
      await api(martaSession).post(`${ME}/requests`, {
        kind: "DATA_CHANGE",
        changes: { city: "Elche" },
      }),
    );
    const res = await api(adminSession).post(
      `${INBOX}/${created.id}/decision`,
      { approve: false, note: "Trae el empadronamiento" },
    );
    expect(body(res)).toMatchObject({
      status: "REJECTED",
      decisionNote: "Trae el empadronamiento",
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: martaUserId },
    });
    expect(user.city).toBeNull();
  });

  it("nadie decide su propia solicitud", async () => {
    const created = body(
      await api(adminSession).post(`${ME}/requests`, {
        kind: "DATA_CHANGE",
        changes: { phone: "611 000 000" },
      }),
    );
    const own = await api(adminSession).post(
      `${INBOX}/${created.id}/decision`,
      { approve: true },
    );
    expect(own.status).toBe(403);
    const other = await api(secondAdminSession).post(
      `${INBOX}/${created.id}/decision`,
      { approve: true },
    );
    expect(other.status).toBe(201);
  });

  it("petición libre: exige texto y se puede retirar mientras está pendiente", async () => {
    const empty = await api(luisSession).post(`${ME}/requests`, {
      kind: "OTHER",
    });
    expect(empty.status).toBe(400);

    const created = body(
      await api(luisSession).post(`${ME}/requests`, {
        kind: "OTHER",
        message: "Necesito un certificado de empresa",
      }),
    );
    expect(created).toMatchObject({ kind: "OTHER", status: "PENDING" });

    const cancel = `${ME}/requests/${created.id}/cancel`;
    expect((await api(martaSession).post(cancel)).status).toBe(404);
    expect(body(await api(luisSession).post(cancel)).status).toBe("CANCELLED");
    expect((await api(luisSession).post(cancel)).status).toBe(409);
    expect(
      (
        await api(adminSession).post(`${INBOX}/${created.id}/decision`, {
          approve: true,
        })
      ).status,
    ).toBe(409);
  });

  it("mis solicitudes reúne cambios de datos, correcciones de fichaje y ausencias", async () => {
    const adjustment = await api(martaSession).post(
      "/api/v1/check-in/me/adjustments",
      {
        kind: "ADD",
        type: "OUT",
        occurredAt: "2026-09-03T17:00:00.000Z",
        reason: "Olvidé fichar la salida",
      },
    );
    expect(adjustment.status).toBe(201);
    const types = body(
      await api(martaSession).get("/api/v1/turnos/absence-types"),
    );
    const year = new Date().getUTCFullYear() + 1;
    const absence = await api(martaSession).post("/api/v1/turnos/me/absences", {
      absenceTypeId: types.find((t: any) => t.name === "Vacaciones").id,
      startDate: `${year}-03-02`,
      endDate: `${year}-03-06`,
    });
    expect(absence.status).toBe(201);

    const items = body(await api(martaSession).get(`${ME}/requests`));
    expect(items.map((i: any) => i.source).sort()).toEqual([
      "ABSENCE",
      "ADJUSTMENT",
      "REQUEST",
      "REQUEST",
    ]);
    expect(items.find((i: any) => i.source === "ABSENCE")).toMatchObject({
      title: `Vacaciones: 02/03/${year} – 06/03/${year}`,
      status: "PENDING",
    });
    expect(items.find((i: any) => i.source === "ADJUSTMENT")).toMatchObject({
      title: "Corrección de fichaje del 03/09/2026",
      detail: "Olvidé fichar la salida",
      status: "PENDING",
    });
    // Las de Luis no aparecen en la lista de Marta.
    expect(JSON.stringify(items)).not.toContain("certificado");

    // Sin el módulo de turnos, las ausencias no se listan.
    await setModule(tenantId, "turnos", false);
    const withoutTurnos = body(await api(martaSession).get(`${ME}/requests`));
    expect(withoutTurnos.map((i: any) => i.source)).not.toContain("ABSENCE");
    expect(withoutTurnos).toHaveLength(3);
    await setModule(tenantId, "turnos", true);
  });

  it("no cruza datos entre tenants", async () => {
    await setModule(otherTenantId, "rrhh", true);
    const other = api(otherAdminSession, otherSlug);
    expect(body(await other.get(`${INBOX}?all=true`))).toEqual([]);
    const pending = body(
      await api(luisSession).post(`${ME}/requests`, {
        kind: "OTHER",
        message: "Otra cosa",
      }),
    );
    expect(
      (await other.post(`${INBOX}/${pending.id}/decision`, { approve: true }))
        .status,
    ).toBe(404);
  });
});
