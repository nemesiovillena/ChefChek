import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CuinerModule } from "../cuiner/cuiner.module";
import { CheckInModule } from "../check-in/check-in.module";
import { RecipesModule } from "../recipes/recipes.module";
import { AiAssistantModule } from "../ai-assistant/ai-assistant.module";
import { AiAssistantConfigModule } from "../ai-assistant/config/ai-assistant-config.module";
import { RecipeCaptureConfigModule } from "../recipe-capture/config/recipe-capture-config.module";
import { RecipeCaptureCompletionService } from "../recipe-capture/recipe-capture-completion.service";
import { GestionBalanceImportService } from "./gestion-balance-import.service";
import { GestionProfitabilityService } from "./gestion-profitability.service";
import { GestionProfitabilityReportsService } from "./gestion-profitability-reports.service";
import { GestionController } from "./gestion.controller";
import { GestionDashboardService } from "./gestion-dashboard.service";
import { GestionReportsService } from "./gestion-reports.service";
import { GestionTableExportService } from "./gestion-table-export.service";
import { GestionTicketsService } from "./gestion-tickets.service";
import { GestionSeasonalityService } from "./gestion-seasonality.service";
import { GestionResultsService } from "./gestion-results.service";
import { GestionExpensesService } from "./gestion-expenses.service";
import { GestionTicketReportsService } from "./gestion-ticket-reports.service";
import { GestionMenuEngineeringService } from "./gestion-menu-engineering.service";

/** Gestión: ventas, caja y rentabilidad (lectura de las ventas de Cuiner). */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CuinerModule,
    CheckInModule,
    RecipesModule,
    AiAssistantModule,
    AiAssistantConfigModule,
    RecipeCaptureConfigModule,
  ],
  controllers: [GestionController],
  providers: [
    GestionDashboardService,
    GestionReportsService,
    GestionTicketsService,
    GestionTableExportService,
    GestionProfitabilityService,
    GestionProfitabilityReportsService,
    GestionSeasonalityService,
    GestionResultsService,
    GestionExpensesService,
    GestionTicketReportsService,
    GestionMenuEngineeringService,
    // Lectura del balance del gestor: la misma IA que la Captura de recetas.
    RecipeCaptureCompletionService,
    GestionBalanceImportService,
  ],
})
export class GestionModule {}
