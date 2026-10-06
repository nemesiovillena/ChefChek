import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  calculateSimilarity,
  normalizeCifNif,
  normalizeProductDescription,
} from "../../common/utils/string-similarity";

const PAGE_SIZE = 50;
/** Por debajo de este parecido de nombre no se sugiere nada. */
const NAME_SUGGESTION_MIN = 0.75;

export interface CuinerSuggestion {
  codigo: string;
  nombre: string;
  reason: "cif" | "nombre";
}

export interface OverviewQuery {
  search?: string;
  onlyUnmapped?: boolean;
  page?: number;
}

const pageOf = (page?: number) => Math.max(1, Math.floor(page ?? 1));

function bestByName<T>(
  name: string,
  candidates: T[],
  candidateName: (c: T) => string,
): { candidate: T; score: number } | null {
  const target = normalizeProductDescription(name);
  if (!target) {
    return null;
  }
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = calculateSimilarity(
      target,
      normalizeProductDescription(candidateName(candidate)),
    );
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }
  return best && best.score >= NAME_SUGGESTION_MIN ? best : null;
}

/**
 * Vistas de lectura para las pantallas de enlace con Cuiner: cada entidad de
 * ChefChek (o plato de la carta de Cuiner) con su enlace actual y, si no lo
 * tiene, una sugerencia (por CIF o por parecido de nombre). Las sugerencias
 * nunca se guardan solas: el usuario las confirma.
 */
