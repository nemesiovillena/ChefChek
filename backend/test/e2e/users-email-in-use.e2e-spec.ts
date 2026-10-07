import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";

/**
 * El email de un usuario es único por tenant, también frente a usuarios
 * eliminados (siguen en la tabla, en la Papelera). El alta y el cambio de
 * email deben avisar con un 409 claro, nunca con un 500 de la base de datos.
 */
describe("E2E - Usuarios: email ya usado", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let sessionId: string;

  // Slug único por ejecución: el borrado de tenants es lógico y un slug fijo
  // chocaría en la siguiente pasada.
  const stamp = Date.now();
  const slug = `e2e-users-email-${stamp}`;
  const adminEmail = `admin-${stamp}@test.com`;
  const email = `repetido-${stamp}@test.com`;

  const api = () => ({
    post: (path: string, payload: object) =>
      request(app.getHttpServer())
        .post(path)
        .set("Authorization", `Bearer ${sessionId}`)
        .send(payload),
    patch: (path: string, payload: object) =>
      request(app.getHttpServer())
        .patch(path)
        .set("Authorization", `Bearer ${sessionId}`)
        .send(payload),
    delete: (path: string) =>
      request(app.getHttpServer())
        .delete(path)
        .set("Authorization", `Bearer ${sessionId}`),
  });
  const createUser = (userEmail: string) =>
    api().post("/api/v1/users", {
      tenantId,
      email: userEmail,
      password: "1047",
      name: "Pruebas",
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

    tenantId = (
      await prisma.tenant.create({
        data: { name: "Usuarios email E2E", slug, isActive: true },
      })
    ).id;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash("TestPass123!", 10),
        name: "Admin",
        tenantId,
        role: "ADMIN",
        isActive: true,
      },
    });
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", slug)
      .send({ email: adminEmail, password: "TestPass123!" });
    sessionId = login.body.data.session.id;
  });

  afterAll(async () => {
    // SQL directo: borrado físico, también de los usuarios ya eliminados.
    await prisma.$executeRaw`DELETE FROM "sessions" WHERE "userId" IN (SELECT "id" FROM "users" WHERE "tenantId" = ${tenantId})`;
    await prisma.$executeRaw`DELETE FROM "users" WHERE "tenantId" = ${tenantId}`;
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "id" = ${tenantId}`;
    await app.close();
  });

  it("el alta avisa si el email es de un usuario activo", async () => {
    await createUser(email).expect(201);

    const res = await createUser(email).expect(409);
    expect(res.body.message).toBe("Ya existe un usuario con ese email.");
  });

  it("el alta avisa si el email es de un usuario eliminado", async () => {
    const existing = await prisma.user.findFirstOrThrow({
      where: { tenantId, email },
    });
    await api().delete(`/api/v1/users/${existing.id}`).expect(204);

    const res = await createUser(email).expect(409);
    expect(res.body.message).toContain("Papelera");
  });

  it("cambiar el email por uno ya usado también avisa", async () => {
    const other = await createUser(`otro-${email}`).expect(201);

    const res = await api()
      .patch(`/api/v1/users/${other.body.data.id}`, { email })
      .expect(409);
    expect(res.body.message).toContain("Papelera");

    // Guardar sin cambiar el email sigue funcionando.
    await api()
      .patch(`/api/v1/users/${other.body.data.id}`, {
        email: `otro-${email}`,
        name: "Otro nombre",
      })
      .expect(200);
  });
});
