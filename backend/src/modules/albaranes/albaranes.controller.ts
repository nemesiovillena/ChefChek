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
import { ManualAlbaranService } from "./services/manual-albaran.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import {
  CreateAlbaranDto,
  CreateAlbaranLineDto,
} from "./dto/create-albaran.dto";
import { ManualAlbaranDto } from "./dto/manual-albaran.dto";
import {
  UpdateAlbaranDto,
  UpdateAlbaranStatusDto,
  UpdateAlbaranLineDto,
  MatchLineDto,
  CorrectAlbaranLinePriceDto,
} from "./dto/update-albaran.dto";
import { AlbaranQueryDto } from "./dto/albaran-query.dto";

@ApiTags("Albaranes")
@ApiBearerAuth()
@Controller("api/v1/albaranes")
@UseGuards(AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("albaranes")
@RequireSection("albaranes")
export class AlbaranesController {
  constructor(
    private readonly albaranesService: AlbaranesService,
    private readonly manualAlbaranService: ManualAlbaranService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Crear albarán manual" })
  @ApiResponse({ status: 201, description: "Albarán creado" })
  async create(@Body() dto: CreateAlbaranDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.create(dto, tenantId);
  }

  @Post("manual")
  @ApiOperation({ summary: "Alta manual de albarán con productos y stock" })
  @ApiResponse({ status: 201, description: "Albarán manual procesado" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async createManual(@Body() dto: ManualAlbaranDto, @Req() req: any) {
    const tenantId = req.user?.tenantId || dto.tenantId;
    return this.manualAlbaranService.process(dto, tenantId, req.user?.id);
  }

  @Post("from-upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FilesInterceptor("file", 10, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
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

    // Extraer modelo IA, API key y pedido de origen del body (campos opcionales del FormData)
    const aiModel = req.body?.ai_model || undefined;
    const aiApiKey = req.body?.ai_api_key || undefined;
    const purchaseOrderId = req.body?.purchase_order_id || undefined;

    const albaran = await this.albaranesService.createFromUpload(
      files,
      tenantId,
      aiModel,
      aiApiKey,
      purchaseOrderId,
    );

    // Return format compatible with frontend upload hook: { products, albaran }
    return {
      albaran,
      products: (albaran.lines || []).map((line: any) => ({
        name: line.description,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unitPrice,
        // Neto del papel si el OCR lo trajo; si no, se recalcula del bruto.
        total_price:
          line.totalPrice ?? (line.quantity || 0) * (line.unitPrice || 0),
        supplier: (albaran as any).supplier?.name || "IMPORTADO",
        category: "",
        allergens: [],
        confidence: line.confidence ?? 0,
        matchStatus: line.matchStatus,
        matchedProductId: line.matchedProductId,
        suggestedProductId: line.suggestedProductId,
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

  // Debe ir ANTES de @Get(":id") para que NestJS no lo capture como id.
  // Advisory-only: devuelve el albarán existente del mismo proveedor con el
  // mismo número, si lo hay. No bloquea el alta (ni manual ni OCR).
  @Get("check-duplicate")
  @ApiOperation({
    summary: "Comprobar si el número de albarán ya existe para el proveedor",
  })
  @ApiResponse({
    status: 200,
    description: "Albarán existente con ese número, o null",
  })
  async checkDuplicate(
    @Query("supplierId") supplierId: string | undefined,
    @Query("albaranNumber") albaranNumber: string | undefined,
    @Query("excludeId") excludeId: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    const match = await this.albaranesService.checkDuplicate(
      tenantId,
      supplierId,
      albaranNumber,
      excludeId,
    );
    return { success: true, data: match };
  }

  @Post(":id/lines")
  @ApiOperation({ summary: "Añadir línea manual al albarán" })
  @ApiResponse({ status: 201, description: "Línea añadida" })
  async addLine(
    @Param("id") id: string,
    @Body() dto: CreateAlbaranLineDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.addLine(id, dto, tenantId);
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
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateAlbaranDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.update(id, dto, tenantId);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Transicionar estado del albarán" })
  @ApiResponse({ status: 200, description: "Estado actualizado" })
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAlbaranStatusDto,
    @Req() req: any,
  ) {
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

  @Put(":id/lines/:lineId/correct-price")
  @ApiOperation({
    summary:
      "Corregir el precio de una línea confirmada y re-sincronizar costes",
  })
  @ApiResponse({
    status: 200,
    description:
      "Precio corregido; oferta, coste, histórico y pedido actualizados",
  })
  async correctLinePrice(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: CorrectAlbaranLinePriceDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.correctConfirmedLinePrice(
      id,
      lineId,
      dto,
      tenantId,
    );
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
    return this.albaranesService.matchLine(
      id,
      lineId,
      dto.productId,
      tenantId,
      req.user?.id,
    );
  }

  @Put(":id/lines/:lineId/confirm")
  @ApiOperation({ summary: "Confirmar línea del albarán" })
  @ApiResponse({ status: 200, description: "Línea confirmada" })
  async confirmLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.setLineStatus(
      id,
      lineId,
      "CONFIRMADO",
      tenantId,
    );
  }

  @Put(":id/lines/:lineId/dismiss-suggestion")
  @ApiOperation({ summary: "Descartar la sugerencia automática de una línea" })
  @ApiResponse({ status: 200, description: "Sugerencia descartada" })
  async dismissSuggestion(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.dismissSuggestion(id, lineId, tenantId);
  }

  @Put(":id/lines/:lineId/reject")
  @ApiOperation({ summary: "Rechazar línea del albarán" })
  @ApiResponse({ status: 200, description: "Línea rechazada" })
  async rejectLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.setLineStatus(
      id,
      lineId,
      "RECHAZADO",
      tenantId,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar albarán (solo PENDIENTE/REVISADO)" })
  @ApiResponse({ status: 200, description: "Albarán eliminado" })
  async remove(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.albaranesService.remove(id, tenantId);
  }
}
