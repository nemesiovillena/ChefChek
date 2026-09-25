import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { NotificationsService } from "../../src/modules/core/notifications.service";
import { WebSocketService } from "../../src/websocket/websocket.service";
import { ModulesService } from "../../src/modules/modules/modules.service";
import { ChecklistMaintenanceReminderService } from "../../src/modules/checklists/services/checklist-maintenance-reminder.service";

/**
 * Fase 4 SICTED — recordatorios de mantenimiento: a 30 días, al vencer,
 * idempotencia, y que un módulo desactivado no genere avisos (mismo criterio
 * que el scheduler de hojas de fase 2). `NotificationsService` real (crea
 * `Alert` en BD) para no simular el efecto que de verdad importa: que la
 * campana aparezca.
 */
describe("E2E - ChecklistMaintenanceReminderService (fase 4)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let reminder: ChecklistMaintenanceReminderService;
  let tenantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        NotificationsService,
        ModulesService,
        ChecklistMaintenanceReminderService,
        {
          provide: WebSocketService,
          useValue: { broadcastNotification: jest.fn() },
        },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    reminder = moduleRef.get(ChecklistMaintenanceReminderService);

    const tenant = await prisma.tenant.create({
      data: {
        name: "Maintenance Reminder E2E Tenant",
        slug: "e2e-maintenance-reminder",
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
    await prisma.checklistMaintenancePlan.deleteMany({ where: { tenantId } });
    await prisma.checklistAsset.deleteMany({ where: { tenantId } });
    await prisma.alert.deleteMany({ where: { tenantId } });
    await prisma.configuration.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await moduleRef.close();
  });

  async function makePlan(overrides: {
    nextDueAt: Date;
    usedByModules?: string[];
  }) {
    const asset = await prisma.checklistAsset.create({
      data: {
        tenantId,
        name: "Equipo E2E",
        category: "OTRO",
        usedByModules: overrides.usedByModules ?? ["sicted"],
      },
    });
    return prisma.checklistMaintenancePlan.create({
      data: {
        tenantId,
        assetId: asset.id,
        title: "Plan E2E",
        periodicityMonths: 12,
        nextDueAt: overrides.nextDueAt,
      },
    });
  }

  it("plan vencido genera una alerta ERROR y marca overdueAlertedAt; la segunda ejecución no duplica", async () => {
    const plan = await makePlan({
      nextDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    await reminder.runDailyTick();
    await reminder.runDailyTick(); // idempotente

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: plan.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("ERROR");

    const updated = await prisma.checklistMaintenancePlan.findUniqueOrThrow({
      where: { id: plan.id },
    });
    expect(updated.overdueAlertedAt).not.toBeNull();
  });

  it("plan a 15 días genera una alerta WARNING de 'próxima'", async () => {
    const plan = await makePlan({
      nextDueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    });

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: plan.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("WARNING");
  });

  it("plan a 60 días no genera ninguna alerta todavía", async () => {
    const plan = await makePlan({
      nextDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: plan.id },
    });
    expect(alerts).toHaveLength(0);
  });

  it("un equipo cuyo único módulo está desactivado no genera alertas aunque esté vencido", async () => {
    // appcc viene activo por defecto (defaultEnabled=true en el registry) — desactivarlo explícitamente para este tenant.
    await prisma.configuration.create({
      data: {
        tenantId,
        key: "modules.appcc.enabled",
        value: "false",
        updatedBy: "e2e-test",
      },
    });
    const plan = await makePlan({
      nextDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      usedByModules: ["appcc"],
    });

    await reminder.runDailyTick();

    const alerts = await prisma.alert.findMany({
      where: { tenantId, entityId: plan.id },
    });
    expect(alerts).toHaveLength(0);
  });
});
