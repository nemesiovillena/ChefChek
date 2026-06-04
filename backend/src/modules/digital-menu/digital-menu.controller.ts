import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { DigitalMenuService } from "./digital-menu.service";
import {
  CreateDigitalMenuConfigDto,
  UpdateDigitalMenuConfigDto,
  GenerateQRCodeDto,
  PublicMenuQueryDto,
  RegisterScanDto,
} from "./dto/digital-menu.dto";

@ApiTags("DigitalMenu")
@ApiBearerAuth("JWT-auth")
@Controller("digital-menu")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class DigitalMenuController {
  constructor(private readonly digitalMenuService: DigitalMenuService) {}

  // Configuraciones de Digital Menu (requiere auth)
  @Post("config")
  @ApiOperation({ summary: "Crear configuración de carta digital" })
  @ApiResponse({
    status: 201,
    description: "Configuración creada exitosamente",
  })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async createConfig(@Req() req: any, @Body() dto: CreateDigitalMenuConfigDto) {
    return await this.digitalMenuService.createConfig(req.tenantId, dto);
  }

  @Get("config")
  @ApiOperation({ summary: "Listar todas las cartas digitales" })
  @ApiResponse({ status: 200, description: "Lista de cartas digitales" })
  async getDigitalMenus(@Req() req: any) {
    return await this.digitalMenuService.getDigitalMenus(req.tenantId);
  }

  @Get("config/:id")
  @ApiOperation({ summary: "Obtener carta digital por ID" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({ status: 200, description: "Carta digital encontrada" })
  @ApiResponse({ status: 404, description: "Carta digital no encontrada" })
  async getDigitalMenuById(@Req() req: any, @Param("id") id: string) {
    return await this.digitalMenuService.getDigitalMenuById(id, req.tenantId);
  }

  @Put("config/:id")
  @ApiOperation({ summary: "Actualizar carta digital" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({
    status: 200,
    description: "Carta digital actualizada exitosamente",
  })
  @ApiResponse({ status: 404, description: "Carta digital no encontrada" })
  async updateDigitalMenu(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateDigitalMenuConfigDto,
  ) {
    return await this.digitalMenuService.updateDigitalMenu(
      id,
      req.tenantId,
      dto,
    );
  }

  @Delete("config/:id")
  @ApiOperation({ summary: "Eliminar carta digital" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({
    status: 200,
    description: "Carta digital eliminada exitosamente",
  })
  @ApiResponse({ status: 404, description: "Carta digital no encontrada" })
  async deleteDigitalMenu(@Req() req: any, @Param("id") id: string) {
    return await this.digitalMenuService.deleteDigitalMenu(id, req.tenantId);
  }

  @Post("config/:id/toggle")
  @ApiOperation({ summary: "Activar/desactivar carta digital" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({ status: 200, description: "Estado actualizado exitosamente" })
  async toggleDigitalMenuStatus(@Req() req: any, @Param("id") id: string) {
    return await this.digitalMenuService.toggleDigitalMenuStatus(
      id,
      req.tenantId,
    );
  }

  @Post("config/:id/generate-qr")
  @ApiOperation({ summary: "Generar código QR para carta digital" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({ status: 200, description: "QR generado exitosamente" })
  async generateQRCode(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto?: GenerateQRCodeDto,
  ) {
    return await this.digitalMenuService.generateQRCode(id, req.tenantId, dto);
  }

  // Analytics
  @Get("config/:id/analytics")
  @ApiOperation({ summary: "Obtener analytics de carta digital" })
  @ApiParam({ name: "id", description: "ID de la carta digital" })
  @ApiResponse({ status: 200, description: "Analytics obtenidos exitosamente" })
  async getAnalytics(@Req() req: any, @Param("id") id: string) {
    return await this.digitalMenuService.getAnalytics(id, req.tenantId);
  }

  // Endpoints Públicos (sin auth)
  @Get("public/:configId")
  @ApiOperation({ summary: "Vista pública de carta digital (QR scan)" })
  @ApiParam({ name: "configId", description: "ID de configuración pública" })
  @ApiResponse({
    status: 200,
    description: "Menú público obtenido exitosamente",
  })
  async getPublicMenu(
    @Param("configId") configId: string,
    @Query() query: PublicMenuQueryDto,
  ) {
    return await this.digitalMenuService.getPublicMenu(configId, query);
  }

  @Post("public/:configId/scan")
  @ApiOperation({ summary: "Registrar scan de QR para analytics" })
  @ApiParam({ name: "configId", description: "ID de configuración pública" })
  @ApiResponse({ status: 200, description: "Scan registrado exitosamente" })
  async registerScan(
    @Param("configId") configId: string,
    @Body() dto: RegisterScanDto,
  ) {
    return await this.digitalMenuService.registerScan(configId, dto);
  }
}
