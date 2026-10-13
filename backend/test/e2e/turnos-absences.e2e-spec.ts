import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Turnos y ausencias: tipos, solicitudes con aprobación, saldo de
 * vacaciones, bajas registradas por gerencia y festivos. HTTP + Postgres.
 */
describe("E2E - Turnos: ausencias, vacaciones y festivos", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-turnos-absences";
  const otherSlug = "e2e-turnos-absences-other";
  let tenantId: string;
  let otherTenantId: string;
  let workerEmployeeId: string;
  let adminSession: string;
  let workerSession: string;
  let secondWorkerSession: string;
  let sharedAdminSession: string;
  let otherAdminSession: string;
  let vacationTypeId: string;
  let sickTypeId: string;
  let requestId: string;

  const year = new Date().getUTCFullYear();
  const day = (month: number, d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
      put: (path: string, data: object) =>
        request(server).put(path).set(headers).send(data),
      patch: (path: string, data: object) =>
        request(server).patch(path).set(headers).send(data),
      delete: (path: string) => request(server).delete(path).set(headers),
    };
  }
  const balance = async (session = workerSession) =>
    body(await api(session).get(`/api/v1/turnos/me/balance?year=${year}`));

  async function login(email: string, tenantSlug = slug) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({ email, password: "TestPass123!" });
    return res.body.data.session.id as string;
  }

  async function enable(id: string, modules: string[]) {
    for (const moduleId of modules) {
      await prisma.configuration.create({
        data: {
          tenantId: id,
          key: `modules.${moduleId}.enabled`,
          value: "true",
          updatedBy: "e2e-test",
        },
      });
    }
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
    tenantId = (
      await prisma.tenant.create({
        data: { name: "Turnos E2E", slug, isActive: true },
      })
    ).id;
    otherTenantId = (
      await prisma.tenant.create({
        data: { name: "Turnos E2E Otro", slug: otherSlug, isActive: true },
      })
    ).id;
    await enable(otherTenantId, ["check-in", "turnos"]);

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
    await makeUser("ta-admin@test.com", "ADMIN");
    const worker = await makeUser("ta-worker@test.com", "USER");
    const second = await makeUser("ta-second@test.com", "USER");
    await makeUser("ta-shared@test.com", "ADMIN", tenantId, true);
    await makeUser("ta-other-admin@test.com", "ADMIN", otherTenantId);

    const center = await prisma.location.create({
      data: { tenantId, name: "Restaurante", isDefault: true },
    });
    const employee = (firstName: string, userId: string) =>
      prisma.employee.create({
        data: {
          tenantId,
          userId,
          firstName,
          lastName: "Prueba",
          defaultLocationId: center.id,
          locations: { create: [{ tenantId, locationId: center.id }] },
        },
      });
    workerEmployeeId = (await employee("Marta", worker.id)).id;
    await employee("Luis", second.id);

    adminSession = await login("ta-admin@test.com");
    workerSession = await login("ta-worker@test.com");
    secondWorkerSession = await login("ta-second@test.com");
    sharedAdminSession = await login("ta-shared@test.com");
    otherAdminSession = await login("ta-other-admin@test.com", otherSlug);
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await prisma.absence.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.leaveBalance.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.absenceType.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.holiday.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.checkInSettings.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.employee.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.configuration.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: ids } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ANY(${ids})`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ANY(${ids})`;
    await app.close();
  });

  it("el módulo está apagado por defecto y depende de Check-In", async () => {
    expect(
      (await api(adminSession).get("/api/v1/turnos/absence-types")).status,
    ).toBe(403);
    await enable(tenantId, ["check-in", "turnos"]);
    expect(
      (await api(adminSession).get("/api/v1/turnos/absence-types")).status,
    ).toBe(200);
  });

  it("arranca con los tipos de ausencia habituales, sin duplicarlos", async () => {
    const types = body(
      await api(workerSession).get("/api/v1/turnos/absence-types"),
    );
    await api(workerSession).get("/api/v1/turnos/absence-types");
    expect(types.map((t: any) => t.name)).toEqual([
      "Vacaciones",
      "Asuntos propios",
      "Permiso retribuido",
      "Baja médica",
      "Ausencia no justificada",
    ]);
    expect(await prisma.absenceType.count({ where: { tenantId } })).toBe(5);
    vacationTypeId = types.find((t: any) => t.name === "Vacaciones").id;
    sickTypeId = types.find((t: any) => t.name === "Baja médica").id;
  });

  it("el saldo parte de los días del convenio (30 naturales)", async () => {
    expect(await balance()).toMatchObject({
      entitledDays: 30,
      usedDays: 0,
      pendingDays: 0,
      remainingDays: 30,
      isDefault: true,
    });
  });

  it("el empleado solicita vacaciones: quedan pendientes y no descuentan aún", async () => {
    const invalid = await api(workerSession).post(
      "/api/v1/turnos/me/absences",
      {
        absenceTypeId: vacationTypeId,
        startDate: day(8, 10),
        endDate: day(8, 3),
      },
    );
    expect(invalid.status).toBe(400);

    const res = await api(workerSession).post("/api/v1/turnos/me/absences", {
      absenceTypeId: vacationTypeId,
      startDate: day(8, 3),
      endDate: day(8, 9),
      note: "Semana de agosto",
    });
    expect(res.status).toBe(201);
    requestId = body(res).id;
    expect(body(res)).toMatchObject({
      status: "PENDING",
      days: 7,
      employeeName: "Marta Prueba",
      startDate: day(8, 3),
      endDate: day(8, 9),
    });
    expect(await balance()).toMatchObject({
      usedDays: 0,
      pendingDays: 7,
      remainingDays: 30,
    });
  });

  it("no admite solaparse con otra ausencia propia", async () => {
    const res = await api(workerSession).post("/api/v1/turnos/me/absences", {
      absenceTypeId: vacationTypeId,
      startDate: day(8, 9),
      endDate: day(8, 12),
    });
    expect(res.status).toBe(409);
  });

  it("el empleado no puede pedir más días de los que le quedan ni registrarse una baja", async () => {
    const tooMany = await api(workerSession).post(
      "/api/v1/turnos/me/absences",
      {
        absenceTypeId: vacationTypeId,
        startDate: day(9, 1),
        endDate: day(9, 30), // 30 días, con 7 ya pedidos
      },
    );
    expect(tooMany.status).toBe(400);

    const sick = await api(workerSession).post("/api/v1/turnos/me/absences", {
      absenceTypeId: sickTypeId,
      startDate: day(9, 1),
      endDate: day(9, 2),
    });
    expect(sick.status).toBe(403);
  });

  it("solo gerencia decide, desde su cuenta personal; al aprobar descuenta del saldo", async () => {
    const path = `/api/v1/turnos/absences/${requestId}/decision`;
    expect(
      (await api(workerSession).post(path, { approve: true })).status,
    ).toBe(403);
    expect(
      (await api(sharedAdminSession).post(path, { approve: true })).status,
    ).toBe(403);
    expect(
      (await api(otherAdminSession, otherSlug).post(path, { approve: true }))
        .status,
    ).toBe(404);

    const pending = body(
      await api(adminSession).get("/api/v1/turnos/absences/pending"),
    );
    expect(pending.map((a: any) => a.id)).toEqual([requestId]);

    const res = await api(adminSession).post(path, { approve: true });
    expect(body(res)).toMatchObject({
      status: "APPROVED",
      decidedByName: "ta-admin",
    });
    expect((await api(adminSession).post(path, { approve: true })).status).toBe(
      409,
    );
    expect(await balance()).toMatchObject({
      usedDays: 7,
      pendingDays: 0,
      remainingDays: 23,
    });
  });

  it("rechazar exige explicación y no descuenta", async () => {
    const requested = body(
      await api(workerSession).post("/api/v1/turnos/me/absences", {
        absenceTypeId: vacationTypeId,
        startDate: day(11, 2),
        endDate: day(11, 3),
      }),
    );
    const path = `/api/v1/turnos/absences/${requested.id}/decision`;
    expect(
      (await api(adminSession).post(path, { approve: false })).status,
    ).toBe(400);
    const rejected = await api(adminSession).post(path, {
      approve: false,
      note: "Esos días hay un evento grande",
    });
    expect(body(rejected)).toMatchObject({
      status: "REJECTED",
      decisionNote: "Esos días hay un evento grande",
    });
    expect((await balance()).remainingDays).toBe(23);
  });

  it("el empleado retira una solicitud pendiente, pero no una ya aprobada ni la de otro", async () => {
    const requested = body(
      await api(workerSession).post("/api/v1/turnos/me/absences", {
        absenceTypeId: vacationTypeId,
        startDate: day(12, 1),
        endDate: day(12, 1),
        halfDay: true,
      }),
    );
    expect(requested.days).toBe(0.5);
    expect(
      (
        await api(secondWorkerSession).post(
          `/api/v1/turnos/me/absences/${requested.id}/cancel`,
        )
      ).status,
    ).toBe(404);
    const cancelled = await api(workerSession).post(
      `/api/v1/turnos/me/absences/${requested.id}/cancel`,
    );
    expect(body(cancelled).status).toBe("CANCELLED");
    expect(
      (
        await api(workerSession).post(
          `/api/v1/turnos/me/absences/${requestId}/cancel`,
        )
      ).status,
    ).toBe(409);
  });

  it("gerencia registra una baja: queda aprobada y no toca las vacaciones", async () => {
    const res = await api(adminSession).post("/api/v1/turnos/absences", {
      employeeId: workerEmployeeId,
      absenceTypeId: sickTypeId,
      startDate: day(10, 5),
      endDate: day(10, 9),
    });
    expect(res.status).toBe(201);
    expect(body(res)).toMatchObject({ status: "APPROVED", days: 5 });
    expect((await balance()).remainingDays).toBe(23);

    const unknown = await api(adminSession).post("/api/v1/turnos/absences", {
      employeeId: "no-existe",
      absenceTypeId: sickTypeId,
      startDate: day(10, 20),
      endDate: day(10, 21),
    });
    expect(unknown.status).toBe(404);
  });

  it("cada persona ve solo sus ausencias; gerencia ve el calendario del equipo", async () => {
    const mine = body(
      await api(workerSession).get(`/api/v1/turnos/me/absences?year=${year}`),
    );
    expect(mine).toHaveLength(4);
    expect(
      body(
        await api(secondWorkerSession).get(
          `/api/v1/turnos/me/absences?year=${year}`,
        ),
      ),
    ).toEqual([]);

    const range = `from=${day(1, 1)}&to=${day(12, 31)}`;
    expect(
      (await api(workerSession).get(`/api/v1/turnos/absences?${range}`)).status,
    ).toBe(403);
    expect(
      (await api(sharedAdminSession).get(`/api/v1/turnos/absences?${range}`))
        .status,
    ).toBe(403);
    const team = body(
      await api(adminSession).get(`/api/v1/turnos/absences?${range}`),
    );
    // Solo las activas: la rechazada y la retirada no salen en el calendario.
    expect(team.map((a: any) => a.type.name).sort()).toEqual([
      "Baja médica",
      "Vacaciones",
    ]);
    expect(
      body(
        await api(otherAdminSession, otherSlug).get(
          `/api/v1/turnos/absences?${range}`,
        ),
      ),
    ).toEqual([]);
  });

  it("gerencia cancela unas vacaciones aprobadas y los días vuelven al saldo", async () => {
    const res = await api(adminSession).post(
      `/api/v1/turnos/absences/${requestId}/cancel`,
      { note: "Cambio de planes" },
    );
    expect(body(res).status).toBe("CANCELLED");
    expect(await balance()).toMatchObject({ usedDays: 0, remainingDays: 30 });
  });

  it("gerencia fija el saldo de una persona", async () => {
    const res = await api(adminSession).put(
      `/api/v1/turnos/balances/${workerEmployeeId}/${year}`,
      {
        entitledDays: 22,
        carriedOverDays: 3,
        note: "Arrastra 3 del año pasado",
      },
    );
    expect(body(res)).toMatchObject({
      entitledDays: 22,
      carriedOverDays: 3,
      remainingDays: 25,
      isDefault: false,
    });
    const all = body(
      await api(adminSession).get(`/api/v1/turnos/balances?year=${year}`),
    );
    expect(all).toHaveLength(2);
    expect(
      (
        await api(workerSession).put(
          `/api/v1/turnos/balances/${workerEmployeeId}/${year}`,
          { entitledDays: 99 },
        )
      ).status,
    ).toBe(403);
  });

  it("con cómputo en días laborables, fines de semana y festivos no consumen", async () => {
    await prisma.checkInSettings.update({
      where: { tenantId },
      data: { vacationDayType: "WORKING" },
    });
    // Lunes 12 de octubre de 2026, festivo nacional.
    const holiday = await api(adminSession).post("/api/v1/turnos/holidays", {
      date: "2026-10-12",
      name: "Fiesta Nacional",
    });
    expect(holiday.status).toBe(201);
    expect(
      (
        await api(adminSession).post("/api/v1/turnos/holidays", {
          date: "2026-10-12",
          name: "Repetido",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api(workerSession).post("/api/v1/turnos/holidays", {
          date: "2026-12-08",
          name: "No puede",
        })
      ).status,
    ).toBe(403);

    // Del sábado 10 al martes 13: solo cuenta el martes.
    const res = await api(adminSession).post("/api/v1/turnos/absences", {
      employeeId: workerEmployeeId,
      absenceTypeId: vacationTypeId,
      startDate: "2026-10-10",
      endDate: "2026-10-13",
    });
    expect(res.status).toBe(201);
    expect(body(res).days).toBe(1);

    const holidays = body(
      await api(workerSession).get("/api/v1/turnos/holidays?year=2026"),
    );
    expect(holidays).toEqual([
      expect.objectContaining({ date: "2026-10-12", name: "Fiesta Nacional" }),
    ]);
    const removed = await api(adminSession).delete(
      `/api/v1/turnos/holidays/${holidays[0].id}`,
    );
    expect(removed.status).toBe(204);
  });

  it("gerencia añade y desactiva tipos; el nombre no se repite", async () => {
    const created = await api(adminSession).post(
      "/api/v1/turnos/absence-types",
      { name: "Formación", color: "#f59e0b" },
    );
    expect(created.status).toBe(201);
    expect(
      (
        await api(adminSession).post("/api/v1/turnos/absence-types", {
          name: "Formación",
        })
      ).status,
    ).toBe(409);
    await api(adminSession).patch(
      `/api/v1/turnos/absence-types/${body(created).id}`,
      { name: "Formación", isActive: false },
    );
    const active = body(
      await api(workerSession).get("/api/v1/turnos/absence-types"),
    );
    expect(active.map((t: any) => t.name)).not.toContain("Formación");
    const all = body(
      await api(adminSession).get("/api/v1/turnos/absence-types?all=true"),
    );
    expect(all.map((t: any) => t.name)).toContain("Formación");
  });
});
