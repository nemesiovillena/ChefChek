import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import {
  isDueWithin,
  isOverdue,
} from "../util/checklist-maintenance-date.util";

const DUE_SOON_DAYS = 30;
/** Módulos que pueden consumir el motor compartido (ver `usedByModules`). */
const CONSUMER_MODULES: ChecklistConsumerModule[] = ["sicted", "appcc"];

/**
 * Avisos de calendario de mantenimiento: a 30 días y al vencer. Idempotente
 * vía `dueSoonAlertedAt`/`overdueAlertedAt` (patrón `staleAlertSentAt` de
 * compras) — se resetean a null en `ChecklistMaintenanceService.createRecord`
 * cuando `nextDueAt` avanza, así un plan puede volver a avisar en su
 * siguiente ciclo. Un fallo en un plan no aborta el resto.
 *
 * Mismo criterio que `ChecklistRunSchedulerService` de fase 2: si el tenant
 * desactivó todos los módulos que usan el equipo del plan, no avisa (el
 * equipo/plan sigue existiendo — "módulo off → inerte" — pero no debe
 * generar campanas de un módulo apagado).
 */
@Injectable()
export class ChecklistMaintenanceReminderService {
  private readonly logger = new Logger(
    ChecklistMaintenanceReminderService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly modulesService: ModulesService,
  ) {}

  /** 08:00 hora de servidor. */
  @Cron("0 8 * * *")
  async runDailyTick(): Promise<void> {
    const now = new Date();
    const plans = await this.prisma.checklistMaintenancePlan.findMany({
      where: { isActive: true },
      include: { asset: { select: { name: true, usedByModules: true } } },
    });

    for (const plan of plans) {
      try {
        if (
          !(await this.anyModuleEnabled(
            plan.tenantId,
            plan.asset.usedByModules,
          ))
        ) {
          continue;
        }
        if (isOverdue(plan.nextDueAt, now)) {
          if (!plan.overdueAlertedAt) {
            await this.notifications.createNotification(plan.tenantId, {
              type: "CHECKLIST_MAINTENANCE_OVERDUE",
              severity: "ERROR",
              title: "Revisión de mantenimiento vencida",
              message: `"${plan.title}" (${plan.asset.name}) lleva vencida desde ${plan.nextDueAt.toISOString().slice(0, 10)}.`,
              entityType: "CHECKLIST_MAINTENANCE_PLAN",
              entityId: plan.id,
            });
            await this.prisma.checklistMaintenancePlan.update({
              where: { id: plan.id },
              data: { overdueAlertedAt: now },
            });
          }
          continue;
        }

        if (
          isDueWithin(plan.nextDueAt, now, DUE_SOON_DAYS) &&
          !plan.dueSoonAlertedAt
        ) {
          await this.notifications.createNotification(plan.tenantId, {
            type: "CHECKLIST_MAINTENANCE_DUE_SOON",
            severity: "WARNING",
            title: "Revisión de mantenimiento próxima",
            message: `"${plan.title}" (${plan.asset.name}) vence el ${plan.nextDueAt.toISOString().slice(0, 10)}.`,
            entityType: "CHECKLIST_MAINTENANCE_PLAN",
            entityId: plan.id,
          });
          await this.prisma.checklistMaintenancePlan.update({
            where: { id: plan.id },
            data: { dueSoonAlertedAt: now },
          });
        }
      } catch (error) {
        this.logger.error(
          `Fallo avisando del plan de mantenimiento ${plan.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private async anyModuleEnabled(
    tenantId: string,
    usedByModules: string[],
  ): Promise<boolean> {
    for (const module of CONSUMER_MODULES) {
      if (!usedByModules.includes(module)) {
        continue;
      }
      if (await this.modulesService.isModuleEnabled(tenantId, module)) {
        return true;
      }
    }
    return false;
  }
}
