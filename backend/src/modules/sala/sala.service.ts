import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  FeedbackDto,
  QrScanDto,
  InteractionDto,
  IncidentDto,
  UpdateFeedbackDto,
  SalaStatsDto,
} from "./dto/sala.dto";

@Injectable()
export class SalaService {
  private readonly logger = new Logger(SalaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateQrCode(dto: QrScanDto) {
    this.logger.log(`Validating QR code: ${dto.qrCode}`);

    try {
      // Buscar digital menu config por QR code
      const digitalMenu = await this.prisma.digitalMenuConfig.findFirst({
        where: {
          qrCodeUrl: { contains: dto.qrCode },
          isActive: true,
        },
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
              },
            },
          },
        },
      });

      if (!digitalMenu) {
        return {
          isValid: false,
          error: "QR code not found or expired",
        };
      }

      // Registrar el escaneo
      await this.prisma.menuScan.create({
        data: {
          digitalMenuId: digitalMenu.id,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          language: dto.language || "es",
          interactionType: "scan",
          scannedAt: new Date(),
        },
      });

      // Actualizar contadores
      await this.prisma.digitalMenuConfig.update({
        where: { id: digitalMenu.id },
        data: {
          scanCount: { increment: 1 },
          lastScannedAt: new Date(),
        },
      });

      this.logger.log(`QR code validated for menu: ${digitalMenu.name}`);

      return {
        isValid: true,
        digitalMenuId: digitalMenu.id,
        menuId: digitalMenu.menuId,
        tenantId: digitalMenu.tenantId,
        restaurantName: digitalMenu.name,
      };
    } catch (error) {
      this.logger.error(`Error validating QR code: ${error.message}`);
      return {
        isValid: false,
        error: "Error validating QR code",
      };
    }
  }

  async submitFeedback(dto: FeedbackDto) {
    this.logger.log(`Submitting feedback for menu: ${dto.digitalMenuId}`);

    try {
      // Crear feedback en base de datos (usando MenuScan como tracking)
      const scan = await this.prisma.menuScan.create({
        data: {
          digitalMenuId: dto.digitalMenuId,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          language: "es",
          interactionType:
            dto.type === "RATING" ? "rating" : dto.type.toLowerCase(),
          metadata: {
            menuItemId: dto.menuItemId,
            rating: dto.rating,
            comment: dto.comment,
            category: dto.category,
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
          },
          scannedAt: new Date(),
        },
      });

      this.logger.log(`Feedback submitted: ${scan.id}`);

      return {
        success: true,
        data: scan,
        message: "Feedback submitted successfully",
      };
    } catch (error) {
      this.logger.error(`Error submitting feedback: ${error.message}`);
      throw error;
    }
  }

  async trackInteraction(dto: InteractionDto) {
    this.logger.log(`Tracking interaction: ${dto.interactionType}`);

    try {
      const scan = await this.prisma.menuScan.create({
        data: {
          digitalMenuId: dto.digitalMenuId,
          interactionType: dto.interactionType,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          language: dto.language || "es",
          metadata: {
            menuItemId: dto.menuItemId,
            filteredByAllergens: dto.filteredByAllergens,
            ...dto.metadata,
          },
          scannedAt: new Date(),
        },
      });

      return {
        success: true,
        data: scan,
      };
    } catch (error) {
      this.logger.error(`Error tracking interaction: ${error.message}`);
      throw error;
    }
  }

  async reportIncident(dto: IncidentDto) {
    this.logger.log(`Reporting incident: ${dto.type}`);

    try {
      const scan = await this.prisma.menuScan.create({
        data: {
          digitalMenuId: dto.digitalMenuId,
          interactionType: "incident",
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          language: "es",
          metadata: {
            incidentType: dto.type,
            location: dto.location,
            description: dto.description,
            severity: dto.severity,
            customerName: dto.customerName,
            customerContact: dto.customerContact,
            customerEmail: dto.customerEmail,
            incidentDate: dto.incidentDate || new Date().toISOString(),
          },
          scannedAt: new Date(),
        },
      });

      // Si es incidente crítico, crear alerta en dashboard
      if (dto.severity === "CRITICAL" || dto.severity === "HIGH") {
        await this.prisma.dashboardAlert.create({
          data: {
            tenantId: "SYSTEM", // Se actualizará después
            alertType: "SALA_INCIDENT",
            severity: dto.severity,
            title: `${dto.type} reported in dining room`,
            description: dto.description,
            entityType: "SALA",
            entityId: scan.id,
            isResolved: false,
          },
        });
      }

      return {
        success: true,
        data: scan,
        message: "Incident reported successfully",
      };
    } catch (error) {
      this.logger.error(`Error reporting incident: ${error.message}`);
      throw error;
    }
  }

  async getSalaStats(tenantId: string, dto: SalaStatsDto) {
    const where: any = {
      digitalMenuId: dto.digitalMenuId,
    };

    if (dto.startDate || dto.endDate) {
      where.scannedAt = {};
      if (dto.startDate) {
        where.scannedAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.scannedAt.lte = new Date(dto.endDate);
      }
    }

    const scans = await this.prisma.menuScan.findMany({
      where,
      orderBy: {
        scannedAt: "desc",
      },
    });

    // Calcular estadísticas
    const stats = {
      totalScans: scans.length,
      uniqueScans: new Set(scans.map((s) => s.ipAddress)).size,
      byInteractionType: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      avgRating: 0,
      ratingCount: 0,
      incidents: [] as any[],
      recentScans: scans.slice(0, 20),
    };

    scans.forEach((scan) => {
      // Por tipo de interacción
      if (!stats.byInteractionType[scan.interactionType]) {
        stats.byInteractionType[scan.interactionType] = 0;
      }
      stats.byInteractionType[scan.interactionType]++;

      // Por idioma
      if (scan.language) {
        if (!stats.byLanguage[scan.language]) {
          stats.byLanguage[scan.language] = 0;
        }
        stats.byLanguage[scan.language]++;
      }

      // Ratings
      if (scan.interactionType === "rating" && (scan.metadata as any)?.rating) {
        stats.ratingCount++;
        stats.avgRating += (scan.metadata as any).rating;
      }

      // Incidentes
      if (scan.interactionType === "incident") {
        stats.incidents.push({
          id: scan.id,
          type: (scan.metadata as any)?.incidentType,
          severity: (scan.metadata as any)?.severity,
          description: (scan.metadata as any)?.description,
          location: (scan.metadata as any)?.location,
          reportedAt: scan.scannedAt,
        });
      }
    });

    if (stats.ratingCount > 0) {
      stats.avgRating = stats.avgRating / stats.ratingCount;
    }

    return {
      success: true,
      data: stats,
    };
  }

  async getAllFeedback(tenantId: string, digitalMenuId?: string) {
    const where: any = {
      interactionType: { in: ["rating", "comment", "incident"] },
    };

    if (digitalMenuId) {
      where.digitalMenuId = digitalMenuId;
    }

    const feedbacks = await this.prisma.menuScan.findMany({
      where,
      orderBy: {
        scannedAt: "desc",
      },
    });

    return {
      success: true,
      data: feedbacks,
      count: feedbacks.length,
    };
  }

  async getIncidents(tenantId: string, severity?: string) {
    const where: any = {
      interactionType: "incident",
    };

    if (severity) {
      where.metadata = {
        severity,
      };
    }

    const incidents = await this.prisma.menuScan.findMany({
      where,
      orderBy: {
        scannedAt: "desc",
      },
    });

    return {
      success: true,
      data: incidents,
      count: incidents.length,
    };
  }
}
