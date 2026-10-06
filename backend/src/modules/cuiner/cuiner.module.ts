import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CuinerController } from "./cuiner.controller";
import { CuinerConnectorController } from "./cuiner-connector.controller";
import { CuinerConfigService } from "./cuiner-config.service";
import { CuinerExportService } from "./cuiner-export.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import { CuinerOverviewService } from "./cuiner-overview.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import { CuinerStockService } from "./cuiner-stock.service";
import { CuinerConnectorGuard } from "./guards/cuiner-connector.guard";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CuinerController, CuinerConnectorController],
  providers: [
    CuinerConfigService,
    CuinerMappingService,
    CuinerOverviewService,
    CuinerExportService,
    CuinerSalesService,
    CuinerStockService,
    CuinerConnectorGuard,
  ],
})
export class CuinerModule {}
