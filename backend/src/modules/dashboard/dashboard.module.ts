import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { EtiquetadoModule } from "../etiquetado/etiquetado.module";
import { RecipesModule } from "../recipes/recipes.module";
import { CostingConfigModule } from "../costing-config/costing-config.module";
import { DashboardInsightsService } from "./dashboard-insights.service";

@Module({
  imports: [AuthModule, EtiquetadoModule, RecipesModule, CostingConfigModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardInsightsService, PrismaService],
  exports: [DashboardService, DashboardInsightsService],
})
export class DashboardModule {}
