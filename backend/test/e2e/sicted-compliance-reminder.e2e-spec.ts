import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { NotificationsService } from "../../src/modules/core/notifications.service";
import { WebSocketService } from "../../src/websocket/websocket.service";
import { ModulesService } from "../../src/modules/modules/modules.service";
import { SictedComplianceReminderService } from "../../src/modules/sicted/services/sicted-compliance-reminder.service";

/**
 * Fase 9 SICTED (sub-PR 3) — avisos de vencimiento de documentos legales: a
 * 30 días, al vencer, idempotencia, y que un módulo desactivado no genere
 * avisos. Mismo criterio de test que `checklist-maintenance-reminder.e2e-spec.ts`
 * (fase 4) — `NotificationsService` real (crea `Alert` en BD).
 */
describe("E2E - SictedComplianceReminderService (fase 9, sub-PR 3)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let reminder: SictedComplianceReminderService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        NotificationsService,
        ModulesService,
        SictedComplianceReminderService,
        {
          provide: WebSocketService,
          useValue: { broadcastNotification: jest.fn() },
        },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    reminder = moduleRef.get(SictedComplianceReminderService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Compliance Reminder E2E Tenant",
        slug: "e2e-compliance-reminder",
        isActive: true,
      },
    });
    tenantId = tenant.id;
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.sicted.enabled",
        value: "true",
        updatedBy: "e2e-test",
      },
    });
  });

  afterAll(async () => {
    await prisma.sictedComplianceDoc.deleteMany({ where: { tenantId } });
    await prisma.alert.deleteMany({ where: { tenantId } });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  function makeDoc(expiresAt: Date) {
    return prisma.sictedComplianceDoc.create({
      data: { tenantId, label: "Extintores", title: "Doc E2E", expiresAt },
    });
  }

  it("documento vencido genera alerta ERROR y marca expiredAlertedAt; la segunda ejecución no duplica", async () => {
    const doc = await makeDoc(new Date(Date.now() - 24 * 60 * 60 * 1000));

    await reminder.runDailyTick();
    await reminder.runDailyTick(); // idempotente

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: doc.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("ERROR");

    const updated = await prisma.sictedComplianceDoc.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(updated.expiredAlertedAt).not.toBeNull();
  });

  it("documento a 15 días genera alerta WARNING de 'próximo a caducar'", async () => {
    const doc = await makeDoc(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: doc.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("WARNING");
  });

  it("documento a 60 días no genera ninguna alerta todavía", async () => {
    const doc = await makeDoc(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: doc.id },
    });
    expect(alerts).toHaveLength(0);
  });

  it("con el módulo sicted desactivado no genera alertas aunque esté vencido", async () => {
    await prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: "modules.sicted.enabled" } },
      create: {
        tenantId,
        key: "modules.sicted.enabled",
        value: "false",
        updatedBy: "e2e-test",
      },
      update: { value: "false" },
    });
    const doc = await makeDoc(new Date(Date.now() - 24 * 60 * 60 * 1000));

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: doc.id },
    });
    expect(alerts).toHaveLength(0);

    // Deja el módulo activo otra vez para no afectar a otros tests si se reordenan.
    await prisma.configuration.update({
      where: { tenantId_key: { tenantId, key: "modules.sicted.enabled" } },
      data: { value: "true" },
    });
  });
});
