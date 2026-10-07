import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Check-In, registro de jornada: jornadas derivadas de los fichajes,
 * correcciones documentadas (el original nunca cambia) y hojas de horas
 * mensuales con aprobación y conformidad. HTTP real + Postgres real.
 */
describe("E2E - Check-In jornadas, correcciones y hojas de horas", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-check-in-workdays";
  let tenantId: string;
  let workerEmployeeId: string;
  let adminSession: string;
  let workerSession: string;
  let otherWorkerSession: string;
  let sharedAdminSession: string;

  // Mes natural anterior completo (centro en UTC para no depender del horario de verano).
  const today = new Date();
  const base = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
  );
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (d: number) => `${year}-${pad(month)}-${pad(d)}`;
  const at = (d: number, time: string) => `${day(d)}T${time}:00.000Z`;
  const from = day(1);
  const to = day(28);

  const body = (res: request.Response) => res.body?.data ?? res.body;

  function api(session: string) {
    const headers = {
      Authorization: `Bearer ${session}`,
      "X-Tenant-Slug": slug,
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

  /** Fichajes históricos por la vía real: la cola de fichajes sin conexión. */
  async function punches(session: string, items: [string, number, string][]) {
    const res = await api(session).post("/api/v1/check-in/punches/sync", {
      punches: items.map(([type, d, time]) => ({
        id: randomUUID(),
        type,
        deviceTime: at(d, time),
      })),
    });
    expect(res.status).toBe(201);
    return body(res);
  }

  const workdays = async (session = workerSession) =>
    body(
      await api(session).get(
        `/api/v1/check-in/me/workdays?from=${from}&to=${to}`,
      ),
    ).days as any[];
  const dayOf = (days: any[], d: number) => days.find((x) => x.date === day(d));

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", slug)
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
    tenantId = (
      await prisma.tenant.create({
        data: { name: "Jornadas E2E", slug, isActive: true },
      })
    ).id;
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.check-in.enabled",
        value: "true",
        updatedBy: "e2e-test",
      },
    });
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
    const center = await prisma.location.create({
      data: { tenantId, name: "Restaurante", isDefault: true, timezone: "UTC" },
    });

    const makeUser = (
      email: string,
      role: "ADMIN" | "USER",
      isSharedAccount = false,
    ) =>
      prisma.user.create({
        data: {
          email,
          passwordHash,
          name: email.split("@")[0],
          tenantId,
          role,
          isActive: true,
          isSharedAccount,
        },
      });
    await makeUser("cw-admin@test.com", "ADMIN");
    const worker = await makeUser("cw-worker@test.com", "USER");
    const other = await makeUser("cw-other@test.com", "USER");
    await makeUser("cw-shared-admin@test.com", "ADMIN", true);

    const employee = (firstName: string, userId: string) =>
      prisma.employee.create({
        data: {
          tenantId,
          userId,
          firstName,
          lastName: "Prueba",
          weeklyHours: 40,
          defaultLocationId: center.id,
          locations: { create: [{ tenantId, locationId: center.id }] },
        },
      });
    workerEmployeeId = (await employee("Marta", worker.id)).id;
    await employee("Otro", other.id);

    adminSession = await login("cw-admin@test.com");
    workerSession = await login("cw-worker@test.com");
    otherWorkerSession = await login("cw-other@test.com");
    sharedAdminSession = await login("cw-shared-admin@test.com");
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.timesheetAck.deleteMany({ where: { tenantId } });
      await tx.timesheet.deleteMany({ where: { tenantId } });
      await tx.timePunchAdjustmentDecision.deleteMany({ where: { tenantId } });
      await tx.timePunchAdjustment.deleteMany({ where: { tenantId } });
      await tx.timePunch.deleteMany({ where: { tenantId } });
      await tx.checkInLegalAck.deleteMany({ where: { tenantId } });
    });
    await prisma.checkInKioskKey.deleteMany({ where: { tenantId } });
    await prisma.checkInLegalText.deleteMany({ where: { tenantId } });
    await prisma.checkInSettings.deleteMany({ where: { tenantId } });
    await prisma.employee.deleteMany({ where: { tenantId } });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { user: { tenantId } } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ${tenantId}`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ${tenantId}`;
    await app.close();
  });

  it("deriva las jornadas: turno partido, pausa y olvido de salida", async () => {
    await punches(workerSession, [
      ["IN", 1, "09:00"],
      ["OUT", 1, "13:00"],
      ["IN", 1, "17:00"],
      ["OUT", 1, "21:00"],
      ["IN", 2, "10:00"],
      ["BREAK_START", 2, "14:00"],
      ["BREAK_END", 2, "14:30"],
      ["OUT", 2, "18:00"],
      ["IN", 3, "09:00"], // olvidó fichar la salida
    ]);

    const days = await workdays();
    expect(dayOf(days, 1)).toMatchObject({
      workedMinutes: 480,
      breakMinutes: 0,
      incidences: [],
    });
    expect(
      dayOf(days, 1).segments.filter((s: any) => s.kind === "WORK"),
    ).toHaveLength(2);
    expect(dayOf(days, 2)).toMatchObject({
      workedMinutes: 450,
      breakMinutes: 30,
    });
    expect(dayOf(days, 3)).toMatchObject({
      workedMinutes: 0,
      incidences: ["SIN_SALIDA"],
      open: false,
    });
  });

  it("cada persona ve solo sus jornadas", async () => {
    expect(await workdays(otherWorkerSession)).toEqual([]);
    // Un empleado no puede pedir las de otro por la ruta de gerencia.
    const res = await api(otherWorkerSession).get(
      `/api/v1/check-in/workdays?employeeId=${workerEmployeeId}&from=${from}&to=${to}`,
    );
    expect(res.status).toBe(403);
    // Ni una cuenta compartida, aunque sea ADMIN.
    expect(
      (
        await api(sharedAdminSession).get(
          `/api/v1/check-in/workdays?employeeId=${workerEmployeeId}&from=${from}&to=${to}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await api(sharedAdminSession).get("/api/v1/check-in/adjustments"))
        .status,
    ).toBe(403);
  });

  let pendingId: string;

  it("el empleado solicita una corrección con motivo; queda pendiente y no cambia nada", async () => {
    const noReason = await api(workerSession).post(
      "/api/v1/check-in/me/adjustments",
      { kind: "ADD", type: "OUT", occurredAt: at(3, "17:00"), reason: "" },
    );
    expect(noReason.status).toBe(400);

    const incomplete = await api(workerSession).post(
      "/api/v1/check-in/me/adjustments",
      { kind: "ADD", reason: "Olvidé fichar la salida" },
    );
    expect(incomplete.status).toBe(400);

    const res = await api(workerSession).post(
      "/api/v1/check-in/me/adjustments",
      {
        kind: "ADD",
        type: "OUT",
        occurredAt: at(3, "17:00"),
        reason: "Olvidé fichar la salida",
      },
    );
    expect(res.status).toBe(201);
    pendingId = body(res).id;
    expect(body(res).decision).toBeNull();
    expect(body(res).requestedByName).toBe("cw-worker");

    expect(dayOf(await workdays(), 3).incidences).toEqual(["SIN_SALIDA"]);
  });

  it("el empleado no puede corregir fichajes de otra persona ni darlos por buenos", async () => {
    const foreign = await prisma.timePunch.findFirst({
      where: { tenantId, employeeId: workerEmployeeId },
    });
    const res = await api(otherWorkerSession).post(
      "/api/v1/check-in/me/adjustments",
      {
        kind: "VOID",
        targetPunchId: foreign!.id,
        reason: "Intento anular el de otro",
      },
    );
    expect(res.status).toBe(400);

    const confirm = await api(workerSession).post(
      "/api/v1/check-in/me/adjustments",
      {
        kind: "CONFIRM",
        targetPunchId: foreign!.id,
        reason: "Me lo doy por bueno",
      },
    );
    expect(confirm.status).toBe(400);
  });

  it("no se puede aprobar el mes con solicitudes o incidencias pendientes", async () => {
    const res = await api(adminSession).post(
      "/api/v1/check-in/timesheets/approve",
      { employeeId: workerEmployeeId, year, month },
    );
    expect(res.status).toBe(400);
    expect(await prisma.timesheet.count({ where: { tenantId } })).toBe(0);
  });

  it("solo gerencia decide; al aprobar cambia la jornada y el original sigue intacto", async () => {
    const before = await prisma.timePunch.findMany({
      where: { tenantId },
      orderBy: { seq: "asc" },
    });

    expect(
      (
        await api(workerSession).post(
          `/api/v1/check-in/adjustments/${pendingId}/decision`,
          { approve: true },
        )
      ).status,
    ).toBe(403);

    const pending = body(
      await api(adminSession).get("/api/v1/check-in/adjustments?pending=true"),
    );
    expect(pending.map((a: any) => a.id)).toEqual([pendingId]);

    const res = await api(adminSession).post(
      `/api/v1/check-in/adjustments/${pendingId}/decision`,
      { approve: true },
    );
    expect(res.status).toBe(201);
    expect(body(res).decision).toMatchObject({
      status: "APPROVED",
      decidedByName: "cw-admin",
    });

    const day3 = dayOf(await workdays(), 3);
    expect(day3).toMatchObject({ workedMinutes: 480, incidences: [] });
    expect(day3.punches.map((p: any) => p.origin)).toEqual([
      "PUNCH",
      "ADJUSTMENT",
    ]);

    // Con la salida añadida, ya no consta como "dentro": puede fichar entrada.
    const me = body(await api(workerSession).get("/api/v1/check-in/me"));
    expect(me.status).toBe("OUT");
    expect(me.allowedTypes).toEqual(["IN"]);

    // Decidir dos veces no es posible.
    expect(
      (
        await api(adminSession).post(
          `/api/v1/check-in/adjustments/${pendingId}/decision`,
          { approve: false, note: "Cambio de opinión" },
        )
      ).status,
    ).toBe(409);

    // Los fichajes originales no han cambiado en nada.
    const after = await prisma.timePunch.findMany({
      where: { tenantId },
      orderBy: { seq: "asc" },
    });
    expect(after).toEqual(before);
  });

  it("gerencia sustituye un fichaje: el anulado sigue visible pero no cuenta", async () => {
    const out = await prisma.timePunch.findFirst({
      where: {
        tenantId,
        employeeId: workerEmployeeId,
        type: "OUT",
        occurredAt: new Date(at(2, "18:00")),
      },
    });
    const res = await api(adminSession).post("/api/v1/check-in/adjustments", {
      employeeId: workerEmployeeId,
      kind: "REPLACE",
      targetPunchId: out!.id,
      type: "OUT",
      occurredAt: at(2, "19:00"),
      reason: "Salió una hora más tarde; fichó desde otro móvil",
    });
    expect(res.status).toBe(201);
    expect(body(res).decision.status).toBe("APPROVED");

    const day2 = dayOf(await workdays(), 2);
    expect(day2.workedMinutes).toBe(510);
    const voided = day2.punches.find((p: any) => p.id === out!.id);
    expect(voided).toMatchObject({ voided: true, origin: "PUNCH" });
  });

  it("rechazar exige explicación y no cambia la jornada", async () => {
    const target = await prisma.timePunch.findFirst({
      where: { tenantId, employeeId: workerEmployeeId, type: "IN" },
      orderBy: { occurredAt: "asc" },
    });
    const requested = body(
      await api(workerSession).post("/api/v1/check-in/me/adjustments", {
        kind: "VOID",
        targetPunchId: target!.id,
        reason: "Ese día no trabajé",
      }),
    );
    expect(
      (
        await api(adminSession).post(
          `/api/v1/check-in/adjustments/${requested.id}/decision`,
          { approve: false },
        )
      ).status,
    ).toBe(400);
    const rejected = await api(adminSession).post(
      `/api/v1/check-in/adjustments/${requested.id}/decision`,
      { approve: false, note: "Hay constancia de que sí trabajó" },
    );
    expect(body(rejected).decision.status).toBe("REJECTED");
    expect(dayOf(await workdays(), 1).workedMinutes).toBe(480);

    // El empleado ve el resultado de sus solicitudes.
    const mine = body(
      await api(workerSession).get("/api/v1/check-in/me/adjustments"),
    );
    expect(mine.map((a: any) => a.decision?.status).sort()).toEqual([
      "APPROVED",
      "APPROVED",
      "REJECTED",
    ]);
  });

  it("un fichaje «a revisar» sale de la lista al anularlo con una corrección", async () => {
    // Una salida suelta el día 4: no encaja con nada.
    const [result] = await punches(workerSession, [["OUT", 4, "20:00"]]);
    expect(result.status).toBe("FLAGGED");
    const review = body(
      await api(adminSession).get("/api/v1/check-in/punches/review"),
    );
    expect(review.map((p: any) => p.id)).toContain(result.id);
    expect(dayOf(await workdays(), 4).incidences).toEqual(["SECUENCIA"]);

    await api(adminSession).post("/api/v1/check-in/adjustments", {
      employeeId: workerEmployeeId,
      kind: "VOID",
      targetPunchId: result.id,
      reason: "Fichaje por error, ese día libraba",
    });
    const after = body(
      await api(adminSession).get("/api/v1/check-in/punches/review"),
    );
    expect(after.map((p: any) => p.id)).not.toContain(result.id);
    // Sin fichajes que cuenten, el día 4 ya no es una jornada.
    expect(dayOf(await workdays(), 4)).toBeUndefined();
    // La marca original del fichaje sigue en la base de datos.
    expect(
      (await prisma.timePunch.findUnique({ where: { id: result.id } }))!
        .needsReview,
    ).toBe(true);
  });

  it("aprobar el mes congela los totales; el empleado da su conformidad", async () => {
    const listed = body(
      await api(adminSession).get(
        `/api/v1/check-in/timesheets?year=${year}&month=${month}`,
      ),
    );
    const row = listed.find((r: any) => r.employeeId === workerEmployeeId);
    expect(row.totals).toMatchObject({
      workedMinutes: 480 + 510 + 480,
      daysWorked: 3,
      incidenceCount: 0,
    });
    expect(row.approved).toBeNull();

    // Aún no hay nada a lo que dar conformidad.
    expect(
      (
        await api(workerSession).post("/api/v1/check-in/me/timesheet/ack", {
          year,
          month,
        })
      ).status,
    ).toBe(404);

    const res = await api(adminSession).post(
      "/api/v1/check-in/timesheets/approve",
      { employeeId: workerEmployeeId, year, month },
    );
    expect(res.status).toBe(201);
    expect(body(res)).toMatchObject({
      version: 1,
      workedMinutes: 1470,
      approvedByName: "cw-admin",
    });

    const ack = await api(workerSession).post(
      "/api/v1/check-in/me/timesheet/ack",
      { year, month },
    );
    expect(ack.status).toBe(201);
    expect(body(ack).acknowledgedAt).toBeTruthy();
    // Repetir la conformidad no la duplica.
    await api(workerSession).post("/api/v1/check-in/me/timesheet/ack", {
      year,
      month,
    });
    expect(await prisma.timesheetAck.count({ where: { tenantId } })).toBe(1);

    const own = body(
      await api(workerSession).get(
        `/api/v1/check-in/me/timesheet?year=${year}&month=${month}`,
      ),
    );
    expect(own.approved.version).toBe(1);
    expect(own.acknowledgedAt).toBeTruthy();
    expect(own.changedSinceApproval).toBe(false);
  });

  it("una corrección posterior no altera la hoja aprobada; reabrir exige motivo", async () => {
    for (const [type, time] of [
      ["IN", "09:00"],
      ["OUT", "11:00"],
    ]) {
      await api(adminSession).post("/api/v1/check-in/adjustments", {
        employeeId: workerEmployeeId,
        kind: "ADD",
        type,
        occurredAt: at(5, time),
        reason: "Trabajó dos horas y no pudo fichar",
      });
    }
    const own = body(
      await api(workerSession).get(
        `/api/v1/check-in/me/timesheet?year=${year}&month=${month}`,
      ),
    );
    expect(own.totals.workedMinutes).toBe(1590);
    expect(own.approved.workedMinutes).toBe(1470);
    expect(own.changedSinceApproval).toBe(true);

    const noReason = await api(adminSession).post(
      "/api/v1/check-in/timesheets/approve",
      { employeeId: workerEmployeeId, year, month },
    );
    expect(noReason.status).toBe(400);

    const reopened = await api(adminSession).post(
      "/api/v1/check-in/timesheets/approve",
      {
        employeeId: workerEmployeeId,
        year,
        month,
        reopenReason: "Se añadió la jornada del día 5",
      },
    );
    expect(body(reopened)).toMatchObject({ version: 2, workedMinutes: 1590 });

    // La versión 1 se conserva tal cual; la conformidad era de esa versión.
    const versions = await prisma.timesheet.findMany({
      where: { tenantId, employeeId: workerEmployeeId },
      orderBy: { version: "asc" },
    });
    expect(versions.map((v) => [v.version, v.workedMinutes])).toEqual([
      [1, 1470],
      [2, 1590],
    ]);
    const after = body(
      await api(workerSession).get(
        `/api/v1/check-in/me/timesheet?year=${year}&month=${month}`,
      ),
    );
    expect(after.acknowledgedAt).toBeNull();
  });

  it("cambiar si las pausas cuentan afecta al cálculo vivo, no a la hoja aprobada", async () => {
    await api(adminSession).patch("/api/v1/check-in/settings", {
      breaksCountAsWork: true,
    });
    expect(dayOf(await workdays(), 2).workedMinutes).toBe(540);
    const own = body(
      await api(workerSession).get(
        `/api/v1/check-in/me/timesheet?year=${year}&month=${month}`,
      ),
    );
    expect(own.approved.workedMinutes).toBe(1590);
    expect(own.changedSinceApproval).toBe(true);
  });

  it("la base de datos rechaza editar o borrar correcciones, decisiones, hojas y conformidades", async () => {
    for (const table of [
      "time_punch_adjustments",
      "time_punch_adjustment_decisions",
      "timesheets",
      "timesheet_acks",
    ]) {
      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM "${table}" WHERE "tenantId" = '${tenantId}'`,
        ),
      ).rejects.toThrow(/inalterable/);
    }
    await expect(
      prisma.$executeRaw`UPDATE "timesheets" SET "workedMinutes" = 0 WHERE "tenantId" = ${tenantId}`,
    ).rejects.toThrow(/inalterable/);
  });

  it("un responsable no corrige ni aprueba su propia jornada", async () => {
    const manager = await prisma.user.create({
      data: {
        email: "cw-manager@test.com",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
        name: "cw-manager",
        tenantId,
        role: "ADMIN",
        isActive: true,
      },
    });
    const center = await prisma.location.findFirstOrThrow({
      where: { tenantId },
    });
    const own = await prisma.employee.create({
      data: {
        tenantId,
        userId: manager.id,
        firstName: "Gerente",
        lastName: "Prueba",
        weeklyHours: 40,
        defaultLocationId: center.id,
        locations: { create: [{ tenantId, locationId: center.id }] },
      },
    });
    const managerSession = await login("cw-manager@test.com");
    const correction = {
      kind: "ADD",
      type: "IN",
      occurredAt: at(4, "09:00"),
      reason: "Olvidé fichar la entrada",
    };

    // Por la vía de gerencia, sobre sí mismo: no.
    expect(
      (
        await api(managerSession).post("/api/v1/check-in/adjustments", {
          ...correction,
          employeeId: own.id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api(managerSession).post("/api/v1/check-in/timesheets/approve", {
          employeeId: own.id,
          year,
          month,
        })
      ).status,
    ).toBe(403);

    // Puede pedirla como cualquier empleado, pero no resolverla él mismo.
    const requested = await api(managerSession).post(
      "/api/v1/check-in/me/adjustments",
      correction,
    );
    expect(requested.status).toBe(201);
    const decision = `/api/v1/check-in/adjustments/${body(requested).id}/decision`;
    expect(
      (await api(managerSession).post(decision, { approve: true })).status,
    ).toBe(403);
    // Otro responsable sí.
    expect(
      (await api(adminSession).post(decision, { approve: true })).status,
    ).toBe(201);
    // Y sigue pudiendo corregir a los demás.
    expect(
      (
        await api(managerSession).post("/api/v1/check-in/adjustments", {
          ...correction,
          employeeId: workerEmployeeId,
          occurredAt: at(20, "09:00"),
        })
      ).status,
    ).toBe(201);
  });
});
