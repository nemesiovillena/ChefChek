import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PortionMovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import {
  allocateFifo,
  portionsForSale,
  roundPortions,
  thresholdState,
} from "../util/portion-fifo.util";
import {
  cuinerRegistroChange,
  type CuinerRegistroRow,
} from "../util/cuiner-registro-change.util";
import {
  counterLoadSource,
  PortionLoadSource,
  PortionSettingsService,
} from "./portion-settings.service";

type Tx = Prisma.TransactionClient;

export interface PortionActor {
  id: string;
  name?: string | null;
}

/** Ventas recientes que se revisan en cada pasada (cubre caídas de días). */
const SALES_LOOKBACK_MS = 7 * 86_400_000;

export const RACIONES_MODULE_ID = "raciones";

/** Cargas hechas en ChefChek (para detectar una posible carga doble). */
const CHEFCHEK_LOAD_TYPES: PortionMovementType[] = [
  PortionMovementType.LABEL_IN,
  PortionMovementType.RECOUNT,
  PortionMovementType.ADJUST,
];

/** Cambios hechos en ChefChek: con el enlace en vivo se llevan a Cuiner. */
const CHEFCHEK_ORIGIN = new Set<PortionMovementType>([
  PortionMovementType.LABEL_IN,
  PortionMovementType.LABEL_EDIT,
  PortionMovementType.RETIRE,
  PortionMovementType.UNRETIRE,
  PortionMovementType.VOID,
  PortionMovementType.ADJUST,
  PortionMovementType.RECOUNT,
]);

/**
 * Libro de raciones. Toda variación de raciones pasa por aquí y deja un
 * PortionMovement. El disponible de un contador = raciones sin etiqueta +
 * raciones que quedan en sus etiquetas activas; nunca se guarda un total.
 *
 * Cada escritura toma un bloqueo por tenant (pg_advisory_xact_lock) para que
 * una venta y una retirada simultáneas no gasten la misma ración dos veces.
 */
@Injectable()
export class PortionLedgerService {
  private readonly logger = new Logger(PortionLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: ModulesService,
    private readonly notifications: NotificationsService,
    private readonly settings: PortionSettingsService,
  ) {}

  /** Cómo se carga este contador según Configuración → Contador de platos. */
  async loadSourceOf(
    client: Tx | PrismaService,
    tenantId: string,
    counterId: string,
  ): Promise<PortionLoadSource> {
    const [settings, dishes] = await Promise.all([
      this.settings.get(tenantId, client),
      client.portionCounterDish.findMany({
        where: { counterId },
        select: { tipo: true, perPiece: true },
      }),
    ]);
    return counterLoadSource(settings, dishes);
  }

  /** Los contadores que se cargan en el TPV no admiten cargas desde ChefChek. */
  private async assertLoadableHere(
    client: Tx | PrismaService,
    tenantId: string,
    counterId: string,
  ) {
    if ((await this.loadSourceOf(client, tenantId, counterId)) !== "TPV") {
      return;
    }
    const counter = await client.portionCounter.findUniqueOrThrow({
      where: { id: counterId },
      select: { name: true },
    });
    throw new BadRequestException(
      `«${counter.name}» se carga en el Contador de platos de Cuiner; ChefChek solo lo muestra.`,
    );
  }

