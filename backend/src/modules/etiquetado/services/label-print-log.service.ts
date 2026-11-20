import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateLabelPrintLogDto } from "../dto/create-label-print-log.dto";

/** Días que se guarda el registro de impresiones. */
const RETENTION_DAYS = 90;

/**
 * Registro de impresiones térmicas. Lo escribe el navegador al acabar cada
 * intento (la impresora solo la ve el PC de cocina): qué contestó la Zebra,
 * si ChefChek la calibró y cómo terminó.
 */
@Injectable()
export class LabelPrintLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    user: { id?: string; name?: string | null } | undefined,
    dto: CreateLabelPrintLogDto,
    userAgent: string | undefined,
  ) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    await this.prisma.labelPrintLog.deleteMany({
      where: { tenantId, createdAt: { lt: cutoff } },
    });
    return this.prisma.labelPrintLog.create({
      data: {
        tenantId,
        userId: user?.id ?? null,
        userName: user?.name?.trim() || null,
        foodLabelId: dto.foodLabelId ?? null,
        format: dto.format ?? null,
        copies: dto.copies ?? null,
        outcome: dto.outcome,
        errorMessage: dto.errorMessage ?? null,
        calibrated: dto.calibrated ?? false,
        durationMs: dto.durationMs ?? null,
        deviceUid: dto.deviceUid ?? null,
        steps: dto.steps as unknown as object,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
      select: { id: true },
    });
  }

  list(tenantId: string, limit = 50) {
    return this.prisma.labelPrintLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
