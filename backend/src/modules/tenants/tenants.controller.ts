import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto, UpdateTenantDto } from "./dto/create-tenant.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { SuperadminGuard } from "../../guards/superadmin.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { AuthUser, AuthenticatedRequest } from "../../types/auth.types";

@ApiTags("Tenants")
@Controller("api/v1/tenants")
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** El propio tenant puede ver/editar su ficha; cualquier otro tenant requiere SUPERADMIN. */
  private assertOwnTenantOrSuperadmin(user: AuthUser, tenantId: string) {
    if (user.role === "SUPERADMIN") {
      return;
    }
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException("No tienes acceso a este tenant.");
    }
  }

  @Post()
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: "Crear un nuevo tenant" })
  @ApiResponse({ status: 201, description: "Tenant creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: "Listar todos los tenants" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Lista de tenants" })
  async findAll(@Query("page") page?: string, @Query("limit") limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.tenantsService.findAll(pageNum, limitNum);
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Obtener un tenant por ID" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant encontrado" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    this.assertOwnTenantOrSuperadmin(req.user as AuthUser, id);
    return this.tenantsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Actualizar un tenant" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant actualizado exitosamente" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async update(
    @Param("id") id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnTenantOrSuperadmin(req.user as AuthUser, id);
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(":id")
  @UseGuards(SuperadminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un tenant" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 204, description: "Tenant eliminado exitosamente" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async remove(@Param("id") id: string) {
    return this.tenantsService.remove(id);
  }
}
