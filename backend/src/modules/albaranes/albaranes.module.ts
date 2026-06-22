import { Module, forwardRef } from "@nestjs/common";
import { AlbaranesController } from "./albaranes.controller";
import { AlbaranesService } from "./albaranes.service";
import { AlbaranStatusService } from "./services/albaran-status.service";
import { AlbaranNumberService } from "./services/albaran-number.service";
import { SupplierMatchingService } from "./services/supplier-matching.service";
import { LineMatchingService } from "./services/line-matching.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { IngestaModule } from "../ingesta/ingesta.module";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => IngestaModule),
  ],
  controllers: [AlbaranesController],
  providers: [
    AlbaranesService,
    AlbaranStatusService,
    AlbaranNumberService,
    SupplierMatchingService,
    LineMatchingService,
  ],
  exports: [AlbaranesService, SupplierMatchingService, LineMatchingService],
})
export class AlbaranesModule {}
