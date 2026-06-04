import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SalaService } from "./sala.service";
import {
  FeedbackDto,
  QrScanDto,
  InteractionDto,
  IncidentDto,
  SalaStatsDto,
} from "./dto/sala.dto";

@ApiTags("Sala")
@ApiBearerAuth("JWT-auth")
@Controller("api/v1/sala")
export class SalaController {
  constructor(private readonly salaService: SalaService) {}

  @Post("qr/validate")
  @ApiOperation({ summary: "Validar código QR de carta digital" })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: "QR validado exitosamente" })
  @ApiResponse({ status: 404, description: "QR no encontrado o expirado" })
  async validateQrCode(@Body() dto: QrScanDto) {
    return await this.salaService.validateQrCode(dto);
  }

  @Post("feedback")
  @ApiOperation({ summary: "Enviar feedback de cliente" })
  @ApiResponse({ status: 201, description: "Feedback enviado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async submitFeedback(@Body() dto: FeedbackDto) {
    return await this.salaService.submitFeedback(dto);
  }

  @Post("interaction")
  @ApiOperation({ summary: "Registrar interacción en carta digital" })
  @ApiResponse({ status: 201, description: "Interacción registrada" })
  async trackInteraction(@Body() dto: InteractionDto) {
    return await this.salaService.trackInteraction(dto);
  }

  @Post("incident")
  @ApiOperation({ summary: "Reportar incidente en sala" })
  @ApiResponse({ status: 201, description: "Incidente reportado" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async reportIncident(@Body() dto: IncidentDto) {
    return await this.salaService.reportIncident(dto);
  }

  @Get("stats")
  @ApiOperation({ summary: "Obtener estadísticas de sala" })
  @ApiQuery({ name: "tenantId", description: "ID del tenant" })
  @ApiQuery({ name: "digitalMenuId", description: "ID de la carta digital" })
  @ApiQuery({ name: "startDate", required: false, description: "Fecha inicio" })
  @ApiQuery({ name: "endDate", required: false, description: "Fecha fin" })
  @ApiResponse({ status: 200, description: "Estadísticas de sala" })
  async getSalaStats(
    @Query("tenantId") tenantId: string,
    @Query() dto: SalaStatsDto,
  ) {
    return await this.salaService.getSalaStats(tenantId, dto);
  }

  @Get("feedback")
  @ApiOperation({ summary: "Obtener todo el feedback" })
  @ApiQuery({ name: "tenantId", description: "ID del tenant" })
  @ApiQuery({
    name: "digitalMenuId",
    required: false,
    description: "Filtrar por carta digital",
  })
  @ApiResponse({ status: 200, description: "Lista de feedback" })
  async getAllFeedback(
    @Query("tenantId") tenantId: string,
    @Query("digitalMenuId") digitalMenuId?: string,
  ) {
    return await this.salaService.getAllFeedback(tenantId, digitalMenuId);
  }

  @Get("incidents")
  @ApiOperation({ summary: "Obtener incidentes reportados" })
  @ApiQuery({ name: "tenantId", description: "ID del tenant" })
  @ApiQuery({
    name: "severity",
    required: false,
    description: "Filtrar por severidad",
  })
  @ApiResponse({ status: 200, description: "Lista de incidentes" })
  async getIncidents(
    @Query("tenantId") tenantId: string,
    @Query("severity") severity?: string,
  ) {
    return await this.salaService.getIncidents(tenantId, severity);
  }
}
