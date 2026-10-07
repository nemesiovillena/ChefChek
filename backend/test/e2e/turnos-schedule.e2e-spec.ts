import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Turnos: planificador semanal. Crear, mover y borrar turnos, turno partido,
 * turnos abiertos, ausencias, copiar semana y publicar. HTTP + Postgres.
 */
describe("E2E - Turnos: planificador", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-turnos-schedule";
  const otherSlug = "e2e-turnos-schedule-other";
  let tenantId: string;
  let otherTenantId: string;
  let centerId: string;
  let secondCenterId: string;
  let martaId: string;
  let luisId: string;
  let adminSession: string;
  let martaSession: string;
  let sharedAdminSession: string;
  let otherAdminSession: string;
  let shiftId: string;

  // Semana del lunes 2 al domingo 8 de noviembre de 2026, y la siguiente.
  const WEEK = "2026-11-02";
  const NEXT_WEEK = "2026-11-09";
  const d = (day: number) => `2026-11-${String(day).padStart(2, "0")}`;
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
      delete: (path: string) => request(server).delete(path).set(headers),
    };
  }
  const week = async (weekStart = WEEK) =>
    body(
      await api(adminSession).get(
        `/api/v1/turnos/schedule?locationId=${centerId}&weekStart=${weekStart}`,
      ),
    );
  const shift = (data: object) =>
    api(adminSession).post("/api/v1/turnos/shifts", {
      locationId: centerId,
      ...data,
    });

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
    tenantId = await makeTenant("Planificador E2E", slug);
    otherTenantId = await makeTenant("Planificador E2E Otro", otherSlug);

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
    await makeUser("ts-admin@test.com", "ADMIN");
    const marta = await makeUser("ts-marta@test.com", "USER");
    await makeUser("ts-shared@test.com", "ADMIN", tenantId, true);
    await makeUser("ts-other-admin@test.com", "ADMIN", otherTenantId);

    centerId = (
      await prisma.location.create({
        data: { tenantId, name: "Restaurante", isDefault: true },
      })
    ).id;
    secondCenterId = (
      await prisma.location.create({ data: { tenantId, name: "Obrador" } })
    ).id;
    const employee = (firstName: string, section: string, userId?: string) =>
      prisma.employee.create({
        data: {
          tenantId,
          userId,
          firstName,
          lastName: "Prueba",
          section,
          weeklyHours: 40,
          defaultLocationId: centerId,
          locations: { create: [{ tenantId, locationId: centerId }] },
        },
      });
    martaId = (await employee("Marta", "Cocina", marta.id)).id;
    luisId = (await employee("Luis", "Sala")).id;

    // Luis tiene vacaciones aprobadas el lunes 9 (semana siguiente).
    const type = await prisma.absenceType.create({
      data: { tenantId, name: "Vacaciones", deductsVacation: true },
    });
    await prisma.absence.create({
      data: {
        tenantId,
        employeeId: luisId,
        absenceTypeId: type.id,
        startDate: new Date(`${d(9)}T00:00:00Z`),
        endDate: new Date(`${d(9)}T00:00:00Z`),
        status: "APPROVED",
        requestedByUserId: "seed",
        requestedByName: "seed",
      },
    });

    adminSession = await login("ts-admin@test.com");
    martaSession = await login("ts-marta@test.com");
    sharedAdminSession = await login("ts-shared@test.com");
    otherAdminSession = await login("ts-other-admin@test.com", otherSlug);
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await prisma.shift.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.shiftTemplate.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.schedulePublication.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.absence.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.absenceType.deleteMany({ where: { tenantId: { in: ids } } });
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

  it("solo gerencia, desde su cuenta personal, ve y edita el planificador", async () => {
    const path = `/api/v1/turnos/schedule?locationId=${centerId}&weekStart=${WEEK}`;
    expect((await api(martaSession).get(path)).status).toBe(403);
    expect((await api(sharedAdminSession).get(path)).status).toBe(403);
    expect((await api(otherAdminSession, otherSlug).get(path)).status).toBe(
      404,
    );
    expect(
      (
        await api(martaSession).post("/api/v1/turnos/shifts", {
          locationId: centerId,
          employeeId: martaId,
          date: d(2),
          startTime: "09:00",
          endTime: "17:00",
        })
      ).status,
    ).toBe(403);
  });

  it("la semana empieza en lunes y trae al equipo del centro", async () => {
    const tuesday = await api(adminSession).get(
      `/api/v1/turnos/schedule?locationId=${centerId}&weekStart=${d(3)}`,
    );
    expect(tuesday.status).toBe(400);

    const data = await week();
    expect(data.days).toEqual([d(2), d(3), d(4), d(5), d(6), d(7), d(8)]);
    expect(data.employees.map((e: any) => e.name)).toEqual([
      "Marta Prueba",
      "Luis Prueba",
    ]);
    expect(data.shifts).toEqual([]);
    expect(data.draftCount).toBe(0);
  });

  it("crea un turno en borrador y calcula sus horas", async () => {
    const res = await shift({
      employeeId: martaId,
      date: d(2),
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
    });
    expect(res.status).toBe(201);
    shiftId = body(res).id;
    expect(body(res)).toMatchObject({
      status: "DRAFT",
      workMinutes: 450,
      date: d(2),
      employeeId: martaId,
    });

    const invalid = await shift({
      employeeId: martaId,
      date: d(3),
      startTime: "9:00",
      endTime: "17:00",
    });
    expect(invalid.status).toBe(400);
  });

  it("admite turno partido pero no dos turnos que se pisen", async () => {
    const clash = await shift({
      employeeId: martaId,
      date: d(2),
      startTime: "16:00",
      endTime: "20:00",
    });
    expect(clash.status).toBe(409);

    const split = await shift({
      employeeId: martaId,
      date: d(2),
      startTime: "20:00",
      endTime: "23:30",
    });
    expect(split.status).toBe(201);
  });

  it("un turno puede cruzar la medianoche y quedar abierto, sin persona", async () => {
    const night = await shift({
      employeeId: luisId,
      date: d(6),
      startTime: "21:00",
      endTime: "02:00",
    });
    expect(body(night).workMinutes).toBe(300);

    const open = await shift({
      date: d(7),
      startTime: "12:00",
      endTime: "16:00",
    });
    expect(open.status).toBe(201);
    expect(body(open).employeeId).toBeNull();
  });

  it("no deja asignar a quien no es del centro ni a alguien de otro tenant", async () => {
    const wrongCenter = await api(adminSession).post("/api/v1/turnos/shifts", {
      locationId: secondCenterId,
      employeeId: martaId,
      date: d(3),
      startTime: "09:00",
      endTime: "13:00",
    });
    expect(wrongCenter.status).toBe(400);

    const foreign = await api(otherAdminSession, otherSlug).post(
      "/api/v1/turnos/shifts",
      {
        locationId: centerId,
        employeeId: martaId,
        date: d(3),
        startTime: "09:00",
        endTime: "13:00",
      },
    );
    expect(foreign.status).toBe(404);
  });

  it("mover un turno a otro día o a otra persona respeta las mismas reglas", async () => {
    const moved = await api(adminSession).patch(
      `/api/v1/turnos/shifts/${shiftId}`,
      { date: d(3) },
    );
    expect(body(moved)).toMatchObject({ date: d(3), employeeId: martaId });

    const reassigned = await api(adminSession).patch(
      `/api/v1/turnos/shifts/${shiftId}`,
      { employeeId: luisId },
    );
    expect(body(reassigned).employeeId).toBe(luisId);

    // Devolverlo a Marta el lunes ya no choca con nada (solo queda el de tarde).
    const back = await api(adminSession).patch(
      `/api/v1/turnos/shifts/${shiftId}`,
      { employeeId: martaId, date: d(2) },
    );
    expect(back.status).toBe(200);

    // Pero no puede caer encima del turno de tarde.
    const clash = await api(adminSession).patch(
      `/api/v1/turnos/shifts/${shiftId}`,
      { startTime: "19:00", endTime: "22:00" },
    );
    expect(clash.status).toBe(409);
  });

  it("no se puede planificar a alguien un día que tiene una ausencia aprobada", async () => {
    const res = await shift({
      employeeId: luisId,
      date: d(9),
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res.status).toBe(409);
    expect(res.body.error?.message ?? res.body.message).toContain("vacaciones");
  });

  it("los borradores no los ve el empleado hasta que se publica la semana", async () => {
    const own = `/api/v1/turnos/me/shifts?from=${d(1)}&to=${d(30)}`;
    expect(body(await api(martaSession).get(own))).toEqual([]);
    expect((await week()).draftCount).toBe(4);

    const res = await api(adminSession).post(
      "/api/v1/turnos/schedule/publish",
      {
        locationId: centerId,
        weekStart: WEEK,
      },
    );
    expect(body(res)).toEqual({ published: 4 });

    const mine = body(await api(martaSession).get(own));
    expect(mine.map((s: any) => [s.date, s.startTime, s.endTime])).toEqual([
      [d(2), "09:00", "17:00"],
      [d(2), "20:00", "23:30"],
    ]);
    expect(mine[0].locationName).toBe("Restaurante");

    const after = await week();
    expect(after.draftCount).toBe(0);
    expect(after.lastPublication.publishedByName).toBe("ts-admin");
    // Publicar sin nada pendiente no crea otra constancia.
    await api(adminSession).post("/api/v1/turnos/schedule/publish", {
      locationId: centerId,
      weekStart: WEEK,
    });
    expect(
      await prisma.schedulePublication.count({ where: { tenantId } }),
    ).toBe(1);
  });

  it("copiar semana duplica los turnos como borradores y se salta los que no encajan", async () => {
    // En la semana de origen: Luis tiene además un turno el lunes.
    await shift({
      employeeId: luisId,
      date: d(2),
      startTime: "12:00",
      endTime: "16:00",
    });
    const res = await api(adminSession).post(
      "/api/v1/turnos/schedule/copy-week",
      { locationId: centerId, fromWeekStart: WEEK, toWeekStart: NEXT_WEEK },
    );
    // 5 turnos en origen; el de Luis del lunes cae en sus vacaciones del día 9.
    expect(body(res)).toEqual({ copied: 4, skipped: 1 });

    const next = await week(NEXT_WEEK);
    expect(next.shifts).toHaveLength(4);
    expect(next.shifts.every((s: any) => s.status === "DRAFT")).toBe(true);
    expect(next.absences).toEqual([
      expect.objectContaining({
        employeeId: luisId,
        typeName: "Vacaciones",
        status: "APPROVED",
      }),
    ]);

    // Repetir la copia no duplica nada, tampoco el turno abierto.
    const again = body(
      await api(adminSession).post("/api/v1/turnos/schedule/copy-week", {
        locationId: centerId,
        fromWeekStart: WEEK,
        toWeekStart: NEXT_WEEK,
      }),
    );
    expect(again).toEqual({ copied: 0, skipped: 5 });

    const same = await api(adminSession).post(
      "/api/v1/turnos/schedule/copy-week",
      { locationId: centerId, fromWeekStart: WEEK, toWeekStart: WEEK },
    );
    expect(same.status).toBe(400);
  });

  it("borra un turno", async () => {
    const before = (await week()).shifts.length;
    const res = await api(adminSession).delete(
      `/api/v1/turnos/shifts/${shiftId}`,
    );
    expect(res.status).toBe(204);
    expect((await week()).shifts).toHaveLength(before - 1);
    expect(
      (await api(adminSession).delete(`/api/v1/turnos/shifts/${shiftId}`))
        .status,
    ).toBe(404);
  });

  it("plantillas de turno: crear, usar en la rejilla y desactivar", async () => {
    const created = await api(adminSession).post(
      "/api/v1/turnos/shift-templates",
      {
        name: "Mañana",
        startTime: "09:00",
        endTime: "17:00",
        breakMinutes: 30,
      },
    );
    expect(created.status).toBe(201);
    expect((await week()).templates.map((t: any) => t.name)).toEqual([
      "Mañana",
    ]);
    await api(adminSession).patch(
      `/api/v1/turnos/shift-templates/${body(created).id}`,
      { name: "Mañana", startTime: "09:00", endTime: "17:00", isActive: false },
    );
    expect((await week()).templates).toEqual([]);
    expect(
      (
        await api(martaSession).post("/api/v1/turnos/shift-templates", {
          name: "No puede",
          startTime: "09:00",
          endTime: "17:00",
        })
      ).status,
    ).toBe(403);
  });
});
