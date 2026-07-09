import { Module, forwardRef } from "@nestjs/common";
import { AlbaranesController } from "./albaranes.controller";
import { AlbaranesService } from "./albaranes.service";
import { AlbaranStatusService } from "./services/albaran-status.service";
import { AlbaranNumberService } from "./services/albaran-number.service";
import { SupplierMatchingService } from "./services/supplier-matching.service";
import { LineMatchingService } from "./services/line-matching.service";
import { AlbaranStockService } from "./services/albaran-stock.service";
import { ManualAlbaranService } from "./services/manual-albaran.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OcrModule } from "../ocr/ocr.module";
import { CoreModule } from "../core/core.module";
import { ProductsModule } from "../products/products.module";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    OcrModule,
    CoreModule,
    ProductsModule,
  ],
  controllers: [AlbaranesController],
  providers: [
    AlbaranesService,
    AlbaranStatusService,
    AlbaranNumberService,
    SupplierMatchingService,
    LineMatchingService,
    AlbaranStockService,
    ManualAlbaranService,
  ],
  exports: [
    AlbaranesService,
    AlbaranNumberService,
    SupplierMatchingService,
    LineMatchingService,
    AlbaranStockService,
  ],
})
export class AlbaranesModule {}
