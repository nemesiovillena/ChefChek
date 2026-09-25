import { Module } from "@nestjs/common";
import { ChecklistTemplateService } from "./services/checklist-template.service";
import { ChecklistRunService } from "./services/checklist-run.service";
import { ChecklistRunSchedulerService } from "./services/checklist-run-scheduler.service";
import { ChecklistAssetService } from "./services/checklist-asset.service";
import { ChecklistMaintenanceService } from "./services/checklist-maintenance.service";
import { ChecklistIncidentService } from "./services/checklist-incident.service";
import { ChecklistMaintenanceReminderService } from "./services/checklist-maintenance-reminder.service";

/**
 * Motor de checklist compartido entre `sicted` y (en un futuro plan) `appcc`.
 *
 * Aloja el dominio de plantillas/hojas/marcas (fase 2) y de activos/
 * mantenimiento/incidencias (fase 4). No tiene controlador propio: cada
 * módulo consumidor expone sus propias rutas con su propio `@RequireModule`,
 * filtrando siempre por `usedByModules` en los servicios de este módulo.
 *
 * Reglas del contrato compartido:
 * - La evidencia (`Checklist*`) es append-only: las filas se insertan, nunca
 *   se editan ni se borran (trigger `forbid_mutation`/`forbid_mutation_after_seal`,
 *   ver migración `immutability_guard`). No añadir estas tablas a la extensión
 *   de soft-delete de Prisma (`common/services/prisma.service.ts`) ni al
 *   módulo de Papelera.
 * - Un nuevo consumidor (p. ej. un futuro `AppccModule` reconstruido) añade su
 *   propio controlador que importa este módulo y filtra por su nombre en
 *   `usedByModules`, sin tocar el dominio de aquí.
 */
@Module({
  imports: [],
  providers: [
    ChecklistTemplateService,
    ChecklistRunService,
    ChecklistRunSchedulerService,
    ChecklistAssetService,
    ChecklistMaintenanceService,
    ChecklistIncidentService,
    ChecklistMaintenanceReminderService,
  ],
  exports: [
    ChecklistTemplateService,
    ChecklistRunService,
    ChecklistAssetService,
    ChecklistMaintenanceService,
    ChecklistIncidentService,
  ],
})
export class ChecklistsModule {}
