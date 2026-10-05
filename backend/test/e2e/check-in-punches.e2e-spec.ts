import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import { computePunchHash } from "../../src/modules/check-in/services/punch-hash.util";

/**
 * Check-In, fichaje: cuenta personal sin PIN, kiosco con PIN, geovalla,
 * secuencia (incluido turno partido), idempotencia, concurrencia e
 * inalterabilidad en Postgres. HTTP real + BD real.
 */
describe("E2E - Check-In fichaje", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-check-in-punch";
  const otherSlug = "e2e-check-in-punch-other";
  let tenantId: string;
  let otherTenantId: string;
  let centerId: string;
  let secondCenterId: string;
  let personalEmployeeId: string;
  let kioskEmployeeId: string;
  let adminSession: string;
  let workerSession: string;
  let unlinkedSession: string;
  let kioskSession: string;
  let otherKioskSession: string;

  // Centro en 38.63, -0.86 con radio 150 m.
  const INSIDE = { latitude: 38.6304, longitude: -0.86 }; // ~45 m
  const OUTSIDE = { latitude: 38.64, longitude: -0.86 }; // ~1,1 km

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
    };
  }

  const punch = (session: string, data: object, tenantSlug = slug) =>
    api(session, tenantSlug).post("/api/v1/check-in/punches", {
      id: randomUUID(),
      ...data,
    });

  async function login(email: string, tenantSlug: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantSlug)
      .send({ email, password: "TestPass123!" });
    return res.body.data.session.id as string;
  }

  async function validateLegalTexts(id: string) {
    await prisma.checkInLegalText.createMany({
      data: (
        [
          "REGISTRO_JORNADA_INFO",
          "GEOLOCALIZACION",
          "PROTOCOLO_REGISTRO",
        ] as const
      ).map((kind) => ({
        tenantId: id,
        kind,
        version: 1,
        content: `Texto vigente ${kind}`,
        validatedAt: new Date(),
        validatedByName: "e2e",
      })),
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
    tenantId = (
      await prisma.tenant.create({
        data: { name: "Fichaje E2E", slug, isActive: true },
      })
    ).id;
    otherTenantId = (
      await prisma.tenant.create({
        data: { name: "Fichaje E2E Otro", slug: otherSlug, isActive: true },
      })
    ).id;
    for (const id of [tenantId, otherTenantId]) {
      await prisma.configuration.create({
        data: {
          tenantId: id,
          key: "modules.check-in.enabled",
          value: "true",
          updatedBy: "e2e-test",
        },
      });
    }

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
    await makeUser("cp-admin@test.com", "ADMIN", tenantId);
    const worker = await makeUser("cp-worker@test.com", "USER", tenantId);
    await makeUser("cp-unlinked@test.com", "USER", tenantId);
    await makeUser("cp-kiosk@test.com", "USER", tenantId, true);
    await makeUser("cp-other-kiosk@test.com", "USER", otherTenantId, true);

    centerId = (
      await prisma.location.create({
        data: {
          tenantId,
          name: "Restaurante",
          isDefault: true,
          latitude: 38.63,
          longitude: -0.86,
          geofenceRadiusM: 150,
          geofenceMode: "WARN",
        },
      })
    ).id;
    secondCenterId = (
      await prisma.location.create({ data: { tenantId, name: "Obrador" } })
    ).id;

    personalEmployeeId = (
      await prisma.employee.create({
        data: {
          tenantId,
          userId: worker.id,
          firstName: "Marta",
          lastName: "Ruiz",
          defaultLocationId: centerId,
          locations: { create: [{ tenantId, locationId: centerId }] },
        },
      })
    ).id;
    kioskEmployeeId = (
      await prisma.employee.create({
        data: {
          tenantId,
          firstName: "Paco",
          lastName: "Gil",
          defaultLocationId: centerId,
          pinHash: await bcrypt.hash("4821", 10),
          locations: { create: [{ tenantId, locationId: centerId }] },
        },
      })
    ).id;

    adminSession = await login("cp-admin@test.com", slug);
    workerSession = await login("cp-worker@test.com", slug);
    unlinkedSession = await login("cp-unlinked@test.com", slug);
    kioskSession = await login("cp-kiosk@test.com", slug);
    otherKioskSession = await login("cp-other-kiosk@test.com", otherSlug);
  });

  afterAll(async () => {
    const tenantIds = [tenantId, otherTenantId];
    // Tablas de evidencia: solo se limpian con el escape explícito.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.timePunch.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.checkInLegalAck.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
    });
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
    await prisma.$executeRaw`DELETE FROM "locations" WHERE "tenantId" = ANY(${tenantIds})`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ANY(${tenantIds})`;
    await app.close();
  });

  it("no deja fichar mientras los textos legales no estén validados", async () => {
    const res = await punch(workerSession, { type: "IN" });
    expect(res.status).toBe(409);
    expect(await prisma.timePunch.count({ where: { tenantId } })).toBe(0);

    await validateLegalTexts(tenantId);
    await validateLegalTexts(otherTenantId);
  });

  it("la cuenta personal debe aceptar la información antes de fichar", async () => {
    const state = body(await api(workerSession).get("/api/v1/check-in/me"));
    expect(state.employee.name).toBe("Marta Ruiz");
    expect(state.status).toBe("OUT");
    expect(state.pendingLegalTexts.map((t: any) => t.kind).sort()).toEqual([
      "GEOLOCALIZACION",
      "REGISTRO_JORNADA_INFO",
    ]);

    expect((await punch(workerSession, { type: "IN" })).status).toBe(409);

    const ack = await api(workerSession).post("/api/v1/check-in/me/legal-acks");
    expect(body(ack).acknowledged).toBe(2);
    // Repetir el acuse no duplica.
    expect(
      body(await api(workerSession).post("/api/v1/check-in/me/legal-acks"))
        .acknowledged,
    ).toBe(0);
  });

  it("ficha desde la cuenta personal sin PIN, dentro de zona", async () => {
    const res = await punch(workerSession, { type: "IN", ...INSIDE });
    expect(res.status).toBe(201);
    const saved = body(res);
    expect(saved).toMatchObject({
      employeeId: personalEmployeeId,
      source: "PERSONAL",
      pinStatus: "NOT_REQUIRED",
      geofenceStatus: "INSIDE",
      locationId: centerId,
      seq: 1,
    });

    const state = body(await api(workerSession).get("/api/v1/check-in/me"));
    expect(state.status).toBe("IN");
    expect(state.allowedTypes.sort()).toEqual(["BREAK_START", "OUT"]);
  });

  it("la cuenta personal no puede fichar por otra persona", async () => {
    const res = await punch(workerSession, {
      type: "OUT",
      employeeId: kioskEmployeeId,
    });
    expect(res.status).toBe(201);
    // El employeeId enviado se ignora: el fichaje es del dueño de la sesión.
    expect(body(res).employeeId).toBe(personalEmployeeId);
    expect(
      await prisma.timePunch.count({ where: { employeeId: kioskEmployeeId } }),
    ).toBe(0);
  });

  it("valida la secuencia y admite turno partido", async () => {
    // Está fuera tras la salida anterior.
    expect((await punch(workerSession, { type: "OUT" })).status).toBe(409);
    expect((await punch(workerSession, { type: "BREAK_START" })).status).toBe(
      409,
    );
    // Segundo tramo del día.
    expect((await punch(workerSession, { type: "IN", ...INSIDE })).status).toBe(
      201,
    );
    expect((await punch(workerSession, { type: "IN" })).status).toBe(409);
    expect((await punch(workerSession, { type: "BREAK_START" })).status).toBe(
      201,
    );
    expect((await punch(workerSession, { type: "OUT" })).status).toBe(409);
    expect((await punch(workerSession, { type: "BREAK_END" })).status).toBe(
      201,
    );
  });

  it("fuera de zona: en modo aviso ficha y lo marca; en modo bloqueo lo impide", async () => {
    const warned = await punch(workerSession, { type: "OUT", ...OUTSIDE });
    expect(warned.status).toBe(201);
    expect(body(warned).geofenceStatus).toBe("OUTSIDE");
    expect(body(warned).distanceM).toBeGreaterThan(1000);

    await prisma.location.update({
      where: { id: centerId },
      data: { geofenceMode: "BLOCK" },
    });
    const before = await prisma.timePunch.count({ where: { tenantId } });
    expect(
      (await punch(workerSession, { type: "IN", ...OUTSIDE })).status,
    ).toBe(403);
    expect(await prisma.timePunch.count({ where: { tenantId } })).toBe(before);

    // Sin ubicación no se bloquea: queda como "no disponible".
    const noGps = await punch(workerSession, { type: "IN" });
    expect(noGps.status).toBe(201);
    expect(body(noGps).geofenceStatus).toBe("UNAVAILABLE");

    await prisma.location.update({
      where: { id: centerId },
      data: { geofenceMode: "WARN" },
    });
    await punch(workerSession, { type: "OUT", ...INSIDE });
  });

  it("reenviar el mismo fichaje no lo duplica", async () => {
    const id = randomUUID();
    const first = await api(workerSession).post("/api/v1/check-in/punches", {
      id,
      type: "IN",
      ...INSIDE,
    });
    const retry = await api(workerSession).post("/api/v1/check-in/punches", {
      id,
      type: "IN",
      ...INSIDE,
    });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(body(retry).seq).toBe(body(first).seq);
    expect(await prisma.timePunch.count({ where: { id } })).toBe(1);
    await punch(workerSession, { type: "OUT", ...INSIDE });
  });

  it("dos pulsaciones simultáneas solo registran una entrada", async () => {
    const before = await prisma.timePunch.count({ where: { tenantId } });
    const results = await Promise.all([
      punch(workerSession, { type: "IN", ...INSIDE }),
      punch(workerSession, { type: "IN", ...INSIDE }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.timePunch.count({ where: { tenantId } })).toBe(
      before + 1,
    );
    await punch(workerSession, { type: "OUT", ...INSIDE });
  });

  it("una cuenta sin ficha de empleado no puede fichar", async () => {
    const state = body(await api(unlinkedSession).get("/api/v1/check-in/me"));
    expect(state.employee).toBeNull();
    expect((await punch(unlinkedSession, { type: "IN" })).status).toBe(403);
  });

  it("el kiosco exige PIN correcto y solo lo abre una cuenta compartida", async () => {
    expect(
      (await api(workerSession).get("/api/v1/check-in/kiosk")).status,
    ).toBe(403);

    const kiosk = body(
      await api(kioskSession).get(
        `/api/v1/check-in/kiosk?locationId=${centerId}`,
      ),
    );
    expect(kiosk.center.id).toBe(centerId);
    expect(kiosk.pinLength).toBe(4);
    const paco = kiosk.employees.find((e: any) => e.id === kioskEmployeeId);
    expect(paco).toMatchObject({
      name: "Paco Gil",
      status: "OUT",
      hasPin: true,
    });
    expect(JSON.stringify(kiosk)).not.toContain("pinHash");

    const base = {
      type: "IN",
      employeeId: kioskEmployeeId,
      locationId: centerId,
    };
    expect((await punch(kioskSession, base)).status).toBe(400); // sin PIN
    expect((await punch(kioskSession, { ...base, pin: "0000" })).status).toBe(
      403,
    );
    expect(
      await prisma.timePunch.count({ where: { employeeId: kioskEmployeeId } }),
    ).toBe(0);

    const ok = await punch(kioskSession, { ...base, pin: "4821" });
    expect(ok.status).toBe(201);
    expect(body(ok)).toMatchObject({
      employeeId: kioskEmployeeId,
      source: "KIOSK",
      pinStatus: "VERIFIED",
      locationId: centerId,
    });
  });

  it("el kiosco no ficha a alguien que no pertenece a ese centro ni a otro tenant", async () => {
    const wrongCenter = await punch(kioskSession, {
      type: "OUT",
      employeeId: kioskEmployeeId,
      locationId: secondCenterId,
      pin: "4821",
    });
    expect(wrongCenter.status).toBe(403);

    const otherTenant = await punch(
      otherKioskSession,
      {
        type: "OUT",
        employeeId: kioskEmployeeId,
        locationId: centerId,
        pin: "4821",
      },
      otherSlug,
    );
    expect(otherTenant.status).toBe(404);
  });

  it("el PIN se bloquea tras cinco fallos seguidos", async () => {
    const base = {
      type: "OUT",
      employeeId: kioskEmployeeId,
      locationId: centerId,
    };
    for (let i = 0; i < 5; i++) {
      expect((await punch(kioskSession, { ...base, pin: "0000" })).status).toBe(
        403,
      );
    }
    expect((await punch(kioskSession, { ...base, pin: "4821" })).status).toBe(
      403,
    );
    await prisma.employee.update({
      where: { id: kioskEmployeeId },
      data: { pinLockedUntil: null, pinFailedAttempts: 0 },
    });
    expect((await punch(kioskSession, { ...base, pin: "4821" })).status).toBe(
      201,
    );
  });

  it("gerencia ve quién está dentro; un empleado no", async () => {
    expect(
      (await api(workerSession).get("/api/v1/check-in/presence")).status,
    ).toBe(403);
    await punch(workerSession, { type: "IN", ...INSIDE });
    const presence = body(
      await api(adminSession).get("/api/v1/check-in/presence"),
    );
    const byId = Object.fromEntries(presence.map((p: any) => [p.id, p]));
    expect(byId[personalEmployeeId].status).toBe("IN");
    expect(byId[kioskEmployeeId].status).toBe("OUT");
    expect(byId[personalEmployeeId].lastPunch.locationName).toBe("Restaurante");
  });

  it("una cuenta compartida no ve fichas, configuración ni presencia aunque sea ADMIN", async () => {
    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "cp-shared-admin@test.com",
        passwordHash,
        name: "Ordenador cocina",
        tenantId,
        role: "ADMIN",
        isActive: true,
        isSharedAccount: true,
      },
    });
    const shared = api(await login("cp-shared-admin@test.com", slug));

    for (const path of [
      "/api/v1/check-in/employees",
      `/api/v1/check-in/employees/${personalEmployeeId}`,
      "/api/v1/check-in/employees/linkable-users",
      "/api/v1/check-in/settings",
      "/api/v1/check-in/work-centers",
      "/api/v1/check-in/legal-texts",
      "/api/v1/check-in/presence",
    ]) {
      expect({ path, status: (await shared.get(path)).status }).toEqual({
        path,
        status: 403,
      });
    }
    expect(
      (
        await shared.post(
          "/api/v1/check-in/legal-texts/GEOLOCALIZACION/validate",
        )
      ).status,
    ).toBe(403);

    // Lo que sí puede: abrir el kiosco y consultar si se puede fichar.
    const kiosk = await shared.get(
      `/api/v1/check-in/kiosk?locationId=${centerId}`,
    );
    expect(kiosk.status).toBe(200);
    expect(JSON.stringify(kiosk.body)).not.toMatch(
      /nationalId|socialSecurityNumber|hourlyCost|pinHash/,
    );
    expect((await shared.get("/api/v1/check-in/readiness")).status).toBe(200);
  });

  it("la base de datos rechaza modificar o borrar un fichaje", async () => {
    const any = await prisma.timePunch.findFirst({ where: { tenantId } });
    await expect(
      prisma.$executeRaw`UPDATE "time_punches" SET "occurredAt" = now() WHERE "id" = ${any!.id}`,
    ).rejects.toThrow(/inalterable/);
    await expect(
      prisma.$executeRaw`DELETE FROM "time_punches" WHERE "id" = ${any!.id}`,
    ).rejects.toThrow(/inalterable/);
    await expect(
      prisma.$executeRaw`DELETE FROM "check_in_legal_acks" WHERE "tenantId" = ${tenantId}`,
    ).rejects.toThrow(/inalterable/);
  });

  it("los fichajes del tenant forman una cadena numerada y verificable", async () => {
    const punches = await prisma.timePunch.findMany({
      where: { tenantId },
      orderBy: { seq: "asc" },
    });
    expect(punches.length).toBeGreaterThan(10);
    let prevHash: string | null = null;
    punches.forEach((p, index) => {
      expect(p.seq).toBe(index + 1);
      expect(p.prevHash).toBe(prevHash);
      expect(p.hash).toBe(computePunchHash(prevHash, p));
      prevHash = p.hash;
    });
    // El otro tenant tiene su propia numeración, sin fichajes de este.
    expect(
      await prisma.timePunch.count({ where: { tenantId: otherTenantId } }),
    ).toBe(0);
  });
});
