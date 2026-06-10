import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import {
  GenerateQRCodeDto,
  QRCodeResponseDto,
  QRCodeConfigDto,
  QRCodeType,
  QRCodeFormat,
  QRCodeErrorCorrection,
  QREntityType,
  RegisterQRScanDto,
  QRScanResponseDto,
} from "./dto/qr.dto";

@Injectable()
export class QRService {
  private readonly logger = new Logger(QRService.name);
  private readonly qrCache = new Map<
    string,
    { data: string; expiresAt: number }
  >();
  private readonly CACHE_DURATION_MS = 3600000; // 1 hora

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera QR code genérico para cualquier entidad
   */
  async generateQRCode(dto: GenerateQRCodeDto): Promise<QRCodeResponseDto> {
    try {
      this.logger.log(
        `Generating QR code for ${dto.entityType}:${dto.entityId}`,
      );

      // Configuración por defecto
      const config: QRCodeConfigDto = {
        qrType: QRCodeType.STATIC,
        format: QRCodeFormat.PNG,
        errorCorrection: QRCodeErrorCorrection.M,
        size: 300,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        margin: 2,
        includeLogo: false,
        ...dto.config,
      };

      // Validar configuración
      this.validateConfig(config);

      // Verificar que la entidad existe
      await this.validateEntityExists(dto.entityType, dto.entityId);

      // Generar URL pública
      const publicUrl = this.generatePublicUrl(dto.entityType, dto.entityId);

      // Generar QR code
      const qrCodeData = await this.generateQRImage(publicUrl, config);

      // Generar ID único para el QR code
      const qrCodeId = this.generateQRCodeId(dto.entityType, dto.entityId);

      // Guardar QR code en base de datos
      const qrCode = await this.prisma.qRCode.create({
        data: {
          qrCodeId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          qrCodeData: qrCodeData,
          config: config as any,
          format: config.format,
          size: config.size,
          publicUrl,
          scanCount: 0,
          expiresAt: this.calculateExpirationDate(config.qrType),
          tenantId: dto.data?.tenantId || "default",
        },
      });

      this.logger.log(`QR code generated successfully: ${qrCode.qrCodeId}`);

      return this.mapToResponseDto(qrCode, config);
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`);
      throw new BadRequestException(
        `QR code generation failed: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene QR code por ID
   */
  async getQRCode(qrCodeId: string): Promise<QRCodeResponseDto> {
    const qrCode = await this.prisma.qRCode.findUnique({
      where: { qrCodeId },
    });

    if (!qrCode) {
      throw new NotFoundException("QR code not found");
    }

    // Verificar si está expirado
    if (qrCode.expiresAt && new Date() > qrCode.expiresAt) {
      throw new NotFoundException("QR code has expired");
    }

    return this.mapToResponseDto(qrCode, qrCode.config as QRCodeConfigDto);
  }

  /**
   * Registra escaneo de QR code
   */
  async registerScan(dto: RegisterQRScanDto): Promise<QRScanResponseDto> {
    const qrCode = await this.prisma.qRCode.findUnique({
      where: { qrCodeId: dto.qrCodeId },
    });

    if (!qrCode) {
      throw new NotFoundException("QR code not found");
    }

    // Verificar si está expirado
    if (qrCode.expiresAt && new Date() > qrCode.expiresAt) {
      throw new NotFoundException("QR code has expired");
    }

    // Actualizar contador de escaneos
    const updated = await this.prisma.qRCode.update({
      where: { qrCodeId: dto.qrCodeId },
      data: {
        scanCount: qrCode.scanCount + 1,
        lastScannedAt: new Date(),
        lastDeviceId: dto.deviceId,
        lastUserAgent: dto.userAgent,
      },
    });

    this.logger.log(
      `QR code scanned: ${dto.qrCodeId} (scan count: ${updated.scanCount})`,
    );

    // Obtener datos de la entidad
    const entityData = await this.getEntityData(
      updated.entityType as any,
      updated.entityId,
    );

    return {
      qrCodeId: updated.qrCodeId,
      entityType: updated.entityType as any,
      entityId: updated.entityId,
      publicUrl: updated.publicUrl,
      scanCount: updated.scanCount,
      lastScannedAt: updated.lastScannedAt?.toISOString() || "",
      format: updated.format as any,
      size: updated.size,
      entityData,
    } as QRScanResponseDto;
  }

  /**
   * Obtiene QR codes por entidad
   */
  async getQRCodesByEntity(
    entityType: QREntityType,
    entityId: string,
  ): Promise<QRCodeResponseDto[]> {
    const qrCodes = await this.prisma.qRCode.findMany({
      where: {
        entityType,
        entityId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return qrCodes.map((qr) =>
      this.mapToResponseDto(qr, qr.config as QRCodeConfigDto),
    );
  }

  /**
   * Elimina QR code
   */
  async deleteQRCode(qrCodeId: string): Promise<void> {
    const qrCode = await this.prisma.qRCode.findUnique({
      where: { qrCodeId },
    });

    if (!qrCode) {
      throw new NotFoundException("QR code not found");
    }

    // Eliminar archivo físico
    const filePath = path.join(process.cwd(), qrCode.publicFilePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Eliminar de base de datos
    await this.prisma.qRCode.delete({
      where: { qrCodeId },
    });

    this.logger.log(`QR code deleted: ${qrCodeId}`);
  }

  /**
   * Regenera QR code existente
   */
  async regenerateQRCode(
    qrCodeId: string,
    config?: QRCodeConfigDto,
  ): Promise<QRCodeResponseDto> {
    const existingQR = await this.prisma.qRCode.findUnique({
      where: { qrCodeId },
    });

    if (!existingQR) {
      throw new NotFoundException("QR code not found");
    }

    // Eliminar archivo viejo
    const oldFilePath = path.join(process.cwd(), existingQR.publicFilePath);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Generar nuevo QR code
    const publicUrl = this.generatePublicUrl(
      existingQR.entityType as QREntityType,
      existingQR.entityId,
    );

    const existingConfig = (existingQR.config as any) || {};
    const newConfig = { ...existingConfig, ...config } as QRCodeConfigDto;
    const qrCodeData = await this.generateQRImage(publicUrl, newConfig);

    // Actualizar QR code
    const updated = await this.prisma.qRCode.update({
      where: { qrCodeId },
      data: {
        qrCodeData,
        config: newConfig as any,
        format: newConfig.format,
        size: newConfig.size,
        scanCount: 0, // Resetear contador
        generatedAt: new Date(),
      },
    });

    // Limpiar cache
    this.clearCacheForQR(qrCodeId);

    this.logger.log(`QR code regenerated: ${qrCodeId}`);

    return this.mapToResponseDto(updated, newConfig);
  }

  /**
   * Genera QR code con logo
   */
  async generateQRCodeWithLogo(
    dto: GenerateQRCodeDto,
  ): Promise<QRCodeResponseDto> {
    if (!dto.config?.includeLogo || !dto.config?.logoUrl) {
      throw new BadRequestException(
        "Logo URL is required for QR code with logo",
      );
    }

    // Implementación básica de QR con logo (canvas)
    const config = { ...dto.config, includeLogo: true } as QRCodeConfigDto;
    return this.generateQRCode({ ...dto, config });
  }

  /**
   * Obtiene estadísticas de QR codes
   */
  async getQRStats(
    entityType?: QREntityType,
    entityId?: string,
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
    const where: any = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    const allQRs = await this.prisma.qRCode.findMany({
      where,
      orderBy: { scanCount: "desc" },
      take: 10,
    });

    const now = new Date();

    const stats = {
      total: allQRs.length,
      active: allQRs.filter((qr) => !qr.expiresAt || qr.expiresAt > now).length,
      expired: allQRs.filter((qr) => qr.expiresAt && qr.expiresAt <= now)
        .length,
      totalScans: allQRs.reduce((sum, qr) => sum + qr.scanCount, 0),
      topScanned: allQRs.slice(0, 5).map((qr) => ({
        qrCodeId: qr.qrCodeId,
        scanCount: qr.scanCount,
        entityId: qr.entityId,
      })),
    };

    return stats;
  }

  // ========== Métodos Privados ==========

  private validateConfig(config: QRCodeConfigDto): void {
    const errors: string[] = [];

    if (config.size && (config.size < 100 || config.size > 1000)) {
      errors.push("Size must be between 100 and 1000 pixels");
    }

    if (
      config.foregroundColor &&
      !this.isValidHexColor(config.foregroundColor)
    ) {
      errors.push("Invalid foreground color (must be HEX format)");
    }

    if (
      config.backgroundColor &&
      !this.isValidHexColor(config.backgroundColor)
    ) {
      errors.push("Invalid background color (must be HEX format)");
    }

    if (config.margin && (config.margin < 0 || config.margin > 4)) {
      errors.push("Margin must be between 0 and 4");
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Invalid QR config: ${errors.join(", ")}`);
    }
  }

  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  private async validateEntityExists(
    entityType: QREntityType,
    entityId: string,
  ): Promise<void> {
    switch (entityType) {
      case QREntityType.DIGITAL_MENU:
        const menu = await this.prisma.digitalMenuConfig.findUnique({
          where: { id: entityId },
        });
        if (!menu) {
          throw new NotFoundException("Digital menu not found");
        }
        break;
      case QREntityType.PRODUCT:
        const product = await this.prisma.product.findUnique({
          where: { id: entityId },
        });
        if (!product) {
          throw new NotFoundException("Product not found");
        }
        break;
      case QREntityType.RECIPE:
        const recipe = await this.prisma.recipe.findUnique({
          where: { id: entityId },
        });
        if (!recipe) {
          throw new NotFoundException("Recipe not found");
        }
        break;
      case QREntityType.CATEGORY:
        const category = await this.prisma.category.findUnique({
          where: { id: entityId },
        });
        if (!category) {
          throw new NotFoundException("Category not found");
        }
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }
  }

  private generatePublicUrl(
    entityType: QREntityType,
    entityId: string,
  ): string {
    const baseUrl = process.env.APP_URL || "http://localhost:3000";

    // URLs específicas según tipo de entidad
    switch (entityType) {
      case QREntityType.DIGITAL_MENU:
        return `${baseUrl}/menu-digital/${entityId}`;
      case QREntityType.PRODUCT:
        return `${baseUrl}/productos/${entityId}`;
      case QREntityType.RECIPE:
        return `${baseUrl}/recetas/${entityId}`;
      case QREntityType.CATEGORY:
        return `${baseUrl}/categorias/${entityId}`;
      default:
        return `${baseUrl}/${entityType}/${entityId}`;
    }
  }

  private async generateQRImage(
    url: string,
    config: QRCodeConfigDto,
  ): Promise<string> {
    const cacheKey = `${url}-${JSON.stringify(config)}`;

    // Verificar cache
    const cached = this.qrCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Configuración de QR
    const qrOptions: any = {
      width: config.size,
      margin: config.margin || 2,
      color: {
        dark: config.foregroundColor || "#000000",
        light: config.backgroundColor || "#FFFFFF",
      },
      errorCorrectionLevel: config.errorCorrection.toUpperCase(),
    };

    // Generar QR code
    return new Promise((resolve, reject) => {
      if (config.format === QRCodeFormat.PNG) {
        QRCode.toDataURL(url, qrOptions, (err, dataUrl) => {
          if (err) {
            return reject(err);
          }
          resolve(dataUrl);
        });
      } else if (config.format === QRCodeFormat.SVG) {
        QRCode.toString(url, qrOptions, (err, svgString) => {
          if (err) {
            return reject(err);
          }
          resolve(
            `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`,
          );
        });
      } else if (config.format === QRCodeFormat.JPEG) {
        QRCode.toDataURL(
          url,
          { ...qrOptions, type: "image/jpeg" },
          (err, dataUrl) => {
            if (err) {
              return reject(err);
            }
            resolve(dataUrl);
          },
        );
      } else if (config.format === QRCodeFormat.WEBP) {
        QRCode.toDataURL(
          url,
          { ...qrOptions, type: "image/webp" },
          (err, dataUrl) => {
            if (err) {
              return reject(err);
            }
            resolve(dataUrl);
          },
        );
      } else {
        reject(new Error(`Unsupported QR format: ${config.format}`));
      }
    }).then((qrCodeData: string) => {
      // Guardar en cache
      this.qrCache.set(cacheKey, {
        data: qrCodeData,
        expiresAt: Date.now() + this.CACHE_DURATION_MS,
      });
      return qrCodeData;
    });
  }

  private generateQRCodeId(entityType: QREntityType, entityId: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${entityType}-${entityId}-${timestamp}-${randomStr}`;
  }

  private calculateExpirationDate(qrType: QRCodeType): Date | null {
    switch (qrType) {
      case QRCodeType.TEMPORARY:
        // Expira en 7 días
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      case QRCodeType.DYNAMIC:
        // Expira en 30 días
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      case QRCodeType.STATIC:
        // No expira
        return null;
      default:
        return null;
    }
  }

  private async getEntityData(
    entityType: QREntityType,
    entityId: string,
  ): Promise<Record<string, any>> {
    try {
      switch (entityType) {
        case QREntityType.DIGITAL_MENU:
          const menu = await this.prisma.digitalMenuConfig.findUnique({
            where: { id: entityId },
            select: { id: true, menu: { select: { id: true, name: true } } },
          });
          return menu || {};
        case QREntityType.PRODUCT:
          const product = await this.prisma.product.findUnique({
            where: { id: entityId },
            select: { id: true, name: true, description: true, category: true },
          });
          return product || {};
        case QREntityType.RECIPE:
          const recipe = await this.prisma.recipe.findUnique({
            where: { id: entityId },
            select: { id: true, name: true, description: true },
          });
          return recipe || {};
        case QREntityType.CATEGORY:
          const category = await this.prisma.category.findUnique({
            where: { id: entityId },
            select: { id: true, name: true, description: true },
          });
          return category || {};
        default:
          return {};
      }
    } catch (error) {
      this.logger.error(`Error fetching entity data: ${error.message}`);
      return {};
    }
  }

  private mapToResponseDto(
    qrCode: any,
    config: QRCodeConfigDto,
  ): QRCodeResponseDto {
    return {
      qrCodeId: qrCode.qrCodeId,
      entityType: qrCode.entityType as QREntityType,
      entityId: qrCode.entityId,
      qrCodeUrl: `${process.env.APP_URL || ""}${qrCode.publicFilePath}`,
      publicUrl: qrCode.publicUrl,
      format: qrCode.format as QRCodeFormat,
      size: qrCode.size,
      publicFilePath: qrCode.publicFilePath,
      generatedAt: qrCode.generatedAt.toISOString(),
      expiresAt: qrCode.expiresAt?.toISOString(),
      scanCount: qrCode.scanCount,
    };
  }

  private clearCacheForQR(qrCodeId: string): void {
    for (const [key, value] of this.qrCache.entries()) {
      if (key.includes(qrCodeId)) {
        this.qrCache.delete(key);
      }
    }
  }
}
