import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import { ChecklistRunService } from "./checklist-run.service";

/** Módulos que pueden consumir el motor compartido (ver `usedByModules`). */
const CONSUMER_MODULES: ChecklistConsumerModule[] = ["sicted", "appcc"];

/**
 * Genera las hojas del día y cierra las vencidas, por tenant y por cada
 * módulo consumidor que tenga activo (independiente entre sí — apagar
 * `sicted` no afecta a `appcc` ni viceversa, aunque compartan el motor). Un
 * fallo en un tenant no aborta al resto. Patrón:
 * `compras/services/stale-partial-order-alert.service.ts`.
 */
@Injectable()
export class ChecklistRunSchedulerService {
  private readonly logger = new Logger(ChecklistRunSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runs: ChecklistRunService,
    private readonly modulesService: ModulesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 00:10 hora de servidor. La generación en sí trabaja en Europe/Madrid vía checklist-period.util. */
  @Cron("10 0 * * *")
  async runDailyTick(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const tenant of tenants) {
      for (const module of CONSUMER_MODULES) {
        try {
          const enabled = await this.modulesService.isModuleEnabled(
            tenant.id,
            module,
          );
          if (!enabled) {
            continue;
          }
          await this.runs.ensureRunsForToday(tenant.id, module);
        } catch (error) {
          this.logger.error(
            `Fallo generando hojas ${module} para tenant ${tenant.id}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      try {
        await this.closeElapsedAndAlert(tenant.id);
      } catch (error) {
        this.logger.error(
          `Fallo cerrando hojas vencidas del tenant ${tenant.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private async closeElapsedAndAlert(tenantId: string): Promise<void> {
    const closed = await this.runs.closeElapsedRuns(tenantId);
    for (const run of closed) {
      // Una alerta por hoja vencida — `Alert` no distingue por módulo (sin
      // columna propia), así que una fila por módulo consumidor activo se
      // vería como campanas duplicadas e idénticas para el mismo evento.
      // `closeElapsedRuns` solo devuelve runs que ACABAN de pasar OPEN→
      // INCOMPLETE en este tick, así que no hay riesgo de reinsertar en
      // ticks siguientes (el run ya no vuelve a estar OPEN).
      await this.notifications.createNotification(tenantId, {
        type: "CHECKLIST_RUN_INCOMPLETE",
        severity: "WARNING",
        title: "Hoja sin completar",
        message: `"${run.template.name}" (${run.periodKey}) se cerró sin marcar todos los ítems obligatorios.`,
        entityType: "CHECKLIST_RUN",
        entityId: run.id,
      });
    }
  }
}
