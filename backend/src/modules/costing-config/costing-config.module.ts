import { Module } from "@nestjs/common";
import { CostingConfigController } from "./costing-config.controller";
import { CostingConfigService } from "./costing-config.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CostingConfigController],
  providers: [CostingConfigService],
  exports: [CostingConfigService],
})
export class CostingConfigModule {}
