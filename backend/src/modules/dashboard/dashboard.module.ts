import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { EtiquetadoModule } from "../etiquetado/etiquetado.module";

@Module({
  imports: [AuthModule, EtiquetadoModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
  exports: [DashboardService],
})
export class DashboardModule {}
