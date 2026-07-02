import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
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

@ApiTags("Tenants")
@Controller("api/v1/tenants")
@UseGuards(AuthGuard, SuperadminGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: "Crear un nuevo tenant" })
  @ApiResponse({ status: 201, description: "Tenant creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
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
  @ApiOperation({ summary: "Obtener un tenant por ID" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant encontrado" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar un tenant" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant actualizado exitosamente" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async update(
    @Param("id") id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un tenant" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 204, description: "Tenant eliminado exitosamente" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async remove(@Param("id") id: string) {
    return this.tenantsService.remove(id);
  }
}
