import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * Documentación laboral: subida por gerencia (a una o varias personas),
 * descarga autenticada, acuse de lectura inalterable, caducidad y
 * justificantes del propio empleado. HTTP real + Postgres real.
 */
describe("E2E - RRHH: documentación laboral", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = "e2e-rrhh-documentos";
  const otherSlug = "e2e-rrhh-documentos-other";
  let tenantId: string;
  let otherTenantId: string;
  let martaId: string;
  let luisId: string;
  let adminSession: string;
  let martaSession: string;
  let luisSession: string;
  let noFichaSession: string;
  let sharedAdminSession: string;
  let otherAdminSession: string;
  let martaContractId: string;
  let luisContractId: string;

  const PDF = Buffer.from("%PDF-1.4 contrato de prueba");
  const DOCS = "/api/v1/rrhh/documents";
  const MINE = "/api/v1/rrhh/me/documents";
  const body = (res: request.Response) => res.body?.data ?? res.body;
  const inDays = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  function api(session: string, tenantSlug = slug) {
    const headers = {
      Authorization: `Bearer ${session}`,
      "X-Tenant-Slug": tenantSlug,
    };
    const server = app.getHttpServer();
    return {
      get: (url: string) => request(server).get(url).set(headers),
      post: (url: string) => request(server).post(url).set(headers),
      delete: (url: string) => request(server).delete(url).set(headers),
    };
  }
  const uploadFor = (
    session: string,
    fields: Record<string, string>,
    file: { name: string; type: string } | null = {
      name: "contrato.pdf",
      type: "application/pdf",
    },
  ) => {
    let req = api(session).post(DOCS);
    for (const [key, value] of Object.entries(fields)) {
      req = req.field(key, value);
    }
    return file
      ? req.attach("file", PDF, { filename: file.name, contentType: file.type })
      : req;
  };

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
      for (const moduleId of ["check-in", "rrhh"]) {
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
    tenantId = await makeTenant("Documentos E2E", slug);
    otherTenantId = await makeTenant("Documentos E2E Otro", otherSlug);

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
    await makeUser("doc-admin@test.com", "ADMIN");
    const marta = await makeUser("doc-marta@test.com", "USER");
    const luis = await makeUser("doc-luis@test.com", "USER");
    await makeUser("doc-noficha@test.com", "USER");
    await makeUser("doc-shared@test.com", "ADMIN", tenantId, true);
    await makeUser("doc-other-admin@test.com", "ADMIN", otherTenantId);

    const employee = (firstName: string, userId: string) =>
      prisma.employee.create({
        data: { tenantId, userId, firstName, lastName: "Prueba" },
      });
    martaId = (await employee("Marta", marta.id)).id;
    luisId = (await employee("Luis", luis.id)).id;

    adminSession = await login("doc-admin@test.com");
    martaSession = await login("doc-marta@test.com");
    luisSession = await login("doc-luis@test.com");
    noFichaSession = await login("doc-noficha@test.com");
    sharedAdminSession = await login("doc-shared@test.com");
    otherAdminSession = await login("doc-other-admin@test.com", otherSlug);
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.employeeDocumentAck.deleteMany({
        where: { tenantId: { in: ids } },
      });
    });
    await prisma.employeeDocument.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.employee.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.configuration.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: ids } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ANY(${ids})`;
    // Sin Bunny, los adjuntos privados de la prueba quedan en disco.
    for (const id of ids) {
      fs.rmSync(
        path.join(process.cwd(), "private-uploads", "rrhh-documentos", id),
        { recursive: true, force: true },
      );
    }
    await app.close();
  });

  it("gerencia sube un documento para varias personas a la vez", async () => {
    const fields = {
      employeeIds: `${martaId},${luisId}`,
      category: "CONTRATO",
      title: "Contrato 2026",
      requiresAck: "true",
      expiresAt: inDays(10),
    };
    expect((await uploadFor(adminSession, fields, null)).status).toBe(400);
    expect(
      (
        await uploadFor(adminSession, fields, {
          name: "virus.exe",
          type: "application/x-msdownload",
        })
      ).status,
    ).toBe(400);
    expect(
      (await uploadFor(adminSession, { ...fields, employeeIds: "no-existe" }))
        .status,
    ).toBe(400);
    expect(
      (await uploadFor(adminSession, { ...fields, category: "NOMINA" })).status,
    ).toBe(400);

    const res = await uploadFor(adminSession, fields);
    expect(res.status).toBe(201);
    const created = body(res);
    expect(created).toHaveLength(2);
    martaContractId = created.find((d: any) => d.employeeId === martaId).id;
    luisContractId = created.find((d: any) => d.employeeId === luisId).id;
    expect(created[0]).toMatchObject({
      category: "CONTRATO",
      title: "Contrato 2026",
      fileName: "contrato.pdf",
      requiresAck: true,
      ackAt: null,
      expiryStatus: "EXPIRING",
      uploadedByEmployee: false,
    });
    // La respuesta nunca lleva dónde está guardado el fichero.
    expect(JSON.stringify(created)).not.toMatch(/fileKey|rrhh-documentos/);
  });

  it("solo gerencia, desde su cuenta personal, gestiona los documentos de todos", async () => {
    const fields = { employeeIds: martaId, category: "OTRO", title: "Nota" };
    for (const session of [martaSession, sharedAdminSession]) {
      expect((await api(session).get(DOCS)).status).toBe(403);
      expect((await uploadFor(session, fields)).status).toBe(403);
      expect(
        (await api(session).get(`${DOCS}/${martaContractId}/file`)).status,
      ).toBe(403);
      expect(
        (await api(session).delete(`${DOCS}/${martaContractId}`)).status,
      ).toBe(403);
    }
  });

  it("cada persona ve y descarga solo sus documentos", async () => {
    const own = body(await api(martaSession).get(MINE));
    expect(own.map((d: any) => d.id)).toEqual([martaContractId]);

    const file = await api(martaSession)
      .get(`${MINE}/${martaContractId}/file`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
    expect(file.headers["cache-control"]).toContain("no-store");
    expect(Buffer.compare(file.body, PDF)).toBe(0);

    // El documento de Marta no existe para Luis, aunque sepa su id.
    expect(
      (await api(luisSession).get(`${MINE}/${martaContractId}/file`)).status,
    ).toBe(404);
    expect(
      (await api(luisSession).post(`${MINE}/${martaContractId}/ack`)).status,
    ).toBe(404);
    for (const session of [noFichaSession, sharedAdminSession]) {
      expect((await api(session).get(MINE)).status).toBe(403);
      expect(
        (await api(session).get(`${MINE}/${martaContractId}/file`)).status,
      ).toBe(403);
    }
  });

  it("el acuse de lectura queda registrado y no se puede cambiar", async () => {
    const res = await api(martaSession).post(`${MINE}/${martaContractId}/ack`);
    expect(res.status).toBe(201);
    expect(body(res).ackAt).toBeTruthy();
    expect(
      (await api(martaSession).post(`${MINE}/${martaContractId}/ack`)).status,
    ).toBe(409);

    const ack = await prisma.employeeDocumentAck.findUniqueOrThrow({
      where: { documentId: martaContractId },
    });
    expect(ack).toMatchObject({
      employeeName: "Marta Prueba",
      documentTitle: "Contrato 2026",
    });
    await expect(
      prisma.employeeDocumentAck.update({
        where: { id: ack.id },
        data: { ackAt: new Date(0) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.employeeDocumentAck.delete({ where: { id: ack.id } }),
    ).rejects.toThrow();

    // Gerencia ve quién ha dado acuse y quién no.
    const all = body(await api(adminSession).get(DOCS));
    const state = (id: string) => all.find((d: any) => d.id === id);
    expect(state(martaContractId)).toMatchObject({
      employeeName: "Marta Prueba",
      ackAt: expect.any(String),
    });
    expect(state(luisContractId)).toMatchObject({
      employeeName: "Luis Prueba",
      ackAt: null,
    });
  });

  it("un documento sin acuse pedido no admite acuse", async () => {
    const created = body(
      await uploadFor(adminSession, {
        employeeIds: martaId,
        category: "FORMACION",
        title: "Curso de alérgenos",
      }),
    );
    expect(created[0]).toMatchObject({
      requiresAck: false,
      expiresAt: null,
      expiryStatus: null,
    });
    expect(
      (await api(martaSession).post(`${MINE}/${created[0].id}/ack`)).status,
    ).toBe(400);
  });

  it("avisa de lo caducado y de lo que caduca pronto", async () => {
    const upload = async (title: string, expiresAt: string) =>
      body(
        await uploadFor(adminSession, {
          employeeIds: luisId,
          category: "PRL",
          title,
          expiresAt,
        }),
      )[0];
    expect((await upload("Caducado", inDays(-1))).expiryStatus).toBe("EXPIRED");
    expect((await upload("Vigente", inDays(90))).expiryStatus).toBe("VALID");
    expect(
      (
        await uploadFor(adminSession, {
          employeeIds: luisId,
          category: "PRL",
          title: "Fecha mal",
          expiresAt: "31/12/2026",
        })
      ).status,
    ).toBe(400);
  });

  it("retirar un documento lo oculta sin borrarlo; con acuse no se retira", async () => {
    expect(
      (await api(adminSession).delete(`${DOCS}/${martaContractId}`)).status,
    ).toBe(403);

    expect(
      (await api(adminSession).delete(`${DOCS}/${luisContractId}`)).status,
    ).toBe(204);
    const own = body(await api(luisSession).get(MINE));
    expect(own.map((d: any) => d.id)).not.toContain(luisContractId);
    expect(
      (await api(luisSession).get(`${MINE}/${luisContractId}/file`)).status,
    ).toBe(404);
    const row = await prisma.employeeDocument.findUniqueOrThrow({
      where: { id: luisContractId },
    });
    expect(row.deletedAt).not.toBeNull();
    // El fichero es el mismo que el del contrato de Marta, que sigue ahí.
    expect(
      (await api(martaSession).get(`${MINE}/${martaContractId}/file`)).status,
    ).toBe(200);
  });

  it("el empleado sube sus justificantes, también fotos HEIC del iPhone", async () => {
    const res = await api(martaSession)
      .post(MINE)
      .field("title", "Justificante médico 12/10")
      .attach("file", Buffer.from("heic"), {
        filename: "IMG_0042.HEIC",
        contentType: "image/heic",
      });
    expect(res.status).toBe(201);
    expect(body(res)).toMatchObject({
      employeeId: martaId,
      category: "JUSTIFICANTE",
      uploadedByEmployee: true,
      requiresAck: false,
    });
    // No puede elegir a quién va ni la categoría.
    const forOther = await api(martaSession)
      .post(MINE)
      .field("title", "Para otro")
      .field("employeeIds", luisId)
      .attach("file", PDF, {
        filename: "a.pdf",
        contentType: "application/pdf",
      });
    expect(forOther.status).toBe(400);

    const seenByAdmin = body(
      await api(adminSession).get(`${DOCS}?employeeId=${martaId}`),
    );
    expect(seenByAdmin.map((d: any) => d.title)).toContain(
      "Justificante médico 12/10",
    );
    expect(
      (await api(adminSession).get(`${DOCS}/${body(res).id}/file`)).status,
    ).toBe(200);
  });

  it("no cruza datos entre tenants", async () => {
    const other = api(otherAdminSession, otherSlug);
    expect(body(await other.get(DOCS))).toEqual([]);
    expect((await other.get(`${DOCS}/${martaContractId}/file`)).status).toBe(
      404,
    );
    expect((await other.delete(`${DOCS}/${martaContractId}`)).status).toBe(404);
    const upload = await request(app.getHttpServer())
      .post(DOCS)
      .set({
        Authorization: `Bearer ${otherAdminSession}`,
        "X-Tenant-Slug": otherSlug,
      })
      .field("employeeIds", martaId)
      .field("category", "OTRO")
      .field("title", "Intruso")
      .attach("file", PDF, {
        filename: "a.pdf",
        contentType: "application/pdf",
      });
    expect(upload.status).toBe(400);
  });
});
