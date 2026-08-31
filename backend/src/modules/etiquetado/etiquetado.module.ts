import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CoreModule } from "../core/core.module";
import { EtiquetadoController } from "./etiquetado.controller";
import { EtiquetadoPublicController } from "./etiquetado-public.controller";
import { FoodLabelService } from "./services/food-label.service";
import { FoodLabelContextService } from "./services/food-label-context.service";
import { FoodLabelPdfService } from "./services/food-label-pdf.service";
import { LotNumberService } from "./services/lot-number.service";
import { EtiquetadoConfigService } from "./services/etiquetado-config.service";

@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [EtiquetadoController, EtiquetadoPublicController],
  providers: [
    FoodLabelService,
    FoodLabelContextService,
    FoodLabelPdfService,
    LotNumberService,
    EtiquetadoConfigService,
  ],
  exports: [FoodLabelService],
})
export class EtiquetadoModule {}
