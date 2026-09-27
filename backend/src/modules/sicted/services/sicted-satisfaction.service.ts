import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateSatisfactionSampleDto } from "../dto/sicted-satisfaction.dto";

export interface SatisfactionMonthlySummary {
  year: number;
  month: number;
  sampleCount: number;
  averageScore: number | null;
  previousAverageScore: number | null;
  trend: "up" | "down" | "flat" | null;
}

/** Muestras de satisfacción (CLI.4) — append-only, resumen mensual con tendencia. */
@Injectable()
export class SictedSatisfactionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, from?: Date, to?: Date) {
    return this.prisma.sictedSatisfactionSample.findMany({
      where: {
        tenantId,
        ...(from || to
          ? {
              sampledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { sampledAt: "desc" },
      take: 500,
    });
  }

  async create(tenantId: string, dto: CreateSatisfactionSampleDto) {
    return this.prisma.sictedSatisfactionSample.create({
      data: {
        tenantId,
        score: dto.score,
        channel: dto.channel,
        comment: dto.comment,
        recordedByName: dto.recordedByName,
      },
    });
  }

  /** Media del mes pedido, comparada con el mes anterior (tendencia). */
  async monthlySummary(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<SatisfactionMonthlySummary> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const prevFrom = new Date(Date.UTC(year, month - 2, 1));
    const prevTo = from;

    const [current, previous] = await Promise.all([
      this.prisma.sictedSatisfactionSample.aggregate({
        where: { tenantId, sampledAt: { gte: from, lt: to } },
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.sictedSatisfactionSample.aggregate({
        where: { tenantId, sampledAt: { gte: prevFrom, lt: prevTo } },
        _avg: { score: true },
      }),
    ]);

    const averageScore = current._avg.score ?? null;
    const previousAverageScore = previous._avg.score ?? null;
    let trend: SatisfactionMonthlySummary["trend"] = null;
    if (averageScore !== null && previousAverageScore !== null) {
      trend =
        averageScore > previousAverageScore
          ? "up"
          : averageScore < previousAverageScore
            ? "down"
            : "flat";
    }

    return {
      year,
      month,
      sampleCount: current._count,
      averageScore,
      previousAverageScore,
      trend,
    };
  }
}
