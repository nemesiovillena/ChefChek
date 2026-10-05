import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CuinerController } from "./cuiner.controller";
import { CuinerConnectorController } from "./cuiner-connector.controller";
import { CuinerConfigService } from "./cuiner-config.service";
import { CuinerExportService } from "./cuiner-export.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import { CuinerConnectorGuard } from "./guards/cuiner-connector.guard";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CuinerController, CuinerConnectorController],
  providers: [
    CuinerConfigService,
    CuinerMappingService,
    CuinerExportService,
    CuinerSalesService,
    CuinerConnectorGuard,
  ],
})
export class CuinerModule {}
