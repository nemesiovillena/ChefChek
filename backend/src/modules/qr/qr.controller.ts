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
  Req,
} from "@nestjs/common";
import { QRService } from "./qr.service";
import { TenantGuard } from "../../guards/tenant.guard";
import { AuthGuard } from "../../guards/auth.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  GenerateQRCodeDto,
  QRCodeResponseDto,
  RegisterQRScanDto,
  QRScanResponseDto,
  QREntityType,
} from "./dto/qr.dto";

@Controller("api/v1/qr")
@UseGuards(AuthGuard, TenantGuard, ModuleGuard)
@RequireModule("qr")
export class QRController {
  constructor(private readonly qrService: QRService) {}

  /**
   * Genera un QR code para una entidad
   */
  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  async generateQRCode(
    @Body() dto: GenerateQRCodeDto,
  ): Promise<{ success: true; data: QRCodeResponseDto }> {
    const qrCode = await this.qrService.generateQRCode(dto);
    return { success: true, data: qrCode };
  }

  /**
   * Obtiene todos los QR codes del tenant actual, opcionalmente filtrados por tipo de entidad
   */
  @Get()
  async getQRCodes(
    @Req() req: any,
    @Query("entityType") entityType?: QREntityType,
  ): Promise<{ success: true; data: QRCodeResponseDto[] }> {
    const tenantId = req.tenantId;
    const qrCodes = await this.qrService.getQRCodesByTenant(
      tenantId,
      entityType,
    );
    return { success: true, data: qrCodes };
  }

  /**
   * Obtiene un QR code por su ID
   */
  @Get(":qrCodeId")
  async getQRCode(
    @Param("qrCodeId") qrCodeId: string,
  ): Promise<{ success: true; data: QRCodeResponseDto }> {
    const qrCode = await this.qrService.getQRCode(qrCodeId);
    return { success: true, data: qrCode };
  }

  /**
   * Obtiene todos los QR codes de una entidad
   */
  @Get("entity/:entityType/:entityId")
  async getQRCodesByEntity(
    @Param("entityType") entityType: QREntityType,
    @Param("entityId") entityId: string,
  ): Promise<{ success: true; data: QRCodeResponseDto[] }> {
    const qrCodes = await this.qrService.getQRCodesByEntity(
      entityType,
      entityId,
    );
    return { success: true, data: qrCodes };
  }

  /**
   * Registra un escaneo de QR code
   */
  @Post("scan")
  @HttpCode(HttpStatus.OK)
  async registerScan(
    @Body() dto: RegisterQRScanDto,
  ): Promise<{ success: true; data: QRScanResponseDto }> {
    const scan = await this.qrService.registerScan(dto);
    return { success: true, data: scan };
  }

  /**
   * Regenera un QR code existente
   */
  @Post("regenerate/:qrCodeId")
  @HttpCode(HttpStatus.OK)
  async regenerateQRCode(
    @Param("qrCodeId") qrCodeId: string,
    @Body("config") config?: any,
  ): Promise<{ success: true; data: QRCodeResponseDto }> {
    const qrCode = await this.qrService.regenerateQRCode(qrCodeId, config);
    return { success: true, data: qrCode };
  }

  /**
   * Genera un QR code con logo
   */
  @Post("generate-with-logo")
  @HttpCode(HttpStatus.CREATED)
  async generateQRCodeWithLogo(
    @Body() dto: GenerateQRCodeDto,
  ): Promise<{ success: true; data: QRCodeResponseDto }> {
    const qrCode = await this.qrService.generateQRCodeWithLogo(dto);
    return { success: true, data: qrCode };
  }

  /**
   * Obtiene estadísticas de QR codes
   */
  @Get("stats")
  async getQRStats(
    @Query("entityType") entityType?: QREntityType,
    @Query("entityId") entityId?: string,
  ): Promise<{
    success: true;
    data: {
      total: number;
      active: number;
      expired: number;
      totalScans: number;
      topScanned: Array<{
        qrCodeId: string;
        scanCount: number;
        entityId: string;
      }>;
    };
  }> {
    const stats = await this.qrService.getQRStats(entityType, entityId);
    return { success: true, data: stats };
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
