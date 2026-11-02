import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DashboardLayoutController } from "./dashboard-layout.controller";
import { DashboardLayoutService } from "./dashboard-layout.service";

@Module({
  imports: [AuthModule],
  controllers: [DashboardLayoutController],
  providers: [DashboardLayoutService],
})
export class DashboardLayoutModule {}