@Injectable()
export class CuinerOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async suppliers(tenantId: string) {
    const [suppliers, maps, catalog] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, legalName: true, cifNif: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.cuinerSupplierMap.findMany({ where: { tenantId } }),
      this.prisma.cuinerSupplier.findMany({ where: { tenantId, baja: false } }),
    ]);
    const byCode = new Map(catalog.map((c) => [c.codigo, c]));
    const codeBySupplier = new Map(maps.map((m) => [m.supplierId, m.codigo]));
    const taken = new Set(maps.map((m) => m.codigo));
    const free = catalog.filter((c) => !taken.has(c.codigo));

    return suppliers.map((s) => {
      const codigo = codeBySupplier.get(s.id);
      const mapped = codigo
        ? { codigo, nombre: byCode.get(codigo)?.nombre ?? codigo }
        : null;
      return {
        supplierId: s.id,
        name: s.name,
        cifNif: s.cifNif,
        mapped,
        suggestion: mapped ? null : this.suggestSupplier(s, free),
      };
    });
  }

  private suggestSupplier(
    supplier: { name: string; legalName: string | null; cifNif: string | null },
    candidates: {
      codigo: string;
      nombre: string;
      razon: string | null;
      cif: string | null;
    }[],
  ): CuinerSuggestion | null {
    const cif = supplier.cifNif ? normalizeCifNif(supplier.cifNif) : "";
    if (cif) {
      const byCif = candidates.find(
        (c) => c.cif && normalizeCifNif(c.cif) === cif,
      );
      if (byCif) {
        return { codigo: byCif.codigo, nombre: byCif.nombre, reason: "cif" };
      }
    }
    const byName = bestByName(
      supplier.legalName || supplier.name,
      candidates,
      (c) => c.razon || c.nombre,
    );
    return byName
      ? {
          codigo: byName.candidate.codigo,
          nombre: byName.candidate.nombre,
          reason: "nombre",
        }
      : null;
  }

  async products(tenantId: string, query: OverviewQuery) {
    const page = pageOf(query.page);
    const maps = await this.prisma.cuinerProductMap.findMany({
      where: { tenantId },
    });
    const codeByProduct = new Map(maps.map((m) => [m.productId, m.articulo]));

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
      ...(query.onlyUnmapped
        ? { id: { notIn: [...codeByProduct.keys()] } }
        : {}),
    };
    const [total, products, catalog] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.cuinerArticle.findMany({
        where: { tenantId, baja: false },
        select: { codigo: true, descripcion: true },
      }),
    ]);
    const byCode = new Map(catalog.map((a) => [a.codigo, a.descripcion]));

    const items = products.map((p) => {
      const codigo = codeByProduct.get(p.id);
      const mapped = codigo
        ? { codigo, nombre: byCode.get(codigo) ?? codigo }
        : null;
      const best = mapped
        ? null
        : bestByName(p.name, catalog, (a) => a.descripcion);
      return {
        productId: p.id,
        name: p.name,
        mapped,
        suggestion: best
          ? {
              codigo: best.candidate.codigo,
              nombre: best.candidate.descripcion,
              reason: "nombre" as const,
            }
          : null,
      };
    });
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  /**
   * Platos de la carta de Cuiner ordenados por unidades vendidas (los que más
   * pesan en el stock primero), con su receta o artículo enlazado.
   */
  async dishes(tenantId: string, query: OverviewQuery & { tipo?: string }) {
    const page = pageOf(query.page);
    const tipo =
      query.tipo && ["P", "I", "M"].includes(query.tipo) ? query.tipo : "P";
    const search = query.search
      ? normalizeProductDescription(query.search)
      : "";

    const [dishes, maps, sales] = await Promise.all([
      this.prisma.cuinerDish.findMany({ where: { tenantId, tipo } }),
      this.prisma.cuinerDishMap.findMany({ where: { tenantId, tipo } }),
      this.prisma.cuinerSaleLine.groupBy({
        by: ["producto"],
        where: { tenantId, tipo, anulada: false },
        _sum: { unidades: true },
      }),
    ]);
    const mapByCode = new Map(maps.map((m) => [m.producto, m]));
    const soldByCode = new Map(
      sales.map((s) => [s.producto, s._sum.unidades ?? 0]),
    );

    const filtered = dishes
      .filter((d) => !query.onlyUnmapped || !mapByCode.has(d.producto))
      .filter(
        (d) =>
          !search ||
          d.producto.includes(search) ||
          normalizeProductDescription(d.nombre).includes(search),
      )
      .sort(
        (a, b) =>
          (soldByCode.get(b.producto) ?? 0) -
            (soldByCode.get(a.producto) ?? 0) ||
          a.nombre.localeCompare(b.nombre, "es"),
      );
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const recipeIds = pageRows
      .map((d) => mapByCode.get(d.producto)?.recipeId)
      .filter((id): id is string => !!id);
    const productIds = pageRows
      .map((d) => mapByCode.get(d.producto)?.productId)
      .filter((id): id is string => !!id);
    const [recipes, products] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { tenantId, id: { in: recipeIds } },
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: { id: true, name: true },
      }),
    ]);
    const recipeName = new Map(recipes.map((r) => [r.id, r.name]));
    const productName = new Map(products.map((p) => [p.id, p.name]));

    const items = pageRows.map((d) => {
      const map = mapByCode.get(d.producto);
      return {
        tipo: d.tipo,
        producto: d.producto,
        nombre: d.nombre,
        sold: soldByCode.get(d.producto) ?? 0,
        mapped: map
          ? map.recipeId
            ? {
                kind: "recipe" as const,
                id: map.recipeId,
                name: recipeName.get(map.recipeId) ?? "(receta eliminada)",
              }
            : {
                kind: "product" as const,
                id: map.productId as string,
                name:
                  productName.get(map.productId as string) ??
                  "(artículo eliminado)",
              }
          : null,
      };
    });
    return { items, total: filtered.length, page, pageSize: PAGE_SIZE };
  }

  /** Buscador del catálogo de Cuiner para elegir un código a mano. */
  async searchCatalog(tenantId: string, kind: string, q: string) {
    const term = q.trim();
    if (!term) {
      return [];
    }
    if (kind === "supplier") {
      const rows = await this.prisma.cuinerSupplier.findMany({
        where: {
          tenantId,
          baja: false,
          OR: [
            { codigo: { contains: term } },
            { nombre: { contains: term, mode: "insensitive" } },
            { razon: { contains: term, mode: "insensitive" } },
            { cif: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { nombre: "asc" },
        take: 20,
      });
      return rows.map((r) => ({
        codigo: r.codigo,
        nombre: r.nombre,
        detalle: r.cif,
      }));
    }
    const rows = await this.prisma.cuinerArticle.findMany({
      where: {
        tenantId,
        baja: false,
        OR: [
          { codigo: { contains: term } },
          { descripcion: { contains: term, mode: "insensitive" } },
        ],
      },
      orderBy: { descripcion: "asc" },
      take: 20,
    });
    return rows.map((r) => ({
      codigo: r.codigo,
      nombre: r.descripcion,
      detalle: r.medida ? `${r.medida} ${r.manipulacion ?? ""}`.trim() : null,
    }));
  }
}
