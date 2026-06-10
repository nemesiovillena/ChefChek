import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { QRService } from "./qr.service";
import { TenantGuard } from "../../guards/tenant.guard";
import {
  GenerateQRCodeDto,
  QRCodeResponseDto,
  RegisterQRScanDto,
  QRScanResponseDto,
  QREntityType,
} from "./dto/qr.dto";

@Controller("api/v1/qr")
@UseGuards(TenantGuard)
export class QRController {
  constructor(private readonly qrService: QRService) {}

  /**
   * Genera un QR code para una entidad
   */
  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  async generateQRCode(
    @Body() dto: GenerateQRCodeDto,
  ): Promise<QRCodeResponseDto> {
    return this.qrService.generateQRCode(dto);
  }

  /**
   * Obtiene un QR code por su ID
   */
  @Get(":qrCodeId")
  async getQRCode(
    @Param("qrCodeId") qrCodeId: string,
  ): Promise<QRCodeResponseDto> {
    return this.qrService.getQRCode(qrCodeId);
  }

  /**
   * Obtiene todos los QR codes de una entidad
   */
  @Get("entity/:entityType/:entityId")
  async getQRCodesByEntity(
    @Param("entityType") entityType: QREntityType,
    @Param("entityId") entityId: string,
  ): Promise<QRCodeResponseDto[]> {
    return this.qrService.getQRCodesByEntity(entityType, entityId);
  }

  /**
   * Registra un escaneo de QR code
   */
  @Post("scan")
  @HttpCode(HttpStatus.OK)
  async registerScan(
    @Body() dto: RegisterQRScanDto,
  ): Promise<QRScanResponseDto> {
    return this.qrService.registerScan(dto);
  }

  /**
   * Regenera un QR code existente
   */
  @Post("regenerate/:qrCodeId")
  @HttpCode(HttpStatus.OK)
  async regenerateQRCode(
    @Param("qrCodeId") qrCodeId: string,
    @Body("config") config?: any,
  ): Promise<QRCodeResponseDto> {
    return this.qrService.regenerateQRCode(qrCodeId, config);
  }

  /**
   * Genera un QR code con logo
   */
  @Post("generate-with-logo")
  @HttpCode(HttpStatus.CREATED)
  async generateQRCodeWithLogo(
    @Body() dto: GenerateQRCodeDto,
  ): Promise<QRCodeResponseDto> {
    return this.qrService.generateQRCodeWithLogo(dto);
  }

  /**
   * Obtiene estadísticas de QR codes
   */
  @Get("stats")
  async getQRStats(
    @Query("entityType") entityType?: QREntityType,
    @Query("entityId") entityId?: string,
  ): Promise<{
    total: number;
    active: number;
    expired: number;
    totalScans: number;
    topScanned: Array<{
      qrCodeId: string;
      scanCount: number;
      entityId: string;
    }>;
  }> {
    return this.qrService.getQRStats(entityType, entityId);
  }

  /**
   * Elimina un QR code
   */
  @Delete(":qrCodeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQRCode(@Param("qrCodeId") qrCodeId: string): Promise<void> {
    await this.qrService.deleteQRCode(qrCodeId);
  }
}
