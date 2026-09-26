import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import {
  isDueWithin,
  isOverdue,
} from "../../checklists/util/checklist-maintenance-date.util";

const DUE_SOON_DAYS = 30;

/**
 * Avisos de vencimiento de documentos legales (fase 9, sub-PR 3): a 30 días
 * y al vencer. Mismo patrón que `ChecklistMaintenanceReminderService` (fase
 * 4) — idempotente vía `dueSoonAlertedAt`/`expiredAlertedAt`, reseteados al
 * renovar el documento (`SictedComplianceDocService.update`). A diferencia
 * del motor de checklist compartido, `sicted_compliance_docs` es exclusivo
 * de `sicted` — no hace falta comprobar varios módulos consumidores.
 */
@Injectable()
export class SictedComplianceReminderService {
  private readonly logger = new Logger(SictedComplianceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly modulesService: ModulesService,
  ) {}

  /** 08:00 hora de servidor. */
  @Cron("0 8 * * *")
  async runDailyTick(): Promise<void> {
    const now = new Date();
    const docs = await this.prisma.sictedComplianceDoc.findMany({
      where: { archivedAt: null, expiresAt: { not: null } },
    });

    for (const doc of docs) {
      try {
        if (
          !(await this.modulesService.isModuleEnabled(doc.tenantId, "sicted"))
        ) {
          continue;
        }
        const expiresAt = doc.expiresAt!;

        if (isOverdue(expiresAt, now)) {
          if (!doc.expiredAlertedAt) {
            await this.notifications.createNotification(doc.tenantId, {
              type: "SICTED_COMPLIANCE_DOC_EXPIRED",
              severity: "ERROR",
              title: "Documento legal caducado",
              message: `"${doc.title}" (${doc.label}) caducó el ${expiresAt.toISOString().slice(0, 10)}.`,
              entityType: "SICTED_COMPLIANCE_DOC",
              entityId: doc.id,
            });
            await this.prisma.sictedComplianceDoc.update({
              where: { id: doc.id },
              data: { expiredAlertedAt: now },
            });
          }
          continue;
        }

        if (
          isDueWithin(expiresAt, now, DUE_SOON_DAYS) &&
          !doc.dueSoonAlertedAt
        ) {
          await this.notifications.createNotification(doc.tenantId, {
            type: "SICTED_COMPLIANCE_DOC_DUE_SOON",
            severity: "WARNING",
            title: "Documento legal próximo a caducar",
            message: `"${doc.title}" (${doc.label}) caduca el ${expiresAt.toISOString().slice(0, 10)}.`,
            entityType: "SICTED_COMPLIANCE_DOC",
            entityId: doc.id,
          });
          await this.prisma.sictedComplianceDoc.update({
            where: { id: doc.id },
            data: { dueSoonAlertedAt: now },
          });
        }
      } catch (error) {
        this.logger.error(
          `Fallo avisando del documento legal ${doc.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
