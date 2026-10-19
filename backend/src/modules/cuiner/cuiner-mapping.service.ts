import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CuinerServingMeasuresService } from "./cuiner-serving-measures.service";
import {
  SetDishMapDto,
  SetProductMapDto,
  SetSupplierMapDto,
  UploadCatalogDto,
} from "./dto/cuiner.dto";

/**
 * Catálogos de Cuiner (los sube el conector, solo lectura en ChefChek) y los
 * enlaces entre entidades de ChefChek y códigos de Cuiner. Los enlaces se
 * validan contra el catálogo subido para no enviar nunca un código inexistente.
 */
@Injectable()
export class CuinerMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servingMeasures: CuinerServingMeasuresService,
  ) {}

  // ─── Catálogos ────────────────────────────────────────────────────────────

  async upsertCatalog(tenantId: string, dto: UploadCatalogDto) {
    const ops = [
      ...(dto.suppliers ?? []).map((s) =>
        this.prisma.cuinerSupplier.upsert({
          where: { tenantId_codigo: { tenantId, codigo: s.codigo } },
          create: {
            tenantId,
            codigo: s.codigo,
            nombre: s.nombre,
            razon: s.razon ?? null,
            cif: s.cif ?? null,
            baja: s.baja,
          },
          update: {
            nombre: s.nombre,
            razon: s.razon ?? null,
            cif: s.cif ?? null,
            baja: s.baja,
          },
        }),
      ),
      ...(dto.articles ?? []).map((a) =>
        this.prisma.cuinerArticle.upsert({
          where: { tenantId_codigo: { tenantId, codigo: a.codigo } },
          create: {
            tenantId,
            codigo: a.codigo,
            descripcion: a.descripcion,
            manipulacion: a.manipulacion ?? null,
            medida: a.medida ?? null,
            baja: a.baja,
          },
          update: {
            descripcion: a.descripcion,
            manipulacion: a.manipulacion ?? null,
            medida: a.medida ?? null,
            baja: a.baja,
          },
        }),
      ),
      ...(dto.articleSuppliers ?? []).map((r) => {
        const data = {
          refProveedor: r.refProveedor ?? null,
          ultFecha: r.ultFecha ? new Date(r.ultFecha) : null,
          ultImporte: r.ultImporte ?? null,
          ultIva: r.ultIva ?? null,
          ultUnPorCaja: r.ultUnPorCaja ?? null,
          ultImporteUC: r.ultImporteUC ?? null,
        };
        return this.prisma.cuinerArticleSupplier.upsert({
          where: {
            tenantId_articulo_proveedor: {
              tenantId,
              articulo: r.articulo,
              proveedor: r.proveedor,
            },
          },
          create: {
            tenantId,
            articulo: r.articulo,
            proveedor: r.proveedor,
            ...data,
          },
          update: data,
        });
      }),
      ...(dto.dishes ?? []).map((d) =>
        this.prisma.cuinerDish.upsert({
          where: {
            tenantId_tipo_producto: {
              tenantId,
              tipo: d.tipo,
              producto: d.producto,
            },
          },
          create: {
            tenantId,
            tipo: d.tipo,
            producto: d.producto,
            nombre: d.nombre,
            familia: d.familia ?? null,
          },
          // Un conector antiguo no envía familia: no borrar la que ya hay.
          update: {
            nombre: d.nombre,
            ...(d.familia !== undefined ? { familia: d.familia } : {}),
          },
        }),
      ),
    ];
    await this.prisma.$transaction(ops);
    return {
      suppliers: dto.suppliers?.length ?? 0,
      articles: dto.articles?.length ?? 0,
      articleSuppliers: dto.articleSuppliers?.length ?? 0,
      dishes: dto.dishes?.length ?? 0,
    };
  }

  async getCatalogCounts(tenantId: string) {
    const where = { tenantId };
    const [suppliers, articles, articleSuppliers, dishes] = await Promise.all([
      this.prisma.cuinerSupplier.count({ where }),
      this.prisma.cuinerArticle.count({ where }),
      this.prisma.cuinerArticleSupplier.count({ where }),
      this.prisma.cuinerDish.count({ where }),
    ]);
    return { suppliers, articles, articleSuppliers, dishes };
  }

  // ─── Enlaces ─────────────────────────────────────────────────────────────

  async listMaps(tenantId: string) {
    const where = { tenantId };
    const [suppliers, products, dishes] = await Promise.all([
      this.prisma.cuinerSupplierMap.findMany({ where }),
      this.prisma.cuinerProductMap.findMany({ where }),
      this.prisma.cuinerDishMap.findMany({ where }),
    ]);
    return { suppliers, products, dishes };
  }

  async setSupplierMap(tenantId: string, dto: SetSupplierMapDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
    await this.assertCatalogCode("supplier", tenantId, dto.codigo);

    const taken = await this.prisma.cuinerSupplierMap.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: dto.codigo } },
    });
    if (taken && taken.supplierId !== dto.supplierId) {
      throw new BadRequestException(
        `El proveedor ${dto.codigo} de Cuiner ya está enlazado a otro proveedor`,
      );
    }
    return this.prisma.cuinerSupplierMap.upsert({
      where: { tenantId_supplierId: { tenantId, supplierId: dto.supplierId } },
      create: { tenantId, supplierId: dto.supplierId, codigo: dto.codigo },
      update: { codigo: dto.codigo },
    });
  }

  async setProductMap(tenantId: string, dto: SetProductMapDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException("Artículo no encontrado");
    }
    await this.assertCatalogCode("article", tenantId, dto.articulo);

    return this.prisma.cuinerProductMap.upsert({
      where: { tenantId_productId: { tenantId, productId: dto.productId } },
      create: { tenantId, productId: dto.productId, articulo: dto.articulo },
      update: { articulo: dto.articulo },
    });
  }

  async setDishMap(tenantId: string, dto: SetDishMapDto) {
    const { key, data } = await this.validateDishMap(tenantId, dto);
    return this.prisma.cuinerDishMap.upsert({
      where: { tenantId_tipo_producto: key },
      create: { ...key, ...data },
      update: data,
    });
  }

  /**
   * Enlaza varios platos de una vez (asistente por marca). Todo o nada: si
   * un enlace no es válido no se guarda ninguno y se dice qué plato falla.
   */
  async setDishMaps(tenantId: string, items: SetDishMapDto[]) {
    const valid: Awaited<ReturnType<typeof this.validateDishMap>>[] = [];
    const errors: string[] = [];
    for (const item of items) {
      try {
        valid.push(await this.validateDishMap(tenantId, item));
      } catch (error) {
        errors.push(
          `${item.producto}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException(
        `No se ha enlazado ningún plato. Revisa: ${errors.slice(0, 5).join(" · ")}${errors.length > 5 ? ` y ${errors.length - 5} más` : ""}`,
      );
    }
    await this.prisma.$transaction(
      valid.map(({ key, data }) =>
        this.prisma.cuinerDishMap.upsert({
          where: { tenantId_tipo_producto: key },
          create: { ...key, ...data },
          update: data,
        }),
      ),
    );
    return { linked: valid.length };
  }

  private async validateDishMap(tenantId: string, dto: SetDishMapDto) {
    const hasRecipe = Boolean(dto.recipeId);
    const hasProduct = Boolean(dto.productId);
    if (hasRecipe === hasProduct) {
      throw new BadRequestException(
        "Enlaza el plato con una receta o con un artículo, no con ambos",
      );
    }
    if (dto.servingMeasureId && !hasProduct) {
      throw new BadRequestException(
        "La medida solo se usa al enlazar con un artículo de venta directa",
      );
    }
    if (hasRecipe) {
      const recipe = await this.prisma.recipe.findFirst({
        where: { id: dto.recipeId as string, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!recipe) {
        throw new NotFoundException("Receta no encontrada");
      }
    } else {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId as string, tenantId, deletedAt: null },
        select: { id: true, name: true, referenceUnit: true },
      });
      if (!product) {
        throw new NotFoundException("Artículo no encontrado");
      }
      if (dto.servingMeasureId) {
        const measure = await this.servingMeasures.findOrThrow(
          tenantId,
          dto.servingMeasureId,
        );
        this.servingMeasures.assertMeasureFitsProduct(measure, product);
      }
    }
    const dish = await this.prisma.cuinerDish.findUnique({
      where: {
        tenantId_tipo_producto: {
          tenantId,
          tipo: dto.tipo,
          producto: dto.producto,
        },
      },
    });
    if (!dish) {
      throw new BadRequestException(
        `El ${dto.tipo}-${dto.producto} no está en la carta de Cuiner sincronizada`,
      );
    }

    const key = { tenantId, tipo: dto.tipo, producto: dto.producto };
    const data = {
      recipeId: dto.recipeId ?? null,
      productId: dto.productId ?? null,
      servingMeasureId: hasProduct ? (dto.servingMeasureId ?? null) : null,
    };
    return { key, data };
  }

  async deleteSupplierMap(tenantId: string, supplierId: string) {
    await this.prisma.cuinerSupplierMap.deleteMany({
      where: { tenantId, supplierId },
    });
  }

  async deleteProductMap(tenantId: string, productId: string) {
    await this.prisma.cuinerProductMap.deleteMany({
      where: { tenantId, productId },
    });
  }

  async deleteDishMap(tenantId: string, tipo: string, producto: string) {
    await this.prisma.cuinerDishMap.deleteMany({
      where: { tenantId, tipo, producto },
    });
  }

  private async assertCatalogCode(
    kind: "supplier" | "article",
    tenantId: string,
    code: string,
  ): Promise<void> {
    const found =
      kind === "supplier"
        ? await this.prisma.cuinerSupplier.findUnique({
            where: { tenantId_codigo: { tenantId, codigo: code } },
          })
        : await this.prisma.cuinerArticle.findUnique({
            where: { tenantId_codigo: { tenantId, codigo: code } },
          });
    if (!found) {
      throw new BadRequestException(
        `El código ${code} no está en el catálogo de Cuiner sincronizado`,
      );
    }
  }
}
