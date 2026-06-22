import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AlbaranesService } from "./albaranes.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { CreateAlbaranDto } from "./dto/create-albaran.dto";
import { UpdateAlbaranDto, UpdateAlbaranStatusDto, UpdateAlbaranLineDto, MatchLineDto } from "./dto/update-albaran.dto";
import { AlbaranQueryDto } from "./dto/albaran-query.dto";

@ApiTags("Albaranes")
@ApiBearerAuth()
@Controller("api/v1/albaranes")
@UseGuards(AuthGuard, TenantGuard)
export class AlbaranesController {
  constructor(private readonly albaranesService: AlbaranesService) {}

  @Post()
  @ApiOperation({ summary: "Crear albarán manual" })
  @ApiResponse({ status: 201, description: "Albarán creado" })
  async create(@Body() dto: CreateAlbaranDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.create(dto, tenantId);
  }

  @Post("from-upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FilesInterceptor("file", 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Crear albarán desde upload + OCR" })
  @ApiResponse({ status: 201, description: "Albarán creado desde OCR" })
  async createFromUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!files || files.length === 0) {
      throw new BadRequestException("No files uploaded");
    }

    const albaran = await this.albaranesService.createFromUpload(files, tenantId);

    // Return format compatible with frontend upload hook: { products, albaran }
    return {
      albaran,
      products: (albaran.lines || []).map((line: any) => ({
        name: line.description,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unitPrice,
        total_price: (line.quantity || 0) * (line.unitPrice || 0),
        supplier: (albaran as any).supplier?.name || "IMPORTADO",
        category: "",
        allergens: [],
        confidence: line.confidence || 0.7,
      })),
    };
  }

  @Get()
  @ApiOperation({ summary: "Listar albaranes" })
  @ApiResponse({ status: 200, description: "Lista de albaranes" })
  async findAll(@Query() query: AlbaranQueryDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.findAll(query, tenantId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener albarán por ID" })
  @ApiResponse({ status: 200, description: "Detalle del albarán" })
  async findOne(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.findOne(id, tenantId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Actualizar cabecera del albarán" })
  @ApiResponse({ status: 200, description: "Albarán actualizado" })
  async update(@Param("id") id: string, @Body() dto: UpdateAlbaranDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.update(id, dto, tenantId);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Transicionar estado del albarán" })
  @ApiResponse({ status: 200, description: "Estado actualizado" })
  async updateStatus(@Param("id") id: string, @Body() dto: UpdateAlbaranStatusDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.updateStatus(id, dto.status, tenantId);
  }

  @Put(":id/lines/:lineId")
  @ApiOperation({ summary: "Actualizar línea del albarán" })
  @ApiResponse({ status: 200, description: "Línea actualizada" })
  async updateLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateAlbaranLineDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.updateLine(id, lineId, dto, tenantId);
  }

  @Post(":id/lines/:lineId/match")
  @ApiOperation({ summary: "Asignar producto a una línea" })
  @ApiResponse({ status: 200, description: "Producto asignado" })
  async matchLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: MatchLineDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.matchLine(id, lineId, dto.productId, tenantId);
  }

  @Put(":id/lines/:lineId/confirm")
  @ApiOperation({ summary: "Confirmar línea del albarán" })
  @ApiResponse({ status: 200, description: "Línea confirmada" })
  async confirmLine(@Param("id") id: string, @Param("lineId") lineId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.setLineStatus(id, lineId, "CONFIRMADO", tenantId);
  }

  @Put(":id/lines/:lineId/reject")
  @ApiOperation({ summary: "Rechazar línea del albarán" })
  @ApiResponse({ status: 200, description: "Línea rechazada" })
  async rejectLine(@Param("id") id: string, @Param("lineId") lineId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.setLineStatus(id, lineId, "RECHAZADO", tenantId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar albarán (solo PENDIENTE/REVISADO)" })
  @ApiResponse({ status: 200, description: "Albarán eliminado" })
  async remove(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.remove(id, tenantId);
  }
}
