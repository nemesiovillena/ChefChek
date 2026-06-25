import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateDigitalMenuConfigDto,
  UpdateDigitalMenuConfigDto,
  GenerateQRCodeDto,
  PublicMenuQueryDto,
  RegisterScanDto,
} from "./dto/digital-menu.dto";
import QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class DigitalMenuService {
  private readonly logger = new Logger(DigitalMenuService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createConfig(tenantId: string, dto: CreateDigitalMenuConfigDto) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: dto.menuId, tenantId },
    });

    if (!menu) {
      throw new NotFoundException(
        "Menu not found or does not belong to tenant",
      );
    }

    const config = await this.prisma.digitalMenuConfig.create({
      data: {
        tenantId,
        ...dto,
      },
    });

    // Generar QR code automáticamente
    const qrCodeUrl = await this.generateQRCodeUrl(config.id);

    const updated = await this.prisma.digitalMenuConfig.update({
      where: { id: config.id },
      data: { qrCodeUrl },
    });

    return {
      success: true,
      data: updated,
      message: "Digital menu config created successfully",
    };
  }

  async getDigitalMenus(tenantId: string) {
    const configs = await this.prisma.digitalMenuConfig.findMany({
      where: { tenantId },
      include: {
        menu: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
            translations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: configs,
      message: "Digital menus retrieved successfully",
    };
  }

  async getDigitalMenuById(configId: string, tenantId: string) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
      include: {
        menu: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
            translations: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    return {
      success: true,
      data: config,
      message: "Digital menu config retrieved successfully",
    };
  }

  async updateDigitalMenu(
    configId: string,
    tenantId: string,
    dto: UpdateDigitalMenuConfigDto,
  ) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    // Si se cambia el menú, verificar que existe
    if (dto.menuId) {
      const menu = await this.prisma.menu.findFirst({
        where: { id: dto.menuId, tenantId },
      });

      if (!menu) {
        throw new NotFoundException(
          "Menu not found or does not belong to tenant",
        );
      }
    }

    const updated = await this.prisma.digitalMenuConfig.update({
      where: { id: configId },
      data: dto,
    });

    return {
      success: true,
      data: updated,
      message: "Digital menu config updated successfully",
    };
  }

  async deleteDigitalMenu(configId: string, tenantId: string) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    await this.prisma.digitalMenuConfig.delete({
      where: { id: configId },
    });

    return {
      success: true,
      message: "Digital menu config deleted successfully",
    };
  }

  async toggleDigitalMenuStatus(configId: string, tenantId: string) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    const updated = await this.prisma.digitalMenuConfig.update({
      where: { id: configId },
      data: { isActive: !config.isActive },
    });

    return {
      success: true,
      data: updated,
      message: `Digital menu ${updated.isActive ? "activated" : "deactivated"} successfully`,
    };
  }

  // Generación de QR Codes
  async generateQRCode(
    configId: string,
    tenantId: string,
    dto?: GenerateQRCodeDto,
  ) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    const format = dto?.format || "png";
    const size = dto?.size || 300;
    const customColor = dto?.customColor || "#000000";

    const qrCodeUrl = await this.generateQRCodeUrl(
      configId,
      format,
      size,
      customColor,
    );

    const updated = await this.prisma.digitalMenuConfig.update({
      where: { id: configId },
      data: { qrCodeUrl },
    });

    return {
      success: true,
      data: {
        qrCodeUrl: updated.qrCodeUrl,
        format,
        size,
        customColor,
      },
      message: "QR code generated successfully",
    };
  }

  private async generateQRCodeUrl(
    configId: string,
    format: string = "png",
    size: number = 300,
    customColor: string = "#000000",
  ): Promise<string> {
    // Generar URL pública del menú
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl}/api/v1/digital-menu/public/${configId}`;

    try {
      // Directorio para almacenar QR codes
      const qrDir = path.join(
        process.cwd(),
        "public",
        "qrcodes",
        "digital-menu",
      );
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      // Ruta del archivo QR
      const qrFileName = `${configId}.${format}`;
      const qrFilePath = path.join(qrDir, qrFileName);

      // Generar QR code real con opciones personalizadas
      const qrOptions: any = {
        width: size,
        margin: 2,
        color: {
          dark: customColor,
          light: "#FFFFFF",
        },
      };

      if (format === "png") {
        await QRCode.toFile(qrFilePath, publicUrl, qrOptions);
      } else {
        // Generar SVG para otros formatos
        const svgString = (await QRCode.toString(
          publicUrl,
          qrOptions,
        )) as unknown as string;
        fs.writeFileSync(qrFilePath, svgString);
      }

      // Retornar URL pública del QR
      return `${baseUrl}/qrcodes/digital-menu/${qrFileName}`;
    } catch (error) {
      this.logger.error("Error generating QR code:", error);
      // Fallback a URL mock si falla la generación
      return `${baseUrl}/api/v1/digital-menu/public/${configId}`;
    }
  }

  // Vista Pública del Menú
  async getPublicMenu(configId: string, query: PublicMenuQueryDto) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, isActive: true },
      include: {
        menu: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
            sections: {
              include: {
                items: {
                  include: {
                    recipe: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
            translations: {
              where: query.language ? { language: query.language } : undefined,
            },
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException("Digital menu not found or inactive");
    }

    // Filtrar por alérgenos si se solicita
    let filteredItems = config.menu.sections.flatMap(
      (section) => section.items,
    );

    if (query.filteredByAllergens && query.filteredByAllergens.length > 0) {
      filteredItems = filteredItems.filter((item) => {
        const recipeAllergens = item.recipe.allergens || [];
        return !query.filteredByAllergens.some((allergen) =>
          recipeAllergens.includes(allergen),
        );
      });
    }

    // Registrar el scan
    await this.registerScan(configId, {
      digitalMenuId: configId,
      language: query.language,
      filteredByAllergens: query.filteredByAllergens,
      interactionType: "scan",
    });

    return {
      success: true,
      data: {
        config: {
          name: config.name,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          fontFamily: config.fontFamily,
          logoUrl: config.logoUrl,
          isOpen: config.isOpen,
          openingHours: config.openingHours,
          showPrices: config.showPrices,
          showAllergens: config.showAllergens,
          showDescriptions: config.showDescriptions,
          enableAllergenFilter: config.enableAllergenFilter,
        },
        menu: {
          id: config.menu.id,
          name: config.menu.name,
          description: config.menu.description,
          translations: config.menu.translations,
          sections: config.menu.sections.map((section) => ({
            ...section,
            items: section.items.filter((item) =>
              filteredItems.some((filtered) => filtered.id === item.id),
            ),
          })),
        },
      },
      message: "Public menu retrieved successfully",
    };
  }

  // Analytics y Tracking
  async registerScan(configId: string, dto: RegisterScanDto) {
    const scan = await this.prisma.menuScan.create({
      data: {
        digitalMenuId: configId,
        ...dto,
      },
    });

    // Actualizar contadores en la config
    await this.prisma.digitalMenuConfig.update({
      where: { id: configId },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date(),
      },
    });

    return {
      success: true,
      data: scan,
      message: "Scan registered successfully",
    };
  }

  async getAnalytics(configId: string, tenantId: string) {
    const config = await this.prisma.digitalMenuConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new NotFoundException("Digital menu config not found");
    }

    const scans = await this.prisma.menuScan.findMany({
      where: { digitalMenuId: configId },
      orderBy: { scannedAt: "desc" },
      take: 1000,
    });

    // Calcular métricas
    const totalScans = scans.length;
    const uniqueScans = new Set(scans.map((s) => s.ipAddress)).size;
    const scansByLanguage = scans.reduce(
      (acc, scan) => {
        const lang = scan.language || "unknown";
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const scansByType = scans.reduce(
      (acc, scan) => {
        const type = scan.interactionType || "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const filteredAllergens = scans.reduce(
      (acc, scan) => {
        const allergens = scan.filteredByAllergens as number[] | null;
        if (allergens && allergens.length > 0) {
          allergens.forEach((allergen) => {
            acc[allergen] = (acc[allergen] || 0) + 1;
          });
        }
        return acc;
      },
      {} as Record<number, number>,
    );

    return {
      success: true,
      data: {
        summary: {
          totalScans,
          uniqueScans,
          avgScansPerUser: uniqueScans > 0 ? totalScans / uniqueScans : 0,
          lastScannedAt: config.lastScannedAt,
        },
        scansByLanguage,
        scansByType,
        mostFilteredAllergens: Object.entries(filteredAllergens)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .reduce(
            (acc, [allergen, count]) => {
              acc[allergen] = count;
              return acc;
            },
            {} as Record<string, number>,
          ),
      },
      message: "Analytics retrieved successfully",
    };
  }
}
