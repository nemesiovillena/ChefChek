import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { TrashType } from "./dto/trash.dto";

export interface TrashItem {
  id: string;
  type: TrashType;
  label: string;
  secondary?: string | null;
  deletedAt: string;
}

interface EntityMeta {
  /** Nombre físico de la tabla (lowercase, sin comillas). */
  table: string;
  /** Delegate de Prisma en camelCase (prisma[model].updateMany). */
  model: string;
  /** Columna SQL del campo a mostrar como título (ya entre comillas dobles). */
  labelCol: string;
  /** Columna SQL secundaria (entre comillas dobles) o "NULL". */
  secondaryCol: string;
  /** Sustantivo humanizado para mensajes ("artículo", "receta"...). */
  labelName: string;
}

interface Dependent {
  table: string;
  /** Columna FK (camelCase, se envuelve en comillas en el SQL). */
  col: string;
  /** Descripción del conjunto dependiente para el mensaje. */
  label: string;
}

/**
 * Mapa estático de metadatos por tipo. ES LA ÚNICA FUENTE de nombres de
 * tabla/columna permitidos: el `type` que llega del cliente se valida contra
 * estas claves y NUNCA se interpola input de usuario en el SQL (identificadores
 * por {@link Prisma.raw}, valores por parámetros `${}`).
 */
const TRASH_ENTITIES: Record<TrashType, EntityMeta> = {
  product: {
    table: "products",
    model: "product",
    labelCol: '"name"',
    secondaryCol: '"brand"',
    labelName: "artículo",
  },
  recipe: {
    table: "recipes",
    model: "recipe",
    labelCol: '"name"',
    secondaryCol: "NULL",
    labelName: "receta",
  },
  albaran: {
    table: "albaranes",
    model: "albaran",
    labelCol: '"internalNumber"',
    secondaryCol: '"albaranNumber"',
    labelName: "albarán",
  },
  category: {
    table: "categories",
    model: "category",
    labelCol: '"name"',
    secondaryCol: '"context"',
    labelName: "categoría",
  },
  supplier: {
    table: "suppliers",
    model: "supplier",
    labelCol: '"name"',
    secondaryCol: '"cifNif"',
    labelName: "proveedor",
  },
  user: {
    table: "users",
    model: "user",
    labelCol: '"email"',
    secondaryCol: '"name"',
    labelName: "usuario",
  },
  sprint: {
    table: "sprints",
    model: "sprint",
    labelCol: '"name"',
    secondaryCol: '"status"',
    labelName: "sprint",
  },
  task: {
    table: "tasks",
    model: "task",
    labelCol: '"title"',
    secondaryCol: '"status"',
    labelName: "tarea",
  },
  warehouse: {
    table: "warehouses",
    model: "warehouse",
    labelCol: '"name"',
    secondaryCol: '"location"',
    labelName: "almacén",
  },
};

/**
 * Tablas con FK en CASCADA hacia la entidad cuyo borrado físico destruiría
 * datos pertenecientes a OTRO agregado (p. ej. un ingrediente de una receta).
 * El purge se bloquea si hay referencias. No se listan:
 *  - FK con SetNull (products.categoryId/supplierId, stock.warehouseId): seguras.
 *  - Hijos propios del agregado (líneas de albaran, ingredientes de la receta):
 *    su cascada es esperada al purgar el padre.
 *  - FK Restrict (user en knowledge): se capturan a nivel de BD (P2003).
 */
const DEPENDENTS: Record<TrashType, Dependent[]> = {
  product: [
    { table: "recipe_ingredients", col: "productId", label: "recetas" },
  ],
  recipe: [
    {
      table: "recipe_sub_recipes",
      col: "subRecipeId",
      label: "otras recetas (como sub-receta)",
    },
    { table: "menu_items", col: "recipeId", label: "menús" },
    {
      table: "menu_section_items",
      col: "recipeId",
      label: "secciones de menú",
    },
  ],
  albaran: [],
  category: [],
  supplier: [],
  user: [],
  sprint: [{ table: "tasks", col: "sprintId", label: "tareas" }],
  task: [],
  warehouse: [
    { table: "inventories", col: "warehouseId", label: "inventarios" },
  ],
};

