import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  UseInterceptors,
  Req,
  Logger,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
} from "@nestjs/swagger";
import { TelegramBotService } from "./telegram-bot.service";
import { IngestaService } from "./ingesta.service";
import { PythonOcrService } from "./python-ocr.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { PublicGuard } from "../../guards/public-guard";
import {
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
  AssociateTelegramBotDto,
  AuthorizeTelegramUserDto,
  DocumentStatus,
} from "./dto/ingesta.dto";
import { ManualAlbaranDto } from "./dto/manual-albaran.dto";

@ApiTags("Ingesta")
@Controller("api/v1/ingesta")
export class IngestaController {
  private readonly logger = new Logger(IngestaController.name);

  constructor(
    private readonly ingestaService: IngestaService,
    private readonly telegramBotService: TelegramBotService,
    private readonly pythonOcrService: PythonOcrService,
    private readonly productRecognitionService: ProductRecognitionService,
  ) {}

  @Post("document")
  @ApiOperation({ summary: "Crear nuevo documento para procesamiento" })
  @ApiResponse({
    status: 201,
    description: "Documento creado y encolado para procesamiento",
  })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async createDocument(@Body() dto: CreateDocumentDto) {
    return await this.ingestaService.createDocument(dto);
  }

  @Post("manual")
  @ApiOperation({ summary: "Crear albarán manual con líneas de producto" })
  @ApiResponse({
    status: 201,
    description: "Albarán manual procesado exitosamente",
  })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async createManualAlbaran(@Body() dto: ManualAlbaranDto, @Req() req: any) {
    const tenantId = req.user?.tenantId || dto.tenantId;
    return await this.ingestaService.processManualAlbaran(dto, tenantId);
  }

