import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CuinerController } from "./cuiner.controller";
import { CuinerConnectorController } from "./cuiner-connector.controller";
import { CuinerBulkLinkService } from "./cuiner-bulk-link.service";
import { CuinerConfigService } from "./cuiner-config.service";
import { CuinerExportService } from "./cuiner-export.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import { CuinerOverviewService } from "./cuiner-overview.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import { CuinerServingMeasuresService } from "./cuiner-serving-measures.service";
import { CuinerStockService } from "./cuiner-stock.service";
import { CuinerConnectorGuard } from "./guards/cuiner-connector.guard";
import { CuinerTenantRequiredGuard } from "./guards/cuiner-tenant-required.guard";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CuinerController, CuinerConnectorController],
  providers: [
    CuinerBulkLinkService,
    CuinerConfigService,
    CuinerMappingService,
    CuinerOverviewService,
    CuinerExportService,
    CuinerSalesService,
    CuinerServingMeasuresService,
    CuinerStockService,
    CuinerConnectorGuard,
    CuinerTenantRequiredGuard,
  ],
})
export class CuinerModule {}
