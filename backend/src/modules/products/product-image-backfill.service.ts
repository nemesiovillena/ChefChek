import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { PexelsImageSearchService } from "./pexels-image-search.service";

export interface BackfillImagesResult {
  processed: number;
  updated: number;
  skipped: number;
  failed: Array<{ id: string; name: string; reason: string }>;
  remaining: number;
}

const DEFAULT_BATCH_LIMIT = 40;
const MAX_BATCH_LIMIT = 100;

@Injectable()
export class ProductImageBackfillService {
  private readonly logger = new Logger(ProductImageBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pexelsImageSearchService: PexelsImageSearchService,
  ) {}

  /**
   * Asigna automáticamente la primera imagen candidata de Pexels a los
   * artículos activos del tenant que aún no tengan `imageUrl`. Nunca
   * sobrescribe una imagen ya asignada. Procesa por lotes (no toda la
   * cola de golpe) para no arriesgar timeout del proxy en un tenant con
   * muchos artículos sin imagen; se puede volver a llamar hasta que
   * `remaining` sea 0.
   */
  async backfillImages(
    tenantId: string,
    limit = DEFAULT_BATCH_LIMIT,
  ): Promise<BackfillImagesResult> {
    const batchLimit = Math.min(Math.max(limit, 1), MAX_BATCH_LIMIT);

    const missingImageFilter = {
      tenantId,
      deletedAt: null,
      isActive: true,
      OR: [{ imageUrl: null }, { imageUrl: "" }],
    };

    const products = await this.prisma.product.findMany({
      where: missingImageFilter,
      select: { id: true, name: true, brand: true },
      take: batchLimit,
    });

    let updated = 0;
    let skipped = 0;
    const failed: BackfillImagesResult["failed"] = [];

    for (const product of products) {
      try {
        const query = [product.name, product.brand].filter(Boolean).join(" ");
        const results = await this.pexelsImageSearchService.search(query);

        if (results.length === 0) {
          skipped++;
          continue;
        }

        await this.prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: results[0].url },
        });
        updated++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Backfill de imagen falló para producto ${product.id} (${product.name}): ${reason}`,
        );
        failed.push({ id: product.id, name: product.name, reason });
      }
    }

    const remaining = await this.prisma.product.count({
      where: missingImageFilter,
    });

    return { processed: products.length, updated, skipped, failed, remaining };
  }
}
