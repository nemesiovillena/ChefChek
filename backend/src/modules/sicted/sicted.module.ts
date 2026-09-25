import { Module } from "@nestjs/common";
import { SictedController } from "./sicted.controller";
import { SictedChecklistController } from "./sicted-checklist.controller";
import { SictedMaintenanceController } from "./sicted-maintenance.controller";
import { SictedAuditController } from "./sicted-audit.controller";
import { SictedSuppliersController } from "./sicted-suppliers.controller";
import { SictedPersonasController } from "./sicted-personas.controller";
import { SictedClientesController } from "./sicted-clientes.controller";
import { ChecklistsModule } from "../checklists/checklists.module";
import { AuthModule } from "../auth/auth.module";
import { SictedPlanPdfService } from "./services/sicted-plan-pdf.service";
import { SictedRegistrosPdfService } from "./services/sicted-registros-pdf.service";
import { SictedMantenimientoPdfService } from "./services/sicted-mantenimiento-pdf.service";
import { SictedAuditCsvService } from "./services/sicted-audit-csv.service";
import { SictedCoverageService } from "./services/sicted-coverage.service";
import { SictedSupplierComplianceService } from "./services/sicted-supplier-compliance.service";
import { SictedSupplierIncidentService } from "./services/sicted-supplier-incident.service";
import { SictedInventorySnapshotService } from "./services/sicted-inventory-snapshot.service";
import { SictedProcurementEvidenceService } from "./services/sicted-procurement-evidence.service";
import { SictedJobProfileService } from "./services/sicted-job-profile.service";
import { SictedTrainingService } from "./services/sicted-training.service";
import { SictedProtocolService } from "./services/sicted-protocol.service";
import { SictedFeedbackService } from "./services/sicted-feedback.service";
import { SictedSatisfactionService } from "./services/sicted-satisfaction.service";
import { SictedLostItemService } from "./services/sicted-lost-item.service";

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
    SictedSuppliersController,
    SictedPersonasController,
    SictedClientesController,
  ],
  providers: [
    SictedPlanPdfService,
    SictedRegistrosPdfService,
    SictedMantenimientoPdfService,
    SictedAuditCsvService,
    SictedCoverageService,
    SictedSupplierComplianceService,
    SictedSupplierIncidentService,
    SictedInventorySnapshotService,
    SictedProcurementEvidenceService,
    SictedJobProfileService,
    SictedTrainingService,
    SictedProtocolService,
    SictedFeedbackService,
    SictedSatisfactionService,
    SictedLostItemService,
  ],
  exports: [],
})
export class SictedModule {}