  @Post("telegram/webhook/:tenantId")
  @UseGuards(PublicGuard)
  @ApiOperation({ summary: "Webhook público para Telegram Bot" })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: "Webhook procesado" })
  async telegramWebhook(
    @Param("tenantId") tenantId: string,
    @Body() webhookData: any,
  ) {
    return await this.telegramBotService.handleWebhook(tenantId, webhookData);
  }

  @Post("telegram/bot")
  @ApiOperation({ summary: "Asociar bot Telegram con tenant" })
  @ApiResponse({ status: 201, description: "Bot asociado exitosamente" })
  async associateBot(@Body() dto: AssociateTelegramBotDto) {
    return await this.telegramBotService.associateBot(dto);
  }

  @Put("telegram/bot/:tenantId")
  @ApiOperation({ summary: "Activar/desactivar bot Telegram" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Estado del bot actualizado" })
  async updateBot(
    @Param("tenantId") tenantId: string,
    @Body() body: { isActive: boolean },
  ) {
    return await this.telegramBotService.updateBot(tenantId, body.isActive);
  }

  @Get("telegram/bots")
  @ApiOperation({ summary: "Listar bots activos" })
  @ApiResponse({ status: 200, description: "Lista de bots activos" })
  async getActiveBots() {
    return await this.telegramBotService.getActiveBots();
  }

  @Post("telegram/authorize")
  @ApiOperation({ summary: "Autorizar usuario de Telegram" })
  @ApiResponse({ status: 201, description: "Usuario autorizado" })
  async authorizeUser(@Body() dto: AuthorizeTelegramUserDto) {
    return await this.telegramBotService.authorizeUser(dto);
  }

  @Get("telegram/users/:tenantId")
  @ApiOperation({ summary: "Listar usuarios autorizados de Telegram" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Lista de usuarios autorizados" })
  async getAuthorizedUsers(@Param("tenantId") tenantId: string) {
    return await this.telegramBotService.getAuthorizedUsers(tenantId);
  }

  @Delete("telegram/users/:userId")
  @ApiOperation({ summary: "Desautorizar usuario de Telegram" })
  @ApiParam({ name: "userId", description: "ID del usuario de Telegram" })
  @ApiResponse({ status: 200, description: "Usuario desautorizado" })
  async revokeUser(@Param("userId") userId: string) {
    return await this.telegramBotService.revokeUser(userId);
  }

  @Get("documents")
  @ApiOperation({ summary: "Listar todos los documentos del tenant" })
  @ApiResponse({ status: 200, description: "Lista de documentos" })
  async findAll(@Query() query: DocumentQueryDto) {
    return await this.ingestaService.findAll(query);
  }

  @Get("documents/:id")
  @ApiOperation({ summary: "Obtener documento por ID" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 200, description: "Documento encontrado" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  async findOne(@Param("id") id: string, @Query("tenantId") tenantId: string) {
    return await this.ingestaService.findOne(id, tenantId);
  }

  @Put("documents/:id/status")
  @ApiOperation({ summary: "Actualizar estado de documento" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 200, description: "Estado actualizado" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentDto,
    @Query("tenantId") tenantId: string,
  ) {
    return await this.ingestaService.updateStatus(id, dto, tenantId);
  }

  @Get("stats")
  @ApiOperation({ summary: "Obtener estadísticas de procesamiento" })
  @ApiResponse({ status: 200, description: "Estadísticas de procesamiento" })
  async getProcessingStats(@Query("tenantId") tenantId: string) {
    return await this.ingestaService.getProcessingStats(tenantId);
  }

  @Post("documents/:id/process")
  @ApiOperation({ summary: "Procesar documento manualmente" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 200, description: "Documento procesado" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  async processDocument(
    @Param("id") id: string,
    @Query("tenantId") tenantId: string,
  ) {
    return await this.ingestaService.processDocument(id);
  }

  @Get("extractions")
  @ApiOperation({ summary: "Historial de extracciones OCR" })
  @ApiResponse({ status: 200, description: "Historial de extracciones" })
  async getExtractionHistory(@Query("tenantId") tenantId: string) {
    return await this.ingestaService.getExtractionHistory(tenantId);
  }

  @Get("products-extracted")
  @ApiOperation({ summary: "Productos extraídos de OCR" })
  @ApiResponse({ status: 200, description: "Productos extraídos" })
  async getExtractedProducts(@Query("tenantId") tenantId: string) {
    return await this.ingestaService.getExtractedProducts(tenantId);
  }

  @Get("cost-updates")
  @ApiOperation({ summary: "Historial de actualizaciones de coste" })
  @ApiResponse({ status: 200, description: "Historial de actualizaciones" })
  async getCostUpdates(@Query("tenantId") tenantId: string) {
    return await this.ingestaService.getCostUpdates(tenantId);
  }

  @Post("process-for-stock")
  @ApiConsumes("multipart/form-data")
  @UseGuards(AuthGuard, TenantGuard)
  @UseInterceptors(
    FilesInterceptor("file", 10, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary:
      "Procesar documento para obtener productos de stock usando Python OCR",
  })
  @ApiResponse({
    status: 200,
    description: "Productos detectados del documento",
  })
  async processForStock(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        "Se requiere contexto de tenant para procesar albaranes",
      );
    }

    this.logger.log(`processForStock called, tenantId: ${tenantId}`);

    const files = req.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new BadRequestException("No se proporcionaron archivos");
    }

    // Validate MIME types
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/pdf",
    ];
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Tipo de archivo no soportado: ${file.mimetype}`,
        );
      }
    }

    this.logger.log(`Processing ${files.length} file(s) with Python OCR`);

    const allProducts: any[] = [];

    for (const file of files) {
      try {
        this.logger.debug(
          `Processing file: ${file.originalname} (${file.mimetype})`,
        );

        const ocrResult = await this.pythonOcrService.processImage(
          file.buffer,
          file.originalname,
          file.mimetype,
        );

        this.logger.debug(
          `OCR result: success=${ocrResult.success}, time=${ocrResult.processingTime}ms`,
        );

        if (ocrResult.success && ocrResult.document) {
          const document = ocrResult.document;
          const extractedProducts = document.products || [];

          this.logger.log(
            `File ${file.originalname}: supplier="${document.supplier_name || "N/A"}", products=${extractedProducts.length}, confidence=${((document.confidence || 0) * 100).toFixed(1)}%`,
          );

          for (const product of extractedProducts) {
            const recognition =
              await this.productRecognitionService.recognizeProduct(
                product.name,
                tenantId,
              );

            allProducts.push({
              ...product,
              confidence: recognition.confidence || product.confidence,
              matchedProductId:
                (recognition.recognizedProduct as any)?.id || null,
              matchedProductName: recognition.recognizedProduct?.name || null,
            });
          }
        }

        if (ocrResult.validation) {
          this.logger.debug(
            `Validation: valid=${ocrResult.validation.is_valid}, action=${ocrResult.validation.recommended_action}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error processing file ${file.originalname}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Total products detected: ${allProducts.length}`);
    return { products: allProducts };
  }
}
