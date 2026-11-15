import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CuinerModule } from "../cuiner/cuiner.module";
import { CheckInModule } from "../check-in/check-in.module";
import { GestionProfitabilityService } from "./gestion-profitability.service";
import { GestionProfitabilityReportsService } from "./gestion-profitability-reports.service";
import { GestionController } from "./gestion.controller";
import { GestionDashboardService } from "./gestion-dashboard.service";
import { GestionReportsService } from "./gestion-reports.service";
import { GestionTableExportService } from "./gestion-table-export.service";
import { GestionTicketsService } from "./gestion-tickets.service";
import { GestionSeasonalityService } from "./gestion-seasonality.service";

/** Gestión: ventas, caja y rentabilidad (lectura de las ventas de Cuiner). */
@Module({
  imports: [PrismaModule, AuthModule, CuinerModule, CheckInModule],
  controllers: [GestionController],
  providers: [
    GestionDashboardService,
    GestionReportsService,
    GestionTicketsService,
    GestionTableExportService,
    GestionProfitabilityService,
    GestionProfitabilityReportsService,
    GestionSeasonalityService,
  ],
})
export class GestionModule {}
