import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { Prisma } from "@prisma/client";

type Client = Prisma.TransactionClient | PrismaService;

/**
 * Dónde se cargan las raciones (Configuración → Contador de platos):
 *  - CHEFCHEK: etiquetas, recuentos y ajustes en ChefChek. El TPV no se toca.
 *  - TPV: se carga en el TPV; ChefChek solo lo muestra (y se iguala a él).
 *  - BOTH: en los dos; lo de un lado pasa al otro y avisa si no cuadra o si
 *    parece cargado dos veces.
 * TPV y BOTH necesitan el TPV enlazado en vivo (hoy, Cuiner).
 */
export const PORTION_LOAD_SOURCES = ["CHEFCHEK", "TPV", "BOTH"] as const;
export type PortionLoadSource = (typeof PORTION_LOAD_SOURCES)[number];

const LOAD_SOURCE_KEY = "RACIONES_LOAD_SOURCE";
const DOUBLE_LOAD_HOURS_KEY = "RACIONES_DOUBLE_LOAD_HOURS";
export const DEFAULT_DOUBLE_LOAD_HOURS = 12;
const DOUBLE_LOAD_HOURS_MIN = 1;
const DOUBLE_LOAD_HOURS_MAX = 72;

export interface PortionSettings {
  /** Lo elegido en Configuración. */
  loadSource: PortionLoadSource;
  /** Lo que de verdad se aplica: sin enlace en vivo, siempre CHEFCHEK. */
  effectiveSource: PortionLoadSource;
  /** Ventana para avisar de una posible carga doble (modo BOTH). */
  doubleLoadHours: number;
  /** TPV enlazado en vivo (Contador de platos de Cuiner). */
  live: boolean;
}

@Injectable()
export class PortionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    tenantId: string,
    client: Client = this.prisma,
  ): Promise<PortionSettings> {
    const [rows, cuiner] = await Promise.all([
      client.configuration.findMany({
        where: {
          tenantId,
          key: { in: [LOAD_SOURCE_KEY, DOUBLE_LOAD_HOURS_KEY] },
        },
        select: { key: true, value: true },
      }),
      client.cuinerConfig.findUnique({
        where: { tenantId },
        select: { enabled: true, portionCursor: true },
      }),
    ]);
    const value = (key: string) =>
      rows.find((r) => r.key === key)?.value.trim();
    const live = !!cuiner?.enabled && cuiner.portionCursor !== null;
    const stored = value(LOAD_SOURCE_KEY) as PortionLoadSource | undefined;
    // Sin elegir: con el TPV enlazado, en los dos (como se activó el enlace).
    const loadSource =
      stored && PORTION_LOAD_SOURCES.includes(stored)
        ? stored
        : live
          ? "BOTH"
          : "CHEFCHEK";
    const hours = Number(value(DOUBLE_LOAD_HOURS_KEY));
    return {
      loadSource,
      effectiveSource: live ? loadSource : "CHEFCHEK",
      doubleLoadHours:
        Number.isInteger(hours) &&
        hours >= DOUBLE_LOAD_HOURS_MIN &&
        hours <= DOUBLE_LOAD_HOURS_MAX
          ? hours
          : DEFAULT_DOUBLE_LOAD_HOURS,
      live,
    };
  }

  async update(
    tenantId: string,
    data: { loadSource?: PortionLoadSource; doubleLoadHours?: number },
    userId: string,
  ): Promise<PortionSettings> {
    const current = await this.get(tenantId);
    if (data.loadSource && data.loadSource !== "CHEFCHEK" && !current.live) {
      throw new BadRequestException(
        "Para cargar en el TPV hace falta tenerlo enlazado en vivo (conector de Cuiner).",
      );
    }
    if (
      data.doubleLoadHours !== undefined &&
      (!Number.isInteger(data.doubleLoadHours) ||
        data.doubleLoadHours < DOUBLE_LOAD_HOURS_MIN ||
        data.doubleLoadHours > DOUBLE_LOAD_HOURS_MAX)
    ) {
      throw new BadRequestException(
        `Las horas deben ser un entero entre ${DOUBLE_LOAD_HOURS_MIN} y ${DOUBLE_LOAD_HOURS_MAX}.`,
      );
    }
    const save = (key: string, value: string, description: string) =>
      this.prisma.configuration.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: {
          tenantId,
          key,
          value,
          category: "RACIONES",
          description,
          updatedBy: userId,
        },
        update: { value, updatedBy: userId },
      });
    if (data.loadSource) {
      await save(
        LOAD_SOURCE_KEY,
        data.loadSource,
        "Dónde se cargan las raciones del contador de platos",
      );
    }
    if (data.doubleLoadHours !== undefined) {
      await save(
        DOUBLE_LOAD_HOURS_KEY,
        String(data.doubleLoadHours),
        "Horas para avisar de una posible carga doble (ChefChek y TPV)",
      );
    }
    return this.get(tenantId);
  }
}

/**
 * Cómo se carga un contador concreto. Un contador cuyos platos el TPV lleva
 * por piezas con peso (chuletón, parpatana) no se puede cargar desde fuera:
 * con el TPV enlazado, sigue siempre al TPV salvo en «solo ChefChek».
 */
export function counterLoadSource(
  settings: PortionSettings,
  dishes: { tipo: string; perPiece: boolean }[],
): PortionLoadSource {
  const platos = dishes.filter((d) => d.tipo === "P");
  const pieceOnly = platos.length > 0 && platos.every((d) => d.perPiece);
  if (settings.effectiveSource === "BOTH" && pieceOnly) {
    return "TPV";
  }
  return settings.effectiveSource;
}
