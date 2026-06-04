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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { TelegramBotService } from "./telegram-bot.service";
import { IngestaService } from "./ingesta.service";
import { PublicGuard } from "../../guards/public-guard";
import {
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
  AssociateTelegramBotDto,
  AuthorizeTelegramUserDto,
  DocumentStatus,
} from "./dto/ingesta.dto";

@ApiTags("Ingesta")
@Controller("api/v1/ingesta")
export class IngestaController {
  constructor(
    private readonly ingestaService: IngestaService,
    private readonly telegramBotService: TelegramBotService,
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
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Asociar bot Telegram con tenant" })
  @ApiResponse({ status: 201, description: "Bot asociado exitosamente" })
  async associateBot(@Body() dto: AssociateTelegramBotDto) {
    return await this.telegramBotService.associateBot(dto);
  }

  @Put("telegram/bot/:tenantId")
  @ApiBearerAuth("JWT-auth")
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
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Listar bots activos" })
  @ApiResponse({ status: 200, description: "Lista de bots activos" })
  async getActiveBots() {
    return await this.telegramBotService.getActiveBots();
  }

  @Post("telegram/authorize")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Autorizar usuario de Telegram" })
  @ApiResponse({ status: 201, description: "Usuario autorizado" })
  async authorizeUser(@Body() dto: AuthorizeTelegramUserDto) {
    return await this.telegramBotService.authorizeUser(dto);
  }

  @Get("telegram/users/:tenantId")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Listar usuarios autorizados de Telegram" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Lista de usuarios autorizados" })
  async getAuthorizedUsers(@Param("tenantId") tenantId: string) {
    return await this.telegramBotService.getAuthorizedUsers(tenantId);
  }

  @Delete("telegram/users/:userId")
  @ApiBearerAuth("JWT-auth")
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
}
