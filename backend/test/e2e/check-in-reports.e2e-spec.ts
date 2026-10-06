import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import ExcelJS from "exceljs";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Check-In, informes: registro de jornada en PDF, Excel y CSV, verificación
 * de integridad y enlace de solo lectura para la Inspección de Trabajo.
 */
describe("E2E - Check-In informes e inspección", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-check-in-reports";
  let tenantId: string;
  let employeeId: string;
  let adminSession: string;
  let workerSession: string;
  let sharedAdminSession: string;
  let token: string;
  let linkId: string;

  const today = new Date();
  const base = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
  );
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const at = (d: number, time: string) =>
    `${year}-${pad(month)}-${pad(d)}T${time}:00.000Z`;
  const reportUrl = (format: string, extra = "") =>
    `/api/v1/check-in/reports/workdays?year=${year}&month=${month}&format=${format}${extra}`;

  const body = (res: request.Response) => res.body?.data ?? res.body;
  const binary = (req: request.Test) =>
    req.buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

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
  /** Sin sesión ni cabecera de tenant: como lo abriría un inspector. */
  const anon = (path: string) => request(app.getHttpServer()).get(path);

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
        data: {
          name: "Restaurante Informes SL",
          slug,
          isActive: true,
          cifNif: "B00000000",
        },
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
      data: {
        tenantId,
        name: "Local Centro",
        isDefault: true,
        timezone: "UTC",
      },
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
    await makeUser("cr-admin@test.com", "ADMIN");
    const worker = await makeUser("cr-worker@test.com", "USER");
    await makeUser("cr-shared@test.com", "ADMIN", true);
    employeeId = (
      await prisma.employee.create({
        data: {
          tenantId,
          userId: worker.id,
          firstName: "Marta",
          lastName: "Ruiz Soler",
          nationalId: "00000000T",
          socialSecurityNumber: "280000000000",
          jobTitle: "Cocinera",
          defaultLocationId: center.id,
          locations: { create: [{ tenantId, locationId: center.id }] },
        },
      })
    ).id;

    adminSession = await login("cr-admin@test.com");
    workerSession = await login("cr-worker@test.com");
    sharedAdminSession = await login("cr-shared@test.com");

    // Dos jornadas el mes pasado: una partida y una normal.
    const res = await api(workerSession).post("/api/v1/check-in/punches/sync", {
      punches: (
        [
          ["IN", 1, "09:00"],
          ["OUT", 1, "13:00"],
          ["IN", 1, "17:00"],
          ["OUT", 1, "21:00"],
          ["IN", 2, "10:00"],
          ["OUT", 2, "18:30"],
        ] as const
      ).map(([type, d, time]) => ({
        id: randomUUID(),
        type,
        deviceTime: at(d, time),
      })),
    });
    expect(res.status).toBe(201);
    await api(adminSession).post("/api/v1/check-in/adjustments", {
      employeeId,
      kind: "ADD",
      type: "IN",
      occurredAt: at(3, "09:00"),
      reason: "No pudo fichar: móvil sin batería",
    });
    await api(adminSession).post("/api/v1/check-in/adjustments", {
      employeeId,
      kind: "ADD",
      type: "OUT",
      occurredAt: at(3, "12:00"),
      reason: "No pudo fichar: móvil sin batería",
    });
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
    await prisma.checkInInspectionLink.deleteMany({ where: { tenantId } });
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

  it("solo gerencia, desde su cuenta personal, descarga informes", async () => {
    expect((await api(workerSession).get(reportUrl("csv"))).status).toBe(403);
    expect((await api(sharedAdminSession).get(reportUrl("csv"))).status).toBe(
      403,
    );
    expect(
      (await api(workerSession).get("/api/v1/check-in/inspection-links"))
        .status,
    ).toBe(403);
    expect((await api(adminSession).get(reportUrl("docx"))).status).toBe(400);
  });

  it("CSV: una fila por jornada, con empresa, persona y tramos", async () => {
    const res = await api(adminSession).get(reportUrl("csv"));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain(
      `registro-jornada-${year}-${pad(month)}.csv`,
    );
    const text: string = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM para Excel
    const lines = text.trim().split("\r\n");
    expect(lines).toHaveLength(4); // cabecera + 3 jornadas
    expect(lines[0]).toContain("Tramos (entrada-salida)");
    expect(lines[1]).toContain(
      "Restaurante Informes SL;B00000000;Local Centro",
    );
    expect(lines[1]).toContain("Marta Ruiz Soler;00000000T;280000000000");
    expect(lines[1]).toContain(
      `01/${pad(month)}/${year};09:00-13:00  17:00-21:00;8:00`,
    );
    expect(lines[2]).toContain("10:00-18:30;8:30");
    // La jornada del día 3 existe solo por correcciones, y se dice.
    expect(lines[3]).toContain("09:00-12:00;3:00");
    expect(lines[3]).toContain("Con correcciones");
  });

  it("Excel: registro diario, resumen y correcciones con su motivo", async () => {
    const res = await binary(api(adminSession).get(reportUrl("xlsx")));
    expect(res.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    expect(workbook.worksheets.map((w) => w.name)).toEqual([
      "Registro diario",
      "Resumen",
      "Correcciones",
    ]);
    expect(workbook.getWorksheet("Registro diario")!.rowCount).toBe(4);
    const summary = workbook.getWorksheet("Resumen")!.getRow(2);
    expect(summary.getCell(1).value).toBe("Marta Ruiz Soler");
    expect(summary.getCell(4).value).toBe(3); // días trabajados
    expect(summary.getCell(5).value).toBe("19:30"); // 8:00 + 8:30 + 3:00
    const corrections = workbook.getWorksheet("Correcciones")!;
    expect(corrections.rowCount).toBe(3);
    expect(corrections.getRow(2).getCell(4).value).toBe(
      "No pudo fichar: móvil sin batería",
    );
    expect(corrections.getRow(2).getCell(7).value).toBe("Aprobada");
  });

  it("PDF: se genera para todo el equipo y para una sola persona", async () => {
    const all = await binary(api(adminSession).get(reportUrl("pdf")));
    expect(all.status).toBe(200);
    expect(all.headers["content-type"]).toContain("application/pdf");
    expect(all.body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(all.body.length).toBeGreaterThan(1500);

    const one = await binary(
      api(adminSession).get(reportUrl("pdf", `&employeeId=${employeeId}`)),
    );
    expect(one.status).toBe(200);
    expect(one.body.subarray(0, 5).toString()).toBe("%PDF-");
    // Una persona con tres jornadas cabe en una página: el pie no añade otra.
    expect(
      (one.body.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    ).toBe(1);
  });

  it("la verificación de integridad detecta una fila alterada a mano", async () => {
    const ok = body(
      await api(adminSession).get("/api/v1/check-in/reports/integrity"),
    );
    expect(ok).toMatchObject({ ok: true, checked: 6, brokenAtSeq: null });
    expect(ok.lastHash).toMatch(/^[0-9a-f]{64}$/);

    // Alguien con acceso a la BD se salta el trigger y cambia una hora.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.$executeRaw`UPDATE "time_punches" SET "occurredAt" = "occurredAt" - interval '1 hour' WHERE "tenantId" = ${tenantId} AND "seq" = 3`;
    });
    const broken = body(
      await api(adminSession).get("/api/v1/check-in/reports/integrity"),
    );
    expect(broken).toMatchObject({ ok: false, brokenAtSeq: 3, checked: 2 });

    // Se deja como estaba para el resto de pruebas.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.$executeRaw`UPDATE "time_punches" SET "occurredAt" = "occurredAt" + interval '1 hour' WHERE "tenantId" = ${tenantId} AND "seq" = 3`;
    });
    expect(
      body(await api(adminSession).get("/api/v1/check-in/reports/integrity"))
        .ok,
    ).toBe(true);
  });

  it("crea un enlace de inspección; el token solo se ve al crearlo", async () => {
    const invalid = await api(adminSession).post(
      "/api/v1/check-in/inspection-links",
      {
        fromYear: year,
        fromMonth: month,
        toYear: year - 1,
        toMonth: month,
        validDays: 7,
      },
    );
    expect(invalid.status).toBe(400);

    const res = await api(adminSession).post(
      "/api/v1/check-in/inspection-links",
      {
        label: "Inspección de prueba",
        fromYear: year,
        fromMonth: month,
        toYear: year,
        toMonth: month,
        validDays: 7,
      },
    );
    expect(res.status).toBe(201);
    token = body(res).token;
    linkId = body(res).id;
    expect(token.length).toBeGreaterThan(40);

    const list = await api(adminSession).get(
      "/api/v1/check-in/inspection-links",
    );
    expect(body(list)).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(token);
    expect(JSON.stringify(list.body)).not.toContain("tokenHash");
    // En la base de datos tampoco está el token, solo su huella.
    const stored = await prisma.checkInInspectionLink.findUnique({
      where: { id: linkId },
    });
    expect(stored!.tokenHash).not.toBe(token);
  });

  it("el inspector abre el enlace sin cuenta y descarga el registro", async () => {
    const summary = await anon(`/api/v1/check-in/inspection/${token}`);
    expect(summary.status).toBe(200);
    expect(body(summary)).toMatchObject({
      company: { name: "Restaurante Informes SL", taxId: "B00000000" },
      months: [{ year, month }],
    });

    const csv = await anon(
      `/api/v1/check-in/inspection/${token}/report?year=${year}&month=${month}&format=csv`,
    );
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("Marta Ruiz Soler");

    const pdf = await binary(
      anon(
        `/api/v1/check-in/inspection/${token}/report?year=${year}&month=${month}&format=pdf`,
      ),
    );
    expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    // Los accesos quedan contados.
    const link = body(
      await api(adminSession).get("/api/v1/check-in/inspection-links"),
    )[0];
    expect(link.accessCount).toBe(3);
    expect(link.lastAccessAt).toBeTruthy();
  });

  it("el enlace no da acceso fuera de su periodo ni a nada más", async () => {
    const other = month === 1 ? 2 : month - 1;
    expect(
      (
        await anon(
          `/api/v1/check-in/inspection/${token}/report?year=${year}&month=${other}&format=csv`,
        )
      ).status,
    ).toBe(400);
    // El token no sirve como sesión para el resto de la API.
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/v1/check-in/employees")
          .set({ Authorization: `Bearer ${token}`, "X-Tenant-Slug": slug })
      ).status,
    ).toBe(401);
    expect(
      (await anon("/api/v1/check-in/inspection/token-inventado")).status,
    ).toBe(404);
  });

  it("un enlace caducado o revocado deja de funcionar", async () => {
    await prisma.checkInInspectionLink.update({
      where: { id: linkId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await anon(`/api/v1/check-in/inspection/${token}`)).status).toBe(
      404,
    );

    await prisma.checkInInspectionLink.update({
      where: { id: linkId },
      data: { expiresAt: new Date(Date.now() + 86_400_000) },
    });
    expect((await anon(`/api/v1/check-in/inspection/${token}`)).status).toBe(
      200,
    );

    const revoked = await api(adminSession).post(
      `/api/v1/check-in/inspection-links/${linkId}/revoke`,
    );
    expect(body(revoked)).toMatchObject({ active: false });
    expect((await anon(`/api/v1/check-in/inspection/${token}`)).status).toBe(
      404,
    );
    expect(
      (
        await anon(
          `/api/v1/check-in/inspection/${token}/report?year=${year}&month=${month}&format=csv`,
        )
      ).status,
    ).toBe(404);
  });
});
