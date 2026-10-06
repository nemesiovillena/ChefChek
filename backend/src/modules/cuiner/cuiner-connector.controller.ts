import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CuinerConfig } from "@prisma/client";
import { CuinerConnectorGuard } from "./guards/cuiner-connector.guard";
import { CuinerConfigService } from "./cuiner-config.service";
import { CuinerExportService } from "./cuiner-export.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import {
  BootstrapCursorDto,
  ExportResultDto,
  UploadCatalogDto,
  UploadSalesDto,
} from "./dto/cuiner.dto";

interface ConnectorRequest {
  tenantId: string;
  cuinerConfig: CuinerConfig;
}

/**
 * API que consume el servicio conector del servidor de Cuiner. Autenticada
 * por token de conector (no por usuario). Si el conector está desactivado en
 * ChefChek solo puede leer su configuración: así se detiene al instante.
 */
@ApiTags("Cuiner (conector)")
@Controller("api/v1/cuiner/connector")
@UseGuards(CuinerConnectorGuard)
export class CuinerConnectorController {
  constructor(
    private readonly configService: CuinerConfigService,
    private readonly mappingService: CuinerMappingService,
    private readonly exportService: CuinerExportService,
    private readonly salesService: CuinerSalesService,
  ) {}

  @Get("config")
  getConfig(@Req() req: ConnectorRequest) {
    const { enabled, mode, empresa, centro, almacen, lastVentasCabId } =
      req.cuinerConfig;
    return { enabled, mode, empresa, centro, almacen, lastVentasCabId };
  }

  @Put("catalog")
  uploadCatalog(@Req() req: ConnectorRequest, @Body() dto: UploadCatalogDto) {
    this.assertEnabled(req);
    return this.mappingService.upsertCatalog(req.tenantId, dto);
  }

  @Post("sales/bootstrap")
  bootstrapSales(
    @Req() req: ConnectorRequest,
    @Body() dto: BootstrapCursorDto,
  ) {
    this.assertEnabled(req);
    return this.configService.bootstrapSalesCursor(
      req.tenantId,
      dto.maxVentasCabId,
    );
  }

  @Post("sales")
  uploadSales(@Req() req: ConnectorRequest, @Body() dto: UploadSalesDto) {
    this.assertEnabled(req);
    return this.salesService.ingest(req.tenantId, dto);
  }

  @Get("albaranes/pending")
  async pendingAlbaranes(@Req() req: ConnectorRequest) {
    this.assertEnabled(req);
    return {
      mode: req.cuinerConfig.mode,
      items: await this.exportService.listPendingForConnector(req.tenantId),
    };
  }

  @Post("albaranes/:exportId/result")
  albaranResult(
    @Req() req: ConnectorRequest,
    @Param("exportId") exportId: string,
    @Body() dto: ExportResultDto,
  ) {
    this.assertEnabled(req);
    if (!dto.simulated && req.cuinerConfig.mode !== "LIVE") {
      throw new ForbiddenException("El conector está en modo simulación");
    }
    return this.exportService.recordResult(req.tenantId, exportId, dto);
  }

  private assertEnabled(req: ConnectorRequest): void {
    if (!req.cuinerConfig.enabled) {
      throw new ForbiddenException("El conector de Cuiner está desactivado");
    }
  }
}
