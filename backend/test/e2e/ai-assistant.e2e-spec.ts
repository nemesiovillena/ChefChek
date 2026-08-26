import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/services/prisma.service";
import * as bcrypt from "bcrypt";

/**
 * Smoke E2E del asistente Chefchek: sin API key real de ningún proveedor
 * (no se llama a ningún LLM en vivo aquí — eso es verificación manual, ver
 * plan.md fase 6), pero contra la app y la DB reales, cubre:
 *  - módulo activado por defecto (defaultEnabled: true)
 *  - endpoint degrada con el mensaje de "sin config" en vez de 500
 *  - aislamiento entre tenants en /conversations/:id
 */
describe("E2E - Asistente IA Chefchek", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tenantA = {
    slug: "e2e-assistant-tenant-a",
    name: "Assistant Tenant A",
  };
  const tenantB = {
    slug: "e2e-assistant-tenant-b",
    name: "Assistant Tenant B",
  };
  let tenantAId: string;
  let tenantBId: string;
  let sessionA: string;
  let sessionB: string;

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
    // Idempotente: si una corrida anterior no limpió bien (p. ej. --forceExit
    // cortó el afterAll a mitad), este slug ya existiría y el create fallaría
    // por el @@unique — se limpia por slug ANTES de sembrar, no solo después.
    await cleanupBySlug();
    await seedTenantsAndUsers();
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
  });

  async function cleanupBySlug() {
    const leftover = await prisma.tenant.findMany({
      where: { slug: { in: [tenantA.slug, tenantB.slug] } },
      select: { id: true },
    });
    if (leftover.length === 0) return;
    const ids = leftover.map((t) => t.id);
    await prisma.assistantMessage.deleteMany({
      where: { conversation: { tenantId: { in: ids } } },
    });
    await prisma.assistantConversation.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.session.deleteMany({
      where: { user: { tenantId: { in: ids } } },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  }

  async function seedTenantsAndUsers() {
    const tA = await prisma.tenant.create({
      data: { name: tenantA.name, slug: tenantA.slug, isActive: true },
    });
    const tB = await prisma.tenant.create({
      data: { name: tenantB.name, slug: tenantB.slug, isActive: true },
    });
    tenantAId = tA.id;
    tenantBId = tB.id;

    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    await prisma.user.create({
      data: {
        email: "assistant-a@test.com",
        passwordHash,
        name: "Assistant Tenant A Admin",
        tenantId: tenantAId,
        role: "ADMIN",
        isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        email: "assistant-b@test.com",
        passwordHash,
        name: "Assistant Tenant B Admin",
        tenantId: tenantBId,
        role: "ADMIN",
        isActive: true,
      },
    });

    const loginA = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantA.slug)
      .send({ email: "assistant-a@test.com", password: "TestPass123!" });
    sessionA = loginA.body.data.session.id;

    const loginB = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-slug", tenantB.slug)
      .send({ email: "assistant-b@test.com", password: "TestPass123!" });
    sessionB = loginB.body.data.session.id;
  }

  async function cleanupAll() {
    await cleanupBySlug();
  }

  it("el módulo asistente-ia está activo por defecto (defaultEnabled: true)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/ai-assistant/conversations")
      .set({
        Authorization: `Bearer ${sessionA}`,
        "X-Tenant-Slug": tenantA.slug,
      })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("sin proveedor configurado, /ask responde 200 con el mensaje de Chefchek, nunca 500", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/ai-assistant/ask")
      .set({
        Authorization: `Bearer ${sessionA}`,
        "X-Tenant-Slug": tenantA.slug,
      })
      .send({ message: "¿qué producto se compró más la última semana?" })
      .expect(200);
    expect(res.body.data.answer).toContain("proveedor de IA configurado");
  });

  it("aísla conversaciones entre tenants: tenant B no puede leer una conversación de tenant A", async () => {
    const created = await prisma.assistantConversation.create({
      data: {
        tenantId: tenantAId,
        userId: (
          await prisma.user.findFirstOrThrow({
            where: { email: "assistant-a@test.com" },
          })
        ).id,
        title: "Conversación privada de A",
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/ai-assistant/conversations/${created.id}`)
      .set({
        Authorization: `Bearer ${sessionB}`,
        "X-Tenant-Slug": tenantB.slug,
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/ai-assistant/conversations/${created.id}`)
      .set({
        Authorization: `Bearer ${sessionA}`,
        "X-Tenant-Slug": tenantA.slug,
      })
      .expect(200);
  });
});
