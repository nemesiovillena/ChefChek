import { Module } from "@nestjs/common";
import { SictedController } from "./sicted.controller";
import { SictedChecklistController } from "./sicted-checklist.controller";
import { SictedMaintenanceController } from "./sicted-maintenance.controller";
import { SictedAuditController } from "./sicted-audit.controller";
import { ChecklistsModule } from "../checklists/checklists.module";
import { AuthModule } from "../auth/auth.module";
import { SictedPlanPdfService } from "./services/sicted-plan-pdf.service";
import { SictedRegistrosPdfService } from "./services/sicted-registros-pdf.service";
import { SictedMantenimientoPdfService } from "./services/sicted-mantenimiento-pdf.service";
import { SictedAuditCsvService } from "./services/sicted-audit-csv.service";
import { SictedCoverageService } from "./services/sicted-coverage.service";

/**
 * Módulo SICTED (Sostenibilidad, Inteligencia y Calidad Turística en el
 * Ecosistema del Destino). Independiente de `appcc`: activación propia vía
 * `@RequireModule("sicted")`, sin tocar el módulo `appcc` existente.
 *
 * El motor de checklist compartido (limpieza, mantenimiento, temperatura,
 * averías) vive en `ChecklistsModule`, importado aquí; este módulo consume
 * ese dominio filtrando siempre por `usedByModules` incluyendo `"sicted"`.
 */
@Module({
  imports: [ChecklistsModule, AuthModule],
  controllers: [
    SictedController,
    SictedChecklistController,
    SictedMaintenanceController,
    SictedAuditController,
  ],
  providers: [
    SictedPlanPdfService,
    SictedRegistrosPdfService,
    SictedMantenimientoPdfService,
    SictedAuditCsvService,
    SictedCoverageService,
  ],
  exports: [],
})
export class SictedModule {}
