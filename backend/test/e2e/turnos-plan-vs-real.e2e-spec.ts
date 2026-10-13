import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Turnos: avisos legales al planificar, coste estimado y turnos publicados
 * frente a lo fichado. HTTP real + Postgres real.
 */
describe("E2E - Turnos: plan frente a real, avisos y coste", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-turnos-plan-real";
  const otherSlug = "e2e-turnos-plan-real-other";
  let tenantId: string;
  let otherTenantId: string;
  let centerId: string;
  let martaId: string;
  let luisId: string;
  let adminSession: string;
  let martaSession: string;
  let sharedAdminSession: string;
  let otherAdminSession: string;

  // Una semana ya pasada (el lunes de hace dos semanas), con el centro en UTC
  // para no depender del horario de verano.
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 14);
  /** Fecha del día `offset` de la semana (0 = lunes). */
  const day = (offset: number) =>
    new Date(monday.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  const WEEK = day(0);
  const today = now.toISOString().slice(0, 10);
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
    };
  }
  const query = `locationId=CENTER&weekStart=${WEEK}`;
  const path = (name: string) =>
    `/api/v1/turnos/${name}?${query.replace("CENTER", centerId)}`;
  const week = async () => body(await api(adminSession).get(path("schedule")));
  const planVsActual = async () =>
    body(await api(adminSession).get(path("schedule/plan-vs-actual")));
  const settings = (data: object) =>
    api(adminSession).patch("/api/v1/check-in/settings", data);
  const rowOf = (rows: any[], employeeId: string, offset: number) =>
    rows.find((r) => r.employeeId === employeeId && r.date === day(offset));

  async function shift(
    employeeId: string,
    offset: number,
    startTime: string,
    endTime: string,
  ) {
    const res = await api(adminSession).post("/api/v1/turnos/shifts", {
      locationId: centerId,
      employeeId,
      date: day(offset),
      startTime,
      endTime,
    });
    expect(res.status).toBe(201);
    return body(res).id as string;
  }

  /** Fichajes pasados por la vía real: la cola de fichajes sin conexión. */
  async function punches(items: [string, number, string][]) {
    const res = await api(martaSession).post("/api/v1/check-in/punches/sync", {
      punches: items.map(([type, offset, time]) => ({
        id: randomUUID(),
        type,
        deviceTime: `${day(offset)}T${time}:00.000Z`,
      })),
    });
    expect(res.status).toBe(201);
  }

  async function login(email: string, tenantSlug = slug) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({ email, password: "TestPass123!" });
    return res.body.data.session.id as string;
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
    const makeTenant = async (name: string, s: string) => {
      const tenant = await prisma.tenant.create({
        data: { name, slug: s, isActive: true },
      });
      for (const moduleId of ["check-in", "turnos"]) {
        await prisma.configuration.create({
          data: {
            tenantId: tenant.id,
            key: `modules.${moduleId}.enabled`,
            value: "true",
            updatedBy: "e2e-test",
          },
        });
      }
      return tenant.id;
    };
    tenantId = await makeTenant("Plan vs real E2E", slug);
    otherTenantId = await makeTenant("Plan vs real E2E Otro", otherSlug);
    await prisma.checkInLegalText.createMany({
      data: (
        [
          "REGISTRO_JORNADA_INFO",
          "GEOLOCALIZACION",
          "PROTOCOLO_REGISTRO",
        ] as const
      ).map((kind) => ({
        tenantId,
        kind,
        version: 1,
        content: `Texto vigente ${kind}`,
        validatedAt: new Date(),
      })),
    });

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
    await makeUser("pr-admin@test.com", "ADMIN");
    const marta = await makeUser("pr-marta@test.com", "USER");
    await makeUser("pr-shared@test.com", "ADMIN", tenantId, true);
    await makeUser("pr-other-admin@test.com", "ADMIN", otherTenantId);

    centerId = (
      await prisma.location.create({
        data: {
          tenantId,
          name: "Restaurante",
          isDefault: true,
          timezone: "UTC",
        },
      })
    ).id;
    const employee = (
      firstName: string,
      hourlyCost: number | null,
      userId?: string,
    ) =>
      prisma.employee.create({
        data: {
          tenantId,
          userId,
          firstName,
          lastName: "Prueba",
          weeklyHours: 40,
          hourlyCost,
          defaultLocationId: centerId,
          locations: { create: [{ tenantId, locationId: centerId }] },
        },
      });
    martaId = (await employee("Marta", 12, marta.id)).id;
    luisId = (await employee("Luis", null)).id;

    adminSession = await login("pr-admin@test.com");
    martaSession = await login("pr-marta@test.com");
    sharedAdminSession = await login("pr-shared@test.com");
    otherAdminSession = await login("pr-other-admin@test.com", otherSlug);

    // Marta: lunes, martes y miércoles de 9 a 17, publicados; el viernes queda
    // en borrador. Luis: sale tarde el lunes y entra pronto el martes.
    await shift(martaId, 0, "09:00", "17:00");
    await shift(martaId, 1, "09:00", "17:00");
    await shift(martaId, 2, "09:00", "17:00");
    await shift(luisId, 0, "16:00", "23:30");
    await shift(luisId, 1, "08:00", "12:00");
    const published = await api(adminSession).post(
      "/api/v1/turnos/schedule/publish",
      { locationId: centerId, weekStart: WEEK },
    );
    expect(body(published).published).toBe(5);
    await shift(martaId, 4, "09:00", "17:00");

    await punches([
      ["IN", 0, "09:05"],
      ["OUT", 0, "17:00"],
      ["IN", 1, "09:30"],
      ["OUT", 1, "16:00"],
      // El miércoles no ficha. El jueves trabaja sin turno.
      ["IN", 3, "10:00"],
      ["OUT", 3, "14:00"],
    ]);
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.timePunch.deleteMany({ where: { tenantId: { in: ids } } });
      await tx.checkInLegalAck.deleteMany({ where: { tenantId: { in: ids } } });
    });
    await prisma.shift.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.schedulePublication.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.checkInKioskKey.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.checkInLegalText.deleteMany({
      where: { tenantId: { in: ids } },
    });
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

  it("la semana trae los avisos legales de lo planificado", async () => {
    const { alerts } = await week();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      code: "DESCANSO_ENTRE_JORNADAS",
      employeeId: luisId,
      date: day(1),
    });
    expect(alerts[0].shiftIds).toHaveLength(2);
    expect(alerts[0].message).toContain("8 h 30 min");
  });

  it("los umbrales de los avisos son los del convenio del tenant", async () => {
    expect((await settings({ maxDailyHours: 7 })).status).toBe(200);
    const codes = (await week()).alerts.map((a: any) => a.code);
    expect(codes.filter((c: string) => c === "JORNADA_DIARIA")).toHaveLength(5);

    await settings({ maxDailyHours: 9, minRestBetweenShiftsHours: 8 });
    expect((await week()).alerts).toEqual([]);
    await settings({ minRestBetweenShiftsHours: 12 });
  });

  it("estima el coste de lo planificado con el coste hora de cada ficha", async () => {
    const { laborCost } = await week();
    // Marta: 8 h a 12 €/h cuatro días (el borrador también cuenta). Luis no tiene coste hora.
    expect(laborCost).toEqual({
      byDay: [96, 96, 96, 0, 96, 0, 0],
      total: 384,
      employeesWithoutCost: 1,
    });
  });

  it("compara los turnos publicados con lo fichado", async () => {
    const { rows, totals } = await planVsActual();

    expect(rowOf(rows, martaId, 0)).toMatchObject({
      status: "OK",
      flags: [],
      plannedStart: "09:00",
      plannedEnd: "17:00",
      actualStart: "09:05",
      actualEnd: "17:00",
      plannedMinutes: 480,
      workedMinutes: 475,
      plannedCost: 96,
      actualCost: 95,
    });
    expect(rowOf(rows, martaId, 1)).toMatchObject({
      status: "INCIDENT",
      flags: ["LATE", "EARLY_LEAVE"],
      lateMinutes: 30,
      earlyLeaveMinutes: 60,
    });
    expect(rowOf(rows, martaId, 2)).toMatchObject({
      status: "NO_SHOW",
      workedMinutes: 0,
      actualStart: null,
    });
    expect(rowOf(rows, martaId, 3)).toMatchObject({
      status: "UNPLANNED",
      plannedMinutes: 0,
      workedMinutes: 240,
    });
    // El turno en borrador del viernes no se compara: nadie lo ha visto.
    expect(rowOf(rows, martaId, 4)).toBeUndefined();
    expect(rowOf(rows, luisId, 0)).toMatchObject({
      status: "NO_SHOW",
      plannedCost: null,
      actualCost: null,
    });

    expect(totals).toMatchObject({
      plannedMinutes: 480 * 3 + 450 + 240,
      workedMinutes: 475 + 390 + 240,
      plannedCost: 288,
      actualCost: 95 + 78 + 48,
    });
  });

  it("el margen de retraso es editable", async () => {
    await settings({ scheduleToleranceMinutes: 30 });
    const tuesday = rowOf((await planVsActual()).rows, martaId, 1);
    expect(tuesday.flags).toEqual(["EARLY_LEAVE"]);

    await settings({ scheduleToleranceMinutes: 0 });
    const mondayRow = rowOf((await planVsActual()).rows, martaId, 0);
    expect(mondayRow).toMatchObject({ status: "INCIDENT", flags: ["LATE"] });
    await settings({ scheduleToleranceMinutes: 10 });

    expect((await settings({ scheduleToleranceMinutes: -5 })).status).toBe(400);
  });

  it("los turnos de hoy salen con su estado en el panel", async () => {
    const res = await api(adminSession).post("/api/v1/turnos/shifts", {
      locationId: centerId,
      employeeId: martaId,
      date: today,
      startTime: "00:00",
      endTime: "23:59",
    });
    expect(res.status).toBe(201);
    const draftOnly = body(
      await api(adminSession).get("/api/v1/turnos/schedule/today"),
    );
    expect(draftOnly.rows).toEqual([]);

    const mondayOfToday = new Date(`${today}T00:00:00Z`);
    mondayOfToday.setUTCDate(
      mondayOfToday.getUTCDate() - ((mondayOfToday.getUTCDay() + 6) % 7),
    );
    await api(adminSession).post("/api/v1/turnos/schedule/publish", {
      locationId: centerId,
      weekStart: mondayOfToday.toISOString().slice(0, 10),
    });
    const { rows } = body(
      await api(adminSession).get("/api/v1/turnos/schedule/today"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      employeeId: martaId,
      employeeName: "Marta Prueba",
      date: today,
      plannedStart: "00:00",
    });
    // Sin fichar: pendiente los primeros minutos del día, después falta.
    expect(["PENDING", "NO_SHOW"]).toContain(rows[0].status);
  });

  it("avisos, coste y comparación son solo de gerencia desde su cuenta personal", async () => {
    for (const session of [martaSession, sharedAdminSession]) {
      for (const name of ["schedule", "schedule/plan-vs-actual"]) {
        expect((await api(session).get(path(name))).status).toBe(403);
      }
      expect(
        (await api(session).get("/api/v1/turnos/schedule/today")).status,
      ).toBe(403);
    }

    // Lo que ve el empleado de sus turnos no lleva coste.
    const own = body(
      await api(martaSession).get(
        `/api/v1/turnos/me/shifts?from=${day(0)}&to=${day(6)}`,
      ),
    );
    expect(own).toHaveLength(3);
    expect(JSON.stringify(own)).not.toMatch(/cost/i);
  });

  it("no cruza datos entre tenants", async () => {
    const other = api(otherAdminSession, otherSlug);
    expect((await other.get(path("schedule"))).status).toBe(404);
    const foreign = body(await other.get(path("schedule/plan-vs-actual")));
    expect(foreign.rows).toEqual([]);
    expect(body(await other.get("/api/v1/turnos/schedule/today")).rows).toEqual(
      [],
    );
  });
});
