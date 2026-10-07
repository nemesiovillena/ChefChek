import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { constants, createPublicKey, publicEncrypt, randomUUID } from "crypto";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import { computePunchHash } from "../../src/modules/check-in/services/punch-hash.util";

/**
 * Check-In, fichaje sin conexión: los fichajes de la cola del dispositivo se
 * guardan con su hora real, una sola vez, y lo dudoso (PIN, secuencia, reloj)
 * queda marcado para revisión en vez de perderse. HTTP real + Postgres real.
 */
describe("E2E - Check-In fichaje sin conexión", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-check-in-offline";
  let tenantId: string;
  let centerId: string;
  let workerEmployeeId: string;
  let kioskEmployeeId: string;
  let adminSession: string;
  let workerSession: string;
  let kioskSession: string;
  let publicKey: string;

  const body = (res: request.Response) => res.body?.data ?? res.body;
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000).toISOString();

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
    };
  }

  const sync = async (session: string, punches: object[]) => {
    const res = await api(session).post("/api/v1/check-in/punches/sync", {
      punches,
    });
    expect(res.status).toBe(201);
    return body(res) as { id: string; status: string; detail?: string }[];
  };

  /** Igual que el kiosco: "<id>:<PIN>" con RSA-OAEP SHA-256. */
  const encryptPin = (punchId: string, pin: string) =>
    publicEncrypt(
      {
        key: createPublicKey({
          key: Buffer.from(publicKey, "base64"),
          format: "der",
          type: "spki",
        }),
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(`${punchId}:${pin}`),
    ).toString("base64");

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
        data: { name: "Offline E2E", slug, isActive: true },
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
    await makeUser("co-admin@test.com", "ADMIN");
    const worker = await makeUser("co-worker@test.com", "USER");
    await makeUser("co-kiosk@test.com", "USER", true);

    centerId = (
      await prisma.location.create({
        data: {
          tenantId,
          name: "Restaurante",
          isDefault: true,
          latitude: 38.63,
          longitude: -0.86,
          geofenceRadiusM: 150,
          geofenceMode: "BLOCK",
        },
      })
    ).id;
    const employee = (firstName: string, extra: object) =>
      prisma.employee.create({
        data: {
          tenantId,
          firstName,
          lastName: "Prueba",
          defaultLocationId: centerId,
          locations: { create: [{ tenantId, locationId: centerId }] },
          ...extra,
        },
      });
    workerEmployeeId = (await employee("Marta", { userId: worker.id })).id;
    kioskEmployeeId = (
      await employee("Paco", { pinHash: await bcrypt.hash("4821", 10) })
    ).id;

    adminSession = await login("co-admin@test.com");
    workerSession = await login("co-worker@test.com");
    kioskSession = await login("co-kiosk@test.com");
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
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

  it("guarda los fichajes con su hora real aunque lleguen desordenados", async () => {
    const inId = randomUUID();
    const outId = randomUUID();
    const inTime = minutesAgo(180);
    const outTime = minutesAgo(60);
    // Llegan al revés: primero la salida.
    const results = await sync(workerSession, [
      { id: outId, type: "OUT", deviceTime: outTime },
      { id: inId, type: "IN", deviceTime: inTime },
    ]);
    expect(results).toEqual([
      { id: inId, status: "ACCEPTED" },
      { id: outId, status: "ACCEPTED" },
    ]);

    const saved = await prisma.timePunch.findUnique({ where: { id: inId } });
    expect(saved).toMatchObject({
      employeeId: workerEmployeeId,
      wasOffline: true,
      needsReview: false,
      source: "PERSONAL",
      geofenceStatus: "UNAVAILABLE",
    });
    expect(saved!.occurredAt.toISOString()).toBe(inTime);
    expect(saved!.receivedAt.getTime()).toBeGreaterThan(
      saved!.occurredAt.getTime(),
    );

    const state = body(await api(workerSession).get("/api/v1/check-in/me"));
    expect(state.status).toBe("OUT");
  });

  it("reenviar la cola no duplica nada", async () => {
    const id = randomUUID();
    const item = { id, type: "IN", deviceTime: minutesAgo(50) };
    expect((await sync(workerSession, [item]))[0].status).toBe("ACCEPTED");
    const before = await prisma.timePunch.count({ where: { tenantId } });
    expect((await sync(workerSession, [item]))[0].status).toBe("DUPLICATE");
    expect(await prisma.timePunch.count({ where: { tenantId } })).toBe(before);
  });

  it("un fichaje con conexión posterior valida contra el orden en el tiempo", async () => {
    // Con conexión hace falta haber aceptado la información legal.
    await api(workerSession).post("/api/v1/check-in/me/legal-acks");
    // Marta está dentro desde hace 50 min (test anterior). Sale ahora, online.
    const out = await api(workerSession).post("/api/v1/check-in/punches", {
      id: randomUUID(),
      type: "OUT",
    });
    expect(out.status).toBe(201);

    // Aparece ahora una pausa hecha sin conexión hace 30 min: es coherente
    // con lo que había en ese momento (estaba dentro), aunque llegue tarde.
    const results = await sync(workerSession, [
      { id: randomUUID(), type: "BREAK_START", deviceTime: minutesAgo(30) },
      { id: randomUUID(), type: "BREAK_END", deviceTime: minutesAgo(20) },
    ]);
    expect(results.map((r) => r.status)).toEqual(["ACCEPTED", "ACCEPTED"]);
    expect(
      body(await api(workerSession).get("/api/v1/check-in/me")).status,
    ).toBe("OUT");
  });

  it("una secuencia imposible se guarda marcada, no se pierde", async () => {
    const id = randomUUID();
    const [result] = await sync(workerSession, [
      { id, type: "OUT", deviceTime: minutesAgo(5) }, // ya estaba fuera
    ]);
    expect(result).toEqual({ id, status: "FLAGGED", detail: "SECUENCIA" });
    expect(await prisma.timePunch.findUnique({ where: { id } })).toMatchObject({
      needsReview: true,
      reviewReason: "SECUENCIA",
    });
  });

  it("un reloj adelantado no fecha el fichaje en el futuro", async () => {
    const id = randomUUID();
    const future = new Date(Date.now() + 3 * 3600_000).toISOString();
    const [result] = await sync(workerSession, [
      { id, type: "IN", deviceTime: future },
    ]);
    expect(result.status).toBe("FLAGGED");
    expect(result.detail).toContain("RELOJ");
    const saved = await prisma.timePunch.findUnique({ where: { id } });
    expect(saved!.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(saved!.deviceTime!.toISOString()).toBe(future);
  });

  it("kiosco sin conexión: el PIN cifrado se valida al sincronizar", async () => {
    const kiosk = body(
      await api(kioskSession).get(
        `/api/v1/check-in/kiosk?locationId=${centerId}`,
      ),
    );
    publicKey = kiosk.pinPublicKey;
    expect(publicKey).toBeTruthy();
    // La clave es estable entre llamadas.
    expect(
      body(await api(kioskSession).get("/api/v1/check-in/kiosk")).pinPublicKey,
    ).toBe(publicKey);

    const id = randomUUID();
    const [result] = await sync(kioskSession, [
      {
        id,
        type: "IN",
        deviceTime: minutesAgo(40),
        employeeId: kioskEmployeeId,
        locationId: centerId,
        encryptedPin: encryptPin(id, "4821"),
      },
    ]);
    expect(result).toEqual({ id, status: "ACCEPTED" });
    expect(await prisma.timePunch.findUnique({ where: { id } })).toMatchObject({
      source: "KIOSK",
      pinStatus: "VERIFIED",
      employeeId: kioskEmployeeId,
    });
  });

  it("PIN incorrecto, ausente o reutilizado de otro fichaje: se guarda a revisar", async () => {
    const wrong = randomUUID();
    const missing = randomUUID();
    const replayed = randomUUID();
    const base = { employeeId: kioskEmployeeId, locationId: centerId };
    const results = await sync(kioskSession, [
      {
        ...base,
        id: wrong,
        type: "OUT",
        deviceTime: minutesAgo(35),
        encryptedPin: encryptPin(wrong, "0000"),
      },
      { ...base, id: missing, type: "IN", deviceTime: minutesAgo(30) },
      {
        ...base,
        id: replayed,
        type: "OUT",
        deviceTime: minutesAgo(25),
        // PIN correcto, pero cifrado para otro fichaje.
        encryptedPin: encryptPin(randomUUID(), "4821"),
      },
    ]);
    expect(results.map((r) => [r.status, r.detail])).toEqual([
      ["FLAGGED", "PIN"],
      ["FLAGGED", "PIN"],
      ["FLAGGED", "PIN"],
    ]);
    const saved = await prisma.timePunch.findMany({
      where: { id: { in: [wrong, missing, replayed] } },
    });
    expect(saved).toHaveLength(3);
    expect(saved.every((p) => p.pinStatus === "PENDING_REVIEW")).toBe(true);
  });

  it("fuera de una zona con bloqueo: se guarda marcado", async () => {
    const id = randomUUID();
    const [result] = await sync(workerSession, [
      {
        id,
        type: "OUT",
        deviceTime: minutesAgo(2),
        latitude: 38.64,
        longitude: -0.86,
      },
    ]);
    expect(result.status).toBe("FLAGGED");
    expect(result.detail).toContain("FUERA_DE_ZONA");
  });

  it("rechaza solo lo que no puede atribuirse, sin frenar el resto del lote", async () => {
    const good = randomUUID();
    const ghost = randomUUID();
    const results = await sync(kioskSession, [
      {
        id: ghost,
        type: "IN",
        deviceTime: minutesAgo(12),
        employeeId: "no-existe",
        locationId: centerId,
      },
      {
        id: good,
        type: "IN",
        deviceTime: minutesAgo(10),
        employeeId: kioskEmployeeId,
        locationId: centerId,
        encryptedPin: encryptPin(good, "4821"),
      },
    ]);
    expect(results[0]).toMatchObject({ id: ghost, status: "REJECTED" });
    expect(results[1]).toEqual({ id: good, status: "ACCEPTED" });
    expect(await prisma.timePunch.count({ where: { id: ghost } })).toBe(0);
  });

  it("gerencia ve los fichajes a revisar; una cuenta compartida no", async () => {
    const review = body(
      await api(adminSession).get("/api/v1/check-in/punches/review"),
    );
    expect(review.length).toBeGreaterThanOrEqual(6);
    expect(review.every((p: any) => p.reviewReason && p.wasOffline)).toBe(true);
    expect(review[0]).toHaveProperty("employeeName");
    expect(
      (await api(kioskSession).get("/api/v1/check-in/punches/review")).status,
    ).toBe(403);
    expect(
      (await api(workerSession).get("/api/v1/check-in/punches/review")).status,
    ).toBe(403);
  });

  it("la cadena de huellas sigue íntegra con fichajes fuera de orden", async () => {
    const punches = await prisma.timePunch.findMany({
      where: { tenantId },
      orderBy: { seq: "asc" },
    });
    let prevHash: string | null = null;
    punches.forEach((p, index) => {
      expect(p.seq).toBe(index + 1);
      expect(p.hash).toBe(computePunchHash(prevHash, p));
      prevHash = p.hash;
    });
  });

  it("un fichaje sin conexión enviado más de un día después queda a revisar", async () => {
    const id = randomUUID();
    const old = new Date(Date.now() - 49 * 3600_000).toISOString();
    const [result] = await sync(workerSession, [
      { id, type: "IN", deviceTime: old },
    ]);
    expect(result.status).toBe("FLAGGED");
    expect(result.detail).toContain("TARDIO");
    const saved = await prisma.timePunch.findUnique({ where: { id } });
    expect(saved!.occurredAt.toISOString()).toBe(old);
    expect(saved!.needsReview).toBe(true);
  });
});
