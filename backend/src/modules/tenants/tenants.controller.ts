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
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto, UpdateTenantDto } from "./dto/create-tenant.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Tenants")
@Controller("api/v1/tenants")
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
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Número de página (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Resultados por página (default: 20)",
  })
  @ApiResponse({ status: 200, description: "Lista de tenants" })
  async findAll(@Query("page") page?: string, @Query("limit") limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.tenantsService.findAll(pageNum, limitNum);
  }

  @Get(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Obtener un tenant por ID" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant encontrado" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("ADMIN")
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un tenant" })
  @ApiParam({ name: "id", description: "ID del tenant" })
  @ApiResponse({ status: 204, description: "Tenant eliminado exitosamente" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async remove(@Param("id") id: string) {
    return this.tenantsService.remove(id);
  }
}
