import { Module, forwardRef } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";
import { PexelsImageSearchService } from "./pexels-image-search.service";
import { ProductImageBackfillService } from "./product-image-backfill.service";
import { ProductsController } from "./products.controller";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
// Reutilizada de AlbaranesModule (misma consulta de trazabilidad de lotes),
// sin importar el módulo entero: AlbaranesModule ya importa ProductsModule
// (vía ComprasModule) y eso crearía un ciclo. Mismo patrón que
// LineMatchingService en ComprasModule.
import { LotService } from "../albaranes/services/lot.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductSupplierOffersService,
    PexelsImageSearchService,
    ProductImageBackfillService,
    LotService,
  ],
  exports: [
    ProductsService,
    ProductSupplierOffersService,
    PexelsImageSearchService,
    ProductImageBackfillService,
  ],
})
export class ProductsModule {}
