import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { MenusService } from "./menus.service";
import { CreateMenuDto } from "./dto/create-menu.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Menus")
@Controller("api/v1/menus")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("menus")
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear un nuevo menú/carta" })
  @ApiResponse({ status: 201, description: "Menú creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  async create(@Req() req: any, @Body() createMenuDto: CreateMenuDto) {
    const tenantId = req.tenantId;
    const menu = await this.menusService.create(tenantId, createMenuDto);
    return {
      success: true,
      data: menu,
      message: "Menu created successfully",
    };
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todos los menús/cartas del tenant" })
  @ApiResponse({ status: 200, description: "Lista de menús" })
  async findAll(
    @Req() req: any,
    @Query() query: { search?: string; isActive?: boolean },
  ) {
    const tenantId = req.tenantId;
    const menus = await this.menusService.findAll(tenantId, query);
    return {
      success: true,
      data: menus,
      message: "Menus retrieved successfully",
    };
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener un menú por ID" })
  @ApiParam({ name: "id", description: "ID del menú" })
  @ApiResponse({ status: 200, description: "Menú encontrado" })
  @ApiResponse({ status: 404, description: "Menú no encontrado" })
  async findOne(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const menu = await this.menusService.findOne(tenantId, id);
    return {
      success: true,
      data: menu,
      message: "Menu retrieved successfully",
    };
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar un menú" })
  @ApiParam({ name: "id", description: "ID del menú" })
  @ApiResponse({ status: 200, description: "Menú actualizado exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Menú no encontrado" })
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() updateMenuDto: Partial<CreateMenuDto>,
  ) {
    const tenantId = req.tenantId;
    const menu = await this.menusService.update(tenantId, id, updateMenuDto);
    return {
      success: true,
      data: menu,
      message: "Menu updated successfully",
    };
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar un menú (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del menú" })
  @ApiResponse({ status: 200, description: "Menú eliminado exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado (solo ADMIN)" })
  @ApiResponse({ status: 404, description: "Menú no encontrado" })
  async remove(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    await this.menusService.remove(tenantId, id);
    return {
      success: true,
      message: "Menu deleted successfully",
    };
  }

  @Get(":id/calculate")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary: "Calcular costo total del menú con todas las recetas",
  })
  @ApiParam({ name: "id", description: "ID del menú" })
  @ApiResponse({
    status: 200,
    description: "Costo calculado exitosamente con breakdown por secciones",
  })
  @ApiResponse({ status: 404, description: "Menú no encontrado" })
  async calculateCost(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const costBreakdown = await this.menusService.calculateMenuCost(
      tenantId,
      id,
    );
    return {
      success: true,
      data: costBreakdown,
      message: "Menu cost calculated successfully",
    };
  }

  @Get(":id/qr-code")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Generar código QR del menú" })
  @ApiParam({ name: "id", description: "ID del menú" })
  @ApiResponse({ status: 200, description: "QR code generado exitosamente" })
  @ApiResponse({ status: 404, description: "Menú no encontrado" })
  async generateQRCode(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const qrData = await this.menusService.generateQRCode(tenantId, id);
    return {
      success: true,
      data: qrData,
      message: "QR code generated successfully",
    };
  }
}