  private async lock(tx: Tx, tenantId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`raciones:${tenantId}`}))`;
  }

  isEnabled(tenantId: string) {
    return this.modules.isModuleEnabled(tenantId, RACIONES_MODULE_ID);
  }

  // ── Etiquetas ─────────────────────────────────────────────────────────

  /**
   * Antes de emitir una etiqueta: contador activo de su receta o artículo.
   * Si lo tiene, las raciones son obligatorias. null = la etiqueta no cuenta.
   */
  async counterForNewLabel(
    tenantId: string,
    target: { recipeId?: string | null; productId?: string | null },
    portions: number | null | undefined,
  ): Promise<string | null> {
    if (!target.recipeId && !target.productId) {
      return null;
    }
    if (!(await this.isEnabled(tenantId))) {
      return null;
    }
    const counter = await this.prisma.portionCounter.findFirst({
      where: {
        tenantId,
        active: true,
        ...(target.recipeId
          ? { recipeId: target.recipeId }
          : { productId: target.productId }),
      },
      select: { id: true, name: true },
    });
    // Se carga en el TPV: la etiqueta solo sirve de trazabilidad.
    if (
      !counter ||
      (await this.loadSourceOf(this.prisma, tenantId, counter.id)) === "TPV"
    ) {
      return null;
    }
    if (!(portions && portions > 0)) {
      throw new BadRequestException(
        `«${counter.name}» lleva contador de platos: indica cuántas raciones salen de esta etiqueta.`,
      );
    }
    return counter.id;
  }

  /**
   * Para el formulario de etiqueta: contador activo de la receta/artículo y
   * sus raciones disponibles, o null si no cuenta.
   */
  async counterSummary(
    tenantId: string,
    target: { recipeId?: string | null; productId?: string | null },
  ): Promise<{ id: string; name: string; available: number } | null> {
    if (!target.recipeId && !target.productId) {
      return null;
    }
    if (!(await this.isEnabled(tenantId))) {
      return null;
    }
    const counter = await this.prisma.portionCounter.findFirst({
      where: {
        tenantId,
        active: true,
        ...(target.recipeId
          ? { recipeId: target.recipeId }
          : { productId: target.productId }),
      },
      select: { id: true, name: true },
    });
    if (
      !counter ||
      (await this.loadSourceOf(this.prisma, tenantId, counter.id)) === "TPV"
    ) {
      return null;
    }
    return {
      ...counter,
      available: await this.available(this.prisma, counter.id),
    };
  }

  /** Registra la entrada de una etiqueta recién emitida (ya con sus raciones). */
  async recordLabelIn(
    tenantId: string,
    label: {
      id: string;
      portionCounterId: string | null;
      portionsRemaining: number | null;
    },
    actor: PortionActor,
  ) {
    if (!label.portionCounterId || !label.portionsRemaining) {
      return;
    }
    await this.movement(this.prisma, tenantId, label.portionCounterId, {
      type: PortionMovementType.LABEL_IN,
      foodLabelId: label.id,
      quantity: label.portionsRemaining,
      actor,
    });
    await this.refreshAlerts(tenantId, [label.portionCounterId]);
  }

  /**
   * Corrección de raciones de una etiqueta (mismo día). Mueve lo que quede
   * por la diferencia, sin bajar de 0. Devuelve el contador afectado.
   */
  async onLabelPortionsEdited(
    tx: Tx,
    tenantId: string,
    label: {
      id: string;
      portionCounterId: string | null;
      portionsRemaining: number | null;
      portions: number | null;
    },
    newPortions: number | null | undefined,
    actor: PortionActor,
  ): Promise<string | null> {
    if (!label.portionCounterId || label.portionsRemaining === null) {
      return null;
    }
    if (!(newPortions && newPortions > 0)) {
      throw new BadRequestException(
        "Esta etiqueta lleva contador de platos: las raciones no pueden quedar vacías.",
      );
    }
    const delta = roundPortions(newPortions - (label.portions ?? 0));
    if (delta === 0) {
      return null;
    }
    await this.lock(tx, tenantId);
    const current = await tx.foodLabel.findUniqueOrThrow({
      where: { id: label.id },
      select: { portionsRemaining: true },
    });
    const before = current.portionsRemaining ?? 0;
    const after = Math.max(0, roundPortions(before + delta));
    await tx.foodLabel.update({
      where: { id: label.id },
      data: { portionsRemaining: after },
    });
    await this.movement(tx, tenantId, label.portionCounterId, {
      type: PortionMovementType.LABEL_EDIT,
      foodLabelId: label.id,
      quantity: roundPortions(after - before),
      reason: `Raciones de la etiqueta: ${label.portions ?? 0} → ${newPortions}`,
      actor,
    });
    return label.portionCounterId;
  }

  /**
   * Retirada o anulación: las raciones que queden en esas etiquetas salen del
   * contador. Devuelve los contadores afectados (para los avisos).
   */
  async releaseLabels(
    tx: Tx,
    tenantId: string,
    labelIds: string[],
    type: "RETIRE" | "VOID",
    actor: PortionActor,
  ): Promise<string[]> {
    if (!labelIds.length) {
      return [];
    }
    await this.lock(tx, tenantId);
    const labels = await tx.foodLabel.findMany({
      where: {
        tenantId,
        id: { in: labelIds },
        portionCounterId: { not: null },
        portionsRemaining: { gt: 0 },
      },
      select: { id: true, portionCounterId: true, portionsRemaining: true },
    });
    for (const label of labels) {
      await tx.foodLabel.update({
        where: { id: label.id },
        data: { portionsRemaining: 0 },
      });
      await this.movement(tx, tenantId, label.portionCounterId!, {
        type: PortionMovementType[type],
        foodLabelId: label.id,
        quantity: -(label.portionsRemaining ?? 0),
        actor,
      });
    }
    return [...new Set(labels.map((l) => l.portionCounterId!))];
  }

  /** Deshacer retirada: devuelve lo que se quitó en la última retirada. */
  async restoreLabel(
    tx: Tx,
    tenantId: string,
    labelId: string,
    actor: PortionActor,
  ): Promise<string | null> {
    await this.lock(tx, tenantId);
    const last = await tx.portionMovement.findFirst({
      where: {
        tenantId,
        foodLabelId: labelId,
        type: {
          in: [PortionMovementType.RETIRE, PortionMovementType.UNRETIRE],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!last || last.type !== PortionMovementType.RETIRE) {
      return null;
    }
    const quantity = -last.quantity;
    await tx.foodLabel.update({
      where: { id: labelId },
      data: { portionsRemaining: { increment: quantity } },
    });
    await this.movement(tx, tenantId, last.counterId, {
      type: PortionMovementType.UNRETIRE,
      foodLabelId: labelId,
      quantity,
      actor,
    });
    return last.counterId;
  }

  // ── Ajustes manuales ──────────────────────────────────────────────────

  /** +/− raciones con motivo. Lo positivo entra como «sin etiqueta». */
  async adjust(
    tenantId: string,
    counterId: string,
    delta: number,
    reason: string,
    actor: PortionActor,
  ) {
    const amount = roundPortions(delta);
    if (amount === 0) {
      throw new BadRequestException("El ajuste no puede ser 0.");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, tenantId);
      await this.loadCounter(tx, tenantId, counterId);
      await this.assertLoadableHere(tx, tenantId, counterId);
      if (amount < 0) {
        const available = await this.available(tx, counterId);
        if (-amount > available) {
          throw new BadRequestException(
            `Solo quedan ${available} raciones. Si la cifra real es otra, haz un recuento.`,
          );
        }
      }
      await this.applyDelta(tx, tenantId, counterId, amount, {
        type: PortionMovementType.ADJUST,
        reason,
        actor,
      });
    });
    await this.refreshAlerts(tenantId, [counterId]);
  }

  /** Recuento: se escribe la cifra real y el contador se corrige. */
  async recount(
    tenantId: string,
    counterId: string,
    actual: number,
    reason: string | undefined,
    actor: PortionActor,
  ) {
    if (actual < 0) {
      throw new BadRequestException("El recuento no puede ser negativo.");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, tenantId);
      await this.loadCounter(tx, tenantId, counterId);
      await this.assertLoadableHere(tx, tenantId, counterId);
      const before = await this.available(tx, counterId);
      const delta = roundPortions(actual - before);
      if (delta === 0) {
        return;
      }
      const note = `Recuento: ${before} → ${roundPortions(actual)}`;
      await this.applyDelta(tx, tenantId, counterId, delta, {
        type: PortionMovementType.RECOUNT,
        reason: reason?.trim() ? `${note}. ${reason.trim()}` : note,
        actor,
      });
    });
    await this.refreshAlerts(tenantId, [counterId]);
  }

  // ── Ventas de Cuiner ──────────────────────────────────────────────────

  /**
   * Descuenta las ventas recibidas de Cuiner de los platos enlazados a un
   * contador. Idempotente: una línea con movimientos ya no se vuelve a
   * aplicar. Solo cuentan las líneas recibidas después de enlazar el plato.
   * Nunca lanza: si falla, se reintenta en la siguiente ingesta.
   */
  async applySales(tenantId: string): Promise<number> {
    try {
      return await this.applySalesUnsafe(tenantId);
    } catch (err) {
      this.logger.error(
        `No se pudieron aplicar ventas al contador de raciones (${tenantId}): ${(err as Error).message}`,
      );
      return 0;
    }
  }

  private async applySalesUnsafe(tenantId: string): Promise<number> {
    if (!(await this.isEnabled(tenantId))) {
      return 0;
    }
    // Enlace en vivo con el Contador de platos de Cuiner: ya descuenta al
    // pedir (applyCuinerRegistro); lo cobrado no debe restar otra vez.
    const live = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
      select: { portionCursor: true },
    });
    if (live && live.portionCursor !== null) {
      return 0;
    }
    const dishes = await this.prisma.portionCounterDish.findMany({
      where: { tenantId, counter: { active: true } },
    });
    if (!dishes.length) {
      return 0;
    }
    const dishByKey = new Map(
      dishes.map((d) => [`${d.tipo}|${d.producto}`, d]),
    );
    const earliestLink = Math.min(...dishes.map((d) => d.createdAt.getTime()));
    const since = new Date(
      Math.max(earliestLink, Date.now() - SALES_LOOKBACK_MS),
    );

    const lines = await this.prisma.cuinerSaleLine.findMany({
      where: {
        tenantId,
        anulada: false,
        status: { not: "HISTORICO" },
        createdAt: { gte: since },
        OR: dishes.map((d) => ({ tipo: d.tipo, producto: d.producto })),
      },
      orderBy: [{ idVentasCab: "asc" }, { linea: "asc" }],
      select: {
        id: true,
        tipo: true,
        producto: true,
        unidades: true,
        createdAt: true,
      },
    });
    const candidates = lines.filter((line) => {
      const dish = dishByKey.get(`${line.tipo}|${line.producto}`);
      return dish && line.createdAt >= dish.createdAt;
    });
    if (!candidates.length) {
      return 0;
    }

    const touched = new Set<string>();
    let applied = 0;
    await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, tenantId);
        // Dentro del bloqueo: otra pasada pudo aplicar alguna entretanto.
        const done = await tx.portionMovement.findMany({
          where: {
            tenantId,
            cuinerSaleLineId: { in: candidates.map((l) => l.id) },
          },
          select: { cuinerSaleLineId: true },
          distinct: ["cuinerSaleLineId"],
        });
        const doneIds = new Set(done.map((m) => m.cuinerSaleLineId));
        for (const line of candidates) {
          if (doneIds.has(line.id)) {
            continue;
          }
          const dish = dishByKey.get(`${line.tipo}|${line.producto}`)!;
          const portions = portionsForSale(
            line.unidades,
            dish.portionsPerSale,
            dish.perPiece,
          );
          if (portions === 0) {
            continue;
          }
          await this.applyDelta(tx, tenantId, dish.counterId, -portions, {
            type: PortionMovementType.SALE,
            cuinerSaleLineId: line.id,
          });
          touched.add(dish.counterId);
          applied++;
        }
      },
      { timeout: 30_000 },
    );
    await this.refreshAlerts(tenantId, [...touched]);
    return applied;
  }

  // ── Contador de platos de Cuiner en vivo ──────────────────────────────

  /**
   * Aplica el historial del Contador de platos de Cuiner (es_registro):
   * pedidos y anulaciones descuentan al pedir; las cargas hechas en Cuiner
   * suman. Lo que escribió ChefChek (cajero «ChefChek») ya está contado.
   * Solo avanza si el lote empieza donde quedó el anterior: un lote repetido
   * o desordenado no se aplica dos veces.
   */
  async applyCuinerRegistro(
    tenantId: string,
    cursorFrom: number,
    cursorTo: number,
    rows: CuinerRegistroRow[],
  ): Promise<{ applied: number; cursor: number | null }> {
    const touched = new Set<string>();
    const doubleChecks: { counterId: string; quantity: number }[] = [];
    let applied = 0;
    const cursor = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, tenantId);
        const config = await tx.cuinerConfig.findUnique({
          where: { tenantId },
          select: { portionCursor: true },
        });
        if (!config || config.portionCursor !== cursorFrom) {
          return config?.portionCursor ?? null;
        }
        const dishes = await tx.portionCounterDish.findMany({
          where: { tenantId, counter: { active: true } },
        });
        const dishByPlato = new Map(
          dishes.filter((d) => d.tipo === "P").map((d) => [d.producto, d]),
        );
        const settings = await this.settings.get(tenantId, tx);
        const sourceOf = (counterId: string) =>
          counterLoadSource(
            settings,
            dishes.filter((d) => d.counterId === counterId),
          );
        const ordered = rows
          .filter((r) => r.id > cursorFrom && r.id <= cursorTo)
          .sort((a, b) => a.id - b.id);
        for (const row of ordered) {
          const dish = dishByPlato.get(row.plato);
          const change = dish && cuinerRegistroChange(row, dish);
          if (!dish || !change) {
            continue;
          }
          const source = sourceOf(dish.counterId);
          // «Solo en ChefChek»: lo cargado en el TPV no cuenta aquí.
          if (
            change.type === PortionMovementType.CUINER_LOAD &&
            source === "CHEFCHEK"
          ) {
            continue;
          }
          await this.applyDelta(tx, tenantId, dish.counterId, change.delta, {
            type: change.type,
            reason: change.reason,
            cuinerRegistroId: row.id,
          });
          if (
            change.type === PortionMovementType.CUINER_LOAD &&
            change.delta > 0 &&
            source === "BOTH"
          ) {
            doubleChecks.push({
              counterId: dish.counterId,
              quantity: change.delta,
            });
          }
          touched.add(dish.counterId);
          applied++;
        }
        await tx.cuinerConfig.update({
          where: { tenantId },
          data: { portionCursor: cursorTo },
        });
        return cursorTo;
      },
      { timeout: 30_000 },
    );
    await this.refreshAlerts(tenantId, [...touched]);
    for (const check of doubleChecks) {
      await this.warnIfDoubleLoad(
        tenantId,
        check.counterId,
        "TPV",
        check.quantity,
      );
    }
    return { applied, cursor };
  }

  /**
   * «Se carga en el TPV»: ChefChek se iguala a lo que marca Cuiner. Queda en
   * el historial como un movimiento de Cuiner (no se vuelve a escribir allí).
   */
  async alignToCuiner(tenantId: string, counterId: string, target: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, tenantId);
      const before = await this.available(tx, counterId);
      const delta = roundPortions(Math.max(0, target) - before);
      if (delta === 0) {
        return;
      }
      await this.applyDelta(tx, tenantId, counterId, delta, {
        type: PortionMovementType.CUINER_LOAD,
        reason: `Igualado al Contador de platos de Cuiner: ${before} → ${roundPortions(Math.max(0, target))}`,
      });
    });
    await this.refreshAlerts(tenantId, [counterId]);
  }

  /**
   * «En los dos»: si el mismo contador recibe una carga desde ChefChek y otra
   * desde el TPV dentro de la ventana configurada, puede ser la misma
   * mercancía cargada dos veces. Avisa con las dos cargas.
   */
  async warnIfDoubleLoad(
    tenantId: string,
    counterId: string,
    side: "CHEFCHEK" | "TPV",
    quantity: number,
  ) {
    try {
      const { doubleLoadHours } = await this.settings.get(tenantId);
      const since = new Date(Date.now() - doubleLoadHours * 3_600_000);
      const other = await this.prisma.portionMovement.findFirst({
        where: {
          tenantId,
          counterId,
          createdAt: { gte: since },
          quantity: { gt: 0 },
          ...(side === "TPV"
            ? { type: { in: CHEFCHEK_LOAD_TYPES } }
            : {
                type: PortionMovementType.CUINER_LOAD,
                cuinerRegistroId: { not: null },
              }),
        },
        orderBy: { createdAt: "desc" },
      });
      if (!other) {
        return;
      }
      const counter = await this.prisma.portionCounter.findUniqueOrThrow({
        where: { id: counterId },
        select: { name: true },
      });
      const hhmm = (d: Date) =>
        new Intl.DateTimeFormat("es-ES", {
          timeZone: "Europe/Madrid",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d);
      const otherWho = other.userName ?? other.reason ?? "";
      const here = side === "TPV" ? "Cuiner" : "ChefChek";
      const there = side === "TPV" ? "ChefChek" : "Cuiner";
      await this.notifications.createNotification(tenantId, {
        type: "PORTIONS_DOUBLE_LOAD",
        title: `¿Carga doble? ${counter.name}`,
        message: `Se han cargado +${roundPortions(quantity)} en ${here} ahora y +${other.quantity} en ${there} a las ${hhmm(other.createdAt)}${otherWho ? ` (${otherWho})` : ""}. Si es la misma mercancía, haz un recuento.`,
        severity: "HIGH",
        entityType: "portion-counter",
        entityId: counterId,
      });
    } catch (err) {
      this.logger.warn(
        `Aviso de carga doble no enviado (${counterId}): ${(err as Error).message}`,
      );
    }
  }

  // ── Disponible y avisos ───────────────────────────────────────────────

  /** Raciones disponibles: sin etiqueta + lo que queda en etiquetas activas. */
  async available(client: Tx | PrismaService, counterId: string) {
    const [counter, labels] = await Promise.all([
      client.portionCounter.findUniqueOrThrow({
        where: { id: counterId },
        select: { unlabeledPortions: true },
      }),
      client.foodLabel.aggregate({
        where: activeLabelWhere(counterId),
        _sum: { portionsRemaining: true },
      }),
    ]);
    return roundPortions(
      counter.unlabeledPortions + (labels._sum.portionsRemaining ?? 0),
    );
  }

  /**
   * Avisa en la campana (cocina y sala la ven) al cruzar el mínimo o agotarse.
   * Cada aviso se manda una vez; se rearma al volver a superar el umbral.
   */
  async refreshAlerts(tenantId: string, counterIds: string[]) {
    for (const counterId of new Set(counterIds)) {
      try {
        await this.refreshCounterAlert(tenantId, counterId);
      } catch (err) {
        this.logger.warn(
          `Aviso de raciones no enviado (${counterId}): ${(err as Error).message}`,
        );
      }
    }
  }

  private async refreshCounterAlert(tenantId: string, counterId: string) {
    const counter = await this.prisma.portionCounter.findFirst({
      where: { id: counterId, tenantId },
    });
    if (!counter || !counter.active) {
      return;
    }
    const available = await this.available(this.prisma, counterId);
    const state = thresholdState(available, counter.minPortions);

    if (state === "out" && !counter.outNotifiedAt) {
      await this.notifications.createNotification(tenantId, {
        type: "PORTIONS_OUT",
        title: `Agotado: ${counter.name}`,
        message: `No quedan raciones de ${counter.name}.`,
        severity: "CRITICAL",
        entityType: "portion-counter",
        entityId: counter.id,
      });
      await this.prisma.portionCounter.update({
        where: { id: counter.id },
        data: {
          outNotifiedAt: new Date(),
          belowMinNotifiedAt: counter.belowMinNotifiedAt ?? new Date(),
        },
      });
      return;
    }
    if (state === "low" && !counter.belowMinNotifiedAt) {
      await this.notifications.createNotification(tenantId, {
        type: "PORTIONS_LOW",
        title: `Quedan pocas: ${counter.name}`,
        message: `Quedan ${available} raciones de ${counter.name} (mínimo ${counter.minPortions}).`,
        severity: "HIGH",
        entityType: "portion-counter",
        entityId: counter.id,
      });
    }
    const belowMinNotifiedAt =
      state === "ok" ? null : (counter.belowMinNotifiedAt ?? new Date());
    const outNotifiedAt = state === "out" ? counter.outNotifiedAt : null;
    if (
      belowMinNotifiedAt?.getTime() !== counter.belowMinNotifiedAt?.getTime() ||
      outNotifiedAt?.getTime() !== counter.outNotifiedAt?.getTime()
    ) {
      await this.prisma.portionCounter.update({
        where: { id: counter.id },
        data: { belowMinNotifiedAt, outNotifiedAt },
      });
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private async loadCounter(tx: Tx, tenantId: string, counterId: string) {
    const counter = await tx.portionCounter.findFirst({
      where: { id: counterId, tenantId },
      select: { id: true },
    });
    if (!counter) {
      throw new NotFoundException("Contador no encontrado");
    }
  }

  /**
   * Aplica una variación: lo negativo se gasta FIFO (sin etiqueta primero,
   * luego etiquetas de la más antigua a la más nueva; lo que falte queda como
   * faltante). Lo positivo vuelve a la etiqueta activa más reciente si es una
   * venta devuelta; si no, entra como raciones sin etiqueta.
   */
  private async applyDelta(
    tx: Tx,
    tenantId: string,
    counterId: string,
    delta: number,
    meta: {
      type: PortionMovementType;
      cuinerSaleLineId?: string;
      cuinerRegistroId?: number;
      reason?: string;
      actor?: PortionActor;
    },
  ) {
    if (delta > 0) {
      const target =
        meta.type === PortionMovementType.SALE ||
        meta.type === PortionMovementType.ORDER
          ? await tx.foodLabel.findFirst({
              where: activeLabelWhere(counterId),
              orderBy: [{ preparedAt: "desc" }, { createdAt: "desc" }],
              select: { id: true },
            })
          : null;
      if (target) {
        await tx.foodLabel.update({
          where: { id: target.id },
          data: { portionsRemaining: { increment: delta } },
        });
      } else {
        await tx.portionCounter.update({
          where: { id: counterId },
          data: { unlabeledPortions: { increment: delta } },
        });
      }
      await this.movement(tx, tenantId, counterId, {
        ...meta,
        foodLabelId: target?.id ?? null,
        quantity: delta,
      });
      return;
    }

    const counter = await tx.portionCounter.findUniqueOrThrow({
      where: { id: counterId },
      select: { unlabeledPortions: true },
    });
    const labels = await tx.foodLabel.findMany({
      where: { ...activeLabelWhere(counterId), portionsRemaining: { gt: 0 } },
      orderBy: [{ preparedAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, portionsRemaining: true },
    });
    const { takes, shortfall } = allocateFifo(-delta, [
      { labelId: null, remaining: counter.unlabeledPortions },
      ...labels.map((l) => ({
        labelId: l.id,
        remaining: l.portionsRemaining ?? 0,
      })),
    ]);
    for (const take of takes) {
      if (take.labelId) {
        await tx.foodLabel.update({
          where: { id: take.labelId },
          data: { portionsRemaining: { decrement: take.quantity } },
        });
      } else {
        await tx.portionCounter.update({
          where: { id: counterId },
          data: { unlabeledPortions: { decrement: take.quantity } },
        });
      }
      await this.movement(tx, tenantId, counterId, {
        ...meta,
        foodLabelId: take.labelId,
        quantity: -take.quantity,
      });
    }
    if (shortfall > 0) {
      await this.movement(tx, tenantId, counterId, {
        ...meta,
        foodLabelId: null,
        quantity: -shortfall,
        shortfall: true,
      });
    }
  }

  private async movement(
    tx: Tx | PrismaService,
    tenantId: string,
    counterId: string,
    data: {
      type: PortionMovementType;
      quantity: number;
      foodLabelId?: string | null;
      cuinerSaleLineId?: string;
      cuinerRegistroId?: number;
      shortfall?: boolean;
      reason?: string;
      actor?: PortionActor;
    },
  ) {
    const quantity = roundPortions(data.quantity);
    const created = await tx.portionMovement.create({
      data: {
        tenantId,
        counterId,
        type: data.type,
        quantity,
        foodLabelId: data.foodLabelId ?? null,
        cuinerSaleLineId: data.cuinerSaleLineId ?? null,
        cuinerRegistroId: data.cuinerRegistroId ?? null,
        shortfall: data.shortfall ?? false,
        reason: data.reason?.trim() || null,
        userId: data.actor?.id ?? null,
        userName: data.actor?.name?.trim() || null,
      },
    });
    // Un faltante no cambia lo disponible: no hay nada que llevar a Cuiner.
    if (!data.shortfall && quantity !== 0 && CHEFCHEK_ORIGIN.has(data.type)) {
      await this.queueCuinerPush(tx, tenantId, counterId, quantity, data.type);
    }
    return created;
  }

  /**
   * Con el Contador de platos de Cuiner enlazado en vivo, lo que cambia en
   * ChefChek se escribe también en Cuiner (lo hace el conector del servidor).
   * Los platos que Cuiner lleva por piezas con peso no se pueden cargar desde
   * fuera: esos se cargan a mano en los dos sitios y se comparan.
   */
  private async queueCuinerPush(
    tx: Tx | PrismaService,
    tenantId: string,
    counterId: string,
    quantity: number,
    type: PortionMovementType,
  ) {
    if ((await this.loadSourceOf(tx, tenantId, counterId)) !== "BOTH") {
      return;
    }
    await tx.portionCuinerPush.create({
      data: { tenantId, counterId, quantity, reason: type },
    });
    if (quantity > 0 && CHEFCHEK_LOAD_TYPES.includes(type)) {
      // Fuera de la transacción: el aviso no debe bloquear la etiqueta.
      setImmediate(
        () =>
          void this.warnIfDoubleLoad(tenantId, counterId, "CHEFCHEK", quantity),
      );
    }
  }
}

/** Etiquetas que cuentan: del contador, sin anular ni retirar. */
export const activeLabelWhere = (
  counterId: string,
): Prisma.FoodLabelWhereInput => ({
  portionCounterId: counterId,
  voidedAt: null,
  retiredAt: null,
});