@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lista los elementos en papelera de un tipo (deletedAt NOT NULL) para el tenant. */
  async listTrashed(type: string, tenantId: string): Promise<TrashItem[]> {
    const meta = this.getMeta(type);
    // SQL crudo: el middleware de soft-delete filtra deletedAt=null en find*,
    // así que para ver la papelera hay que saltárselo. Columnas camelCase entre
    // comillas dobles; tenantId parametrizado.
    const rows = await this.prisma.$queryRaw<
      { id: string; label: string; secondary: string | null; deletedAt: Date }[]
    >`
      SELECT id,
             ${Prisma.raw(meta.labelCol)} AS label,
             ${Prisma.raw(meta.secondaryCol)} AS secondary,
             "deletedAt"
      FROM ${Prisma.raw(meta.table)}
      WHERE "tenantId" = ${tenantId}
        AND "deletedAt" IS NOT NULL
      ORDER BY "deletedAt" DESC
      LIMIT 500
    `;

    return rows.map((r) => ({
      id: r.id,
      type: type as TrashType,
      label: r.label,
      secondary: r.secondary ?? undefined,
      deletedAt: r.deletedAt.toISOString(),
    }));
  }

  /** Recupera un elemento: pone deletedAt a null (soft-restore). */
  async restore(
    type: string,
    id: string,
    tenantId: string,
  ): Promise<{ id: string; restored: boolean }> {
    const meta = this.getMeta(type);
    // delegate dinámico (prisma.product, prisma.recipe, ...). El modelo viene
    // del mapa estático, nunca del cliente.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (this.prisma as any)[meta.model];

    try {
      // updateMany no está interceptado por el soft-delete → opera sobre la fila
      // borrada. Se scopea por tenantId; deletedAt:{not:null} evita "recuperar"
      // algo que no estaba borrado.
      const res = await delegate.updateMany({
        where: { id, tenantId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (res.count === 0) {
        throw new NotFoundException(
          `${meta.labelName} no encontrado en la papelera.`,
        );
      }
      return { id, restored: true };
    } catch (error) {
      this.assertRestoreError(error, meta.labelName);
    }
  }

  /**
   * Borrado definitivo (hard delete) GUARDADO: dentro de una transacción
   * comprueba que no haya dependencias en cascada que dañen otros agregados;
   * si las hay, bloquea. Sin dependencias → DELETE físico (los hijos propios
   * con onDelete:Cascade se borran con el padre, lo cual es esperado en un purge).
   */
  async purge(
    type: string,
    id: string,
    tenantId: string,
  ): Promise<{ id: string; purged: boolean }> {
    const meta = this.getMeta(type);
    const deps = DEPENDENTS[type];

    try {
      const affected = await this.prisma.$transaction(async (tx) => {
        for (const dep of deps) {
          const count = await tx.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n
            FROM ${Prisma.raw(dep.table)}
            WHERE ${Prisma.raw(`"${dep.col}"`)} = ${id}
          `;
          const n = count[0]?.n ?? 0;
          if (n > 0) {
            throw new ConflictException(
              `No se puede borrar definitivamente: hay ${n} elemento(s) en ${dep.label} que dependen de este ${meta.labelName}.`,
            );
          }
        }
        return tx.$executeRaw`
          DELETE FROM ${Prisma.raw(meta.table)}
          WHERE id = ${id} AND "tenantId" = ${tenantId}
        `;
      });

      if (affected === 0) {
        throw new NotFoundException(
          `${meta.labelName} no encontrado en la papelera.`,
        );
      }
      this.logger.log(`Purged ${meta.labelName} ${id} (tenant ${tenantId})`);
      return { id, purged: true };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // FK Restrict residual (p. ej. user referenciado por knowledge).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ConflictException(
          `No se puede borrar definitivamente: hay datos que dependen de este ${meta.labelName}.`,
        );
      }
      throw error;
    }
  }

  private getMeta(type: string): EntityMeta {
    const meta = TRASH_ENTITIES[type as TrashType];
    if (!meta) {
      throw new BadRequestException(`Tipo no válido: ${type}`);
    }
    return meta;
  }

  private assertRestoreError(error: unknown, labelName: string): never {
    if (error instanceof NotFoundException) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Al recuperar se viola una única (otro registro vivo con mismo valor).
      throw new BadRequestException(
        `No se puede recuperar: ya existe ${labelName} con el mismo valor único (nombre/email/número). Renómbralo antes de recuperar.`,
      );
    }
    throw error;
  }
}
