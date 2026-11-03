import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreatePortionCounterDto,
  LinkPortionDishDto,
  UpdatePortionCounterDto,
} from "../dto/portion-counter.dto";
import { roundPortions, thresholdState } from "../util/portion-fifo.util";
import {
  PortionLedgerService,
  activeLabelWhere,
} from "./portion-ledger.service";
import {
  counterLoadSource,
  PortionSettingsService,
} from "./portion-settings.service";

/** Faltantes (vendido sin etiquetar) que se muestran para revisar. */
const SHORTFALL_WINDOW_MS = 7 * 86_400_000;
const HISTORY_LIMIT = 100;

/**
 * Alta y consulta de contadores de raciones. Las variaciones de raciones van
 * siempre por PortionLedgerService.
 */
@Injectable()
export class PortionCounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PortionLedgerService,
    private readonly settings: PortionSettingsService,
  ) {}

  /** Pantalla «Raciones»: contadores con su disponible y lo que hay que revisar. */
  async overview(tenantId: string) {
    const counters = await this.prisma.portionCounter.findMany({
      where: { tenantId },
      include: { dishes: { orderBy: { createdAt: "asc" } } },
      orderBy: { name: "asc" },
    });
    const ids = counters.map((c) => c.id);
    const settings = await this.settings.get(tenantId);

    const [labelSums, expiredLabels, shortfalls, lastSale, dishNames] =
      await Promise.all([
        this.prisma.foodLabel.groupBy({
          by: ["portionCounterId"],
          where: {
            portionCounterId: { in: ids },
            voidedAt: null,
            retiredAt: null,
          },
          _sum: { portionsRemaining: true },
          _count: { _all: true },
        }),
        this.expiredLabelsWithPortions(tenantId),
        this.prisma.portionMovement.findMany({
          where: {
            tenantId,
            shortfall: true,
            createdAt: { gte: new Date(Date.now() - SHORTFALL_WINDOW_MS) },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            counterId: true,
            quantity: true,
            createdAt: true,
          },
        }),
        this.prisma.cuinerSaleLine.findFirst({
          where: { tenantId, status: { not: "HISTORICO" } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        this.dishNames(
          tenantId,
          counters.flatMap((c) => c.dishes),
        ),
      ]);

    const sumByCounter = new Map(
      labelSums.map((s) => [
        s.portionCounterId,
        { sum: s._sum.portionsRemaining ?? 0, count: s._count._all },
      ]),
    );

    const items = counters.map((c) => {
      const labels = sumByCounter.get(c.id) ?? { sum: 0, count: 0 };
      const available = roundPortions(c.unlabeledPortions + labels.sum);
      return {
        id: c.id,
        name: c.name,
        recipeId: c.recipeId,
        productId: c.productId,
        minPortions: c.minPortions,
        unlabeledPortions: c.unlabeledPortions,
        active: c.active,
        available,
        activeLabels: labels.count,
        state: c.active ? thresholdState(available, c.minPortions) : "ok",
        // Lo que marca el Contador de platos de Cuiner y si no cuadra.
        cuinerAvailable: c.cuinerAvailable,
        cuinerMismatch: c.active && c.cuinerMismatchNotifiedAt !== null,
        // TPV = se carga en Cuiner; ChefChek no deja recontar ni ajustar.
        loadSource: counterLoadSource(settings, c.dishes),
        dishes: c.dishes.map((d) => ({
          id: d.id,
          tipo: d.tipo,
          producto: d.producto,
          portionsPerSale: d.portionsPerSale,
          perPiece: d.perPiece,
          name: dishNames.get(`${d.tipo}|${d.producto}`) ?? null,
        })),
      };
    });

    const nameById = new Map(counters.map((c) => [c.id, c.name]));
    const checked = counters
      .map((c) => c.cuinerCheckedAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    return {
      counters: items,
      expiredLabels,
      shortfalls: shortfalls.map((s) => ({
        ...s,
        quantity: -s.quantity,
        counterName: nameById.get(s.counterId) ?? "—",
      })),
      salesReceivedUntil: lastSale?.createdAt ?? null,
      // Última comparación con el Contador de platos de Cuiner (enlace en vivo).
      cuinerCheckedAt: checked ? new Date(checked) : null,
    };
  }

  /** Detalle: etiquetas activas (en orden FIFO) e historial de movimientos. */
  async detail(tenantId: string, counterId: string) {
    const counter = await this.findOrThrow(tenantId, counterId);
    const [labels, movements, available] = await Promise.all([
      this.prisma.foodLabel.findMany({
        where: { ...activeLabelWhere(counterId), tenantId },
        orderBy: [{ preparedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          lotNumber: true,
          itemName: true,
          preparedAt: true,
          useByDate: true,
          frozenUseByDate: true,
          portions: true,
          portionsRemaining: true,
          createdByName: true,
        },
      }),
      this.prisma.portionMovement.findMany({
        where: { tenantId, counterId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      this.ledger.available(this.prisma, counterId),
    ]);
    return { id: counter.id, name: counter.name, available, labels, movements };
  }

  async create(tenantId: string, dto: CreatePortionCounterDto) {
    if (Boolean(dto.recipeId) === Boolean(dto.productId)) {
      throw new BadRequestException(
        "Elige una receta o un artículo (uno de los dos).",
      );
    }
    const source = dto.recipeId
      ? await this.prisma.recipe.findFirst({
          where: { id: dto.recipeId, tenantId },
          select: { name: true },
        })
      : await this.prisma.product.findFirst({
          where: { id: dto.productId, tenantId },
          select: { name: true },
        });
    if (!source) {
      throw new NotFoundException(
        dto.recipeId ? "Receta no encontrada" : "Artículo no encontrado",
      );
    }
    try {
      return await this.prisma.portionCounter.create({
        data: {
          tenantId,
          name: dto.name?.trim() || source.name,
          recipeId: dto.recipeId ?? null,
          productId: dto.productId ?? null,
          minPortions: dto.minPortions ?? 0,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(`«${source.name}» ya tiene contador.`);
      }
      throw err;
    }
  }

  async update(
    tenantId: string,
    counterId: string,
    dto: UpdatePortionCounterDto,
  ) {
    await this.findOrThrow(tenantId, counterId);
    const updated = await this.prisma.portionCounter.update({
      where: { id: counterId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.minPortions !== undefined
          ? { minPortions: dto.minPortions }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    // Cambiar el mínimo puede hacer cruzar el umbral.
    await this.ledger.refreshAlerts(tenantId, [counterId]);
    return updated;
  }

  async linkDish(tenantId: string, counterId: string, dto: LinkPortionDishDto) {
    await this.findOrThrow(tenantId, counterId);
    const existing = await this.prisma.portionCounterDish.findUnique({
      where: {
        tenantId_tipo_producto: {
          tenantId,
          tipo: dto.tipo,
          producto: dto.producto,
        },
      },
      include: { counter: { select: { name: true } } },
    });
    if (existing) {
      throw new ConflictException(
        `Ese plato ya gasta raciones de «${existing.counter.name}».`,
      );
    }
    return this.prisma.portionCounterDish.create({
      data: {
        tenantId,
        counterId,
        tipo: dto.tipo,
        producto: dto.producto,
        portionsPerSale: dto.portionsPerSale ?? 1,
        perPiece: dto.perPiece ?? false,
      },
    });
  }

  async unlinkDish(tenantId: string, counterId: string, dishId: string) {
    const { count } = await this.prisma.portionCounterDish.deleteMany({
      where: { id: dishId, counterId, tenantId },
    });
    if (!count) {
      throw new NotFoundException("Plato no enlazado");
    }
    return { removed: true };
  }

  /** «Siguen disponibles»: oculta el aviso de caducidad de esa etiqueta. */
  async acknowledgeExpired(tenantId: string, labelId: string) {
    const { count } = await this.prisma.foodLabel.updateMany({
      where: { id: labelId, tenantId, portionCounterId: { not: null } },
      data: { portionsExpiryAckAt: new Date() },
    });
    if (!count) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    return { acknowledged: true };
  }

  /** Platos de Cuiner para el buscador (platos y menús, no modificadores). */
  searchCuinerDishes(tenantId: string, q: string) {
    const term = q.trim();
    return this.prisma.cuinerDish.findMany({
      where: {
        tenantId,
        tipo: { in: ["P", "M"] },
        ...(term
          ? {
              OR: [
                { nombre: { contains: term, mode: "insensitive" } },
                { producto: { startsWith: term } },
              ],
            }
          : {}),
      },
      orderBy: { nombre: "asc" },
      take: 30,
      select: { tipo: true, producto: true, nombre: true, familia: true },
    });
  }

  private async findOrThrow(tenantId: string, counterId: string) {
    const counter = await this.prisma.portionCounter.findFirst({
      where: { id: counterId, tenantId },
    });
    if (!counter) {
      throw new NotFoundException("Contador no encontrado");
    }
    return counter;
  }

  /**
   * Etiquetas caducadas que aún tienen raciones y nadie ha confirmado. La
   * caducidad no descuenta: solo pregunta «¿siguen disponibles?».
   */
  private async expiredLabelsWithPortions(tenantId: string) {
    const now = new Date();
    const labels = await this.prisma.foodLabel.findMany({
      where: {
        tenantId,
        portionCounterId: { not: null },
        portionsRemaining: { gt: 0 },
        voidedAt: null,
        retiredAt: null,
        portionsExpiryAckAt: null,
        OR: [
          { frozenUseByDate: { lt: now } },
          { frozenUseByDate: null, useByDate: { lt: now } },
        ],
      },
      orderBy: { useByDate: "asc" },
      select: {
        id: true,
        itemName: true,
        lotNumber: true,
        useByDate: true,
        frozenUseByDate: true,
        portionsRemaining: true,
        portionCounterId: true,
      },
    });
    return labels;
  }

  private async dishNames(
    tenantId: string,
    dishes: { tipo: string; producto: string }[],
  ) {
    if (!dishes.length) {
      return new Map<string, string>();
    }
    const rows = await this.prisma.cuinerDish.findMany({
      where: {
        tenantId,
        OR: dishes.map((d) => ({ tipo: d.tipo, producto: d.producto })),
      },
      select: { tipo: true, producto: true, nombre: true },
    });
    return new Map(rows.map((r) => [`${r.tipo}|${r.producto}`, r.nombre]));
  }
}
