import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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
          where: { tenantId_producto: { tenantId, producto: d.producto } },
          create: { tenantId, producto: d.producto, nombre: d.nombre },
          update: { nombre: d.nombre },
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
    const hasRecipe = Boolean(dto.recipeId);
    const hasProduct = Boolean(dto.productId);
    if (hasRecipe === hasProduct) {
      throw new BadRequestException(
        "Enlaza el plato con una receta o con un artículo, no con ambos",
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
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException("Artículo no encontrado");
      }
    }
    await this.assertCatalogCode("dish", tenantId, dto.producto);

    const data = {
      recipeId: dto.recipeId ?? null,
      productId: dto.productId ?? null,
    };
    return this.prisma.cuinerDishMap.upsert({
      where: { tenantId_producto: { tenantId, producto: dto.producto } },
      create: { tenantId, producto: dto.producto, ...data },
      update: data,
    });
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

  async deleteDishMap(tenantId: string, producto: string) {
    await this.prisma.cuinerDishMap.deleteMany({
      where: { tenantId, producto },
    });
  }

  private async assertCatalogCode(
    kind: "supplier" | "article" | "dish",
    tenantId: string,
    code: string,
  ): Promise<void> {
    const found =
      kind === "supplier"
        ? await this.prisma.cuinerSupplier.findUnique({
            where: { tenantId_codigo: { tenantId, codigo: code } },
          })
        : kind === "article"
          ? await this.prisma.cuinerArticle.findUnique({
              where: { tenantId_codigo: { tenantId, codigo: code } },
            })
          : await this.prisma.cuinerDish.findUnique({
              where: { tenantId_producto: { tenantId, producto: code } },
            });
    if (!found) {
      throw new BadRequestException(
        `El código ${code} no está en el catálogo de Cuiner sincronizado`,
      );
    }
  }
}
