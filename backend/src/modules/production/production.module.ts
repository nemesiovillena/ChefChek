import { Module } from "@nestjs/common";
import { ProductionController } from "./production.controller";
import { ProductionService } from "./production.service";
import { WorkBatchNumberService } from "./services/work-batch-number.service";
import { ProductionOrderNumberService } from "./services/production-order-number.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CoreModule } from "../core/core.module";

@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [ProductionController],
  providers: [
    ProductionService,
    WorkBatchNumberService,
    ProductionOrderNumberService,
  ],
  exports: [ProductionService],
})
export class ProductionModule {}
