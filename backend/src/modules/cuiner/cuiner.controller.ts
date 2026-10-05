import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CuinerExportStatus } from "@prisma/client";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import { CuinerConfigService } from "./cuiner-config.service";
import { CuinerExportService } from "./cuiner-export.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import {
  SetDishMapDto,
  SetProductMapDto,
  SetSupplierMapDto,
  UpdateCuinerConfigDto,
} from "./dto/cuiner.dto";

const ADMIN_ROLES = ["ADMIN", "OWNER", "SUPERADMIN"] as const;

/** Lo que AuthGuard y TenantGuard dejan en la petición. */
interface AuthedRequest {
  tenantId: string;
  user: { id: string };
}

/**
 * Gestión de la integración con Cuiner desde ChefChek: configuración del
 * conector, enlaces con los códigos de Cuiner y envío manual de albaranes.
 * Todo restringido a administradores: escribe en el programa de gestión.
 */
@ApiTags("Cuiner")
@Controller("api/v1/cuiner")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("cuiner")
@Roles(...ADMIN_ROLES)
export class CuinerController {
  constructor(
    private readonly configService: CuinerConfigService,
    private readonly mappingService: CuinerMappingService,
    private readonly exportService: CuinerExportService,
    private readonly salesService: CuinerSalesService,
  ) {}

  // ─── Configuración ─────────────────────────────────────────────────────

  @Get("config")
  async getStatus(@Req() req: AuthedRequest) {
    const [config, catalog, sales] = await Promise.all([
      this.configService.getConfig(req.tenantId),
      this.mappingService.getCatalogCounts(req.tenantId),
      this.salesService.countByStatus(req.tenantId),
    ]);
    return { config, catalog, sales };
  }

  @Put("config")
  updateConfig(@Req() req: AuthedRequest, @Body() dto: UpdateCuinerConfigDto) {
    return this.configService.updateConfig(req.tenantId, dto);
  }

  @Post("config/connector-token")
  regenerateToken(@Req() req: AuthedRequest) {
    return this.configService.regenerateConnectorToken(req.tenantId);
  }

  // ─── Enlaces ───────────────────────────────────────────────────────────

  @Get("maps")
  listMaps(@Req() req: AuthedRequest) {
    return this.mappingService.listMaps(req.tenantId);
  }

  @Put("maps/suppliers")
  setSupplierMap(@Req() req: AuthedRequest, @Body() dto: SetSupplierMapDto) {
    return this.mappingService.setSupplierMap(req.tenantId, dto);
  }

  @Delete("maps/suppliers/:supplierId")
  deleteSupplierMap(
    @Req() req: AuthedRequest,
    @Param("supplierId") supplierId: string,
  ) {
    return this.mappingService.deleteSupplierMap(req.tenantId, supplierId);
  }

  @Put("maps/products")
  setProductMap(@Req() req: AuthedRequest, @Body() dto: SetProductMapDto) {
    return this.mappingService.setProductMap(req.tenantId, dto);
  }

  @Delete("maps/products/:productId")
  deleteProductMap(
    @Req() req: AuthedRequest,
    @Param("productId") productId: string,
  ) {
    return this.mappingService.deleteProductMap(req.tenantId, productId);
  }

  @Put("maps/dishes")
  setDishMap(@Req() req: AuthedRequest, @Body() dto: SetDishMapDto) {
    return this.mappingService.setDishMap(req.tenantId, dto);
  }

  @Delete("maps/dishes/:producto")
  deleteDishMap(
    @Req() req: AuthedRequest,
    @Param("producto") producto: string,
  ) {
    return this.mappingService.deleteDishMap(req.tenantId, producto);
  }

  // ─── Envío de albaranes ────────────────────────────────────────────────

  @Get("albaranes/:albaranId/preview")
  preview(@Req() req: AuthedRequest, @Param("albaranId") albaranId: string) {
    return this.exportService.preview(req.tenantId, albaranId);
  }

  @Get("albaranes/:albaranId/export")
  getExport(@Req() req: AuthedRequest, @Param("albaranId") albaranId: string) {
    return this.exportService.getForAlbaran(req.tenantId, albaranId);
  }

  @Post("albaranes/:albaranId/send")
  send(@Req() req: AuthedRequest, @Param("albaranId") albaranId: string) {
    return this.exportService.requestSend(req.tenantId, albaranId, req.user.id);
  }

  @Get("exports")
  listExports(
    @Req() req: AuthedRequest,
    @Query("status") status?: CuinerExportStatus,
  ) {
    const valid = status && status in CuinerExportStatus ? status : undefined;
    return this.exportService.list(req.tenantId, valid);
  }
}
