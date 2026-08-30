import {
  LotService,
  LotTraceabilityRow,
} from "../../albaranes/services/lot.service";
import { ProductsService } from "../../products/products.service";
import { ToolDefinition } from "./tool-definition.interface";
import {
  isCalendarPeriod,
  resolveCalendarPeriod,
} from "./calendar-period.util";

/**
 * Trazabilidad de lotes recibidos. Búsqueda directa (artículo → lote, filtrable
 * por proveedor y periodo natural) e inversa (nº de lote → albarán/proveedor).
 * Visible para todos los roles: el lote no es un dato monetario.
 */
export function createLotTraceabilityTool(
  lotService: LotService,
  productsService: ProductsService,
): ToolDefinition {
  return {
    name: "get_lot_traceability",
    description:
      "Trazabilidad de lotes recibidos de proveedor. Dos usos: (a) número de " +
      "lote de un artículo, filtrable por proveedor y periodo; (b) inverso: de " +
      "qué albarán y proveedor viene un número de lote. Devuelve una fila por " +
      "entrega (puede haber varias en el mismo periodo).",
    parameters: {
      type: "object",
      properties: {
        productName: {
          type: "string",
          description:
            "Nombre (o parte) del artículo. Requerido salvo que se indique lotNumber.",
        },
        lotNumber: {
          type: "string",
          description: "Número de lote a rastrear (búsqueda inversa).",
        },
        supplierName: {
          type: "string",
          description: "Filtrar por proveedor (opcional).",
        },
        periodo: {
          type: "string",
          enum: ["semana_actual", "semana_pasada", "mes_actual", "mes_pasado"],
          description:
            "Periodo natural a consultar contra la fecha del albarán (opcional).",
        },
        desde: {
          type: "string",
          description:
            "Fecha inicio ISO (YYYY-MM-DD), alternativa a 'periodo' (opcional).",
        },
        hasta: {
          type: "string",
          description: "Fecha fin ISO (YYYY-MM-DD) (opcional).",
        },
      },
    },
    handler: async (tenantId, params) => {
      const productName = String(params.productName ?? "").trim();
      const lotNumber = String(params.lotNumber ?? "").trim();

      if (!productName && !lotNumber) {
        return {
          error: "Dime el artículo o el número de lote que quieres consultar.",
        };
      }

      const { from, to, error: rangeError } = resolveRange(params);
      if (rangeError) {
        return { error: rangeError };
      }

      let productIds: string[] | undefined;
      if (productName) {
        const matches = await productsService.searchByNameLoose(
          tenantId,
          productName,
        );
        if (matches.length === 0) {
          return {
            error: `No encuentro ningún artículo que encaje con "${productName}".`,
          };
        }
        productIds = matches.map((m) => m.id);
      }

      const rows = await lotService.findLots({
        tenantId,
        productIds,
        lotNumber: lotNumber || undefined,
        supplierName: String(params.supplierName ?? "").trim() || undefined,
        from,
        to,
        // Sin rango: 10 filas. Con rango: findLots aplica su propio tope duro.
        limit: 10,
      });

      if (rows.length === 0) {
        return { error: "No encuentro lotes con esos criterios." };
      }

      const allRaw = rows.every((r) => r.source === "raw_line");
      return {
        lotes: rows.map(stripSource),
        ...(allRaw
          ? {
              nota: "Datos leídos del texto del albarán; sin registro de trazabilidad formal.",
            }
          : {}),
      };
    },
  };
}

function stripSource(
  row: LotTraceabilityRow,
): Omit<LotTraceabilityRow, "source"> {
  const rest: Partial<LotTraceabilityRow> = { ...row };
  delete rest.source;
  return rest as Omit<LotTraceabilityRow, "source">;
}

function resolveRange(params: Record<string, any>): {
  from?: Date;
  to?: Date;
  error?: string;
} {
  const periodo = params.periodo;
  if (periodo !== undefined && periodo !== null && periodo !== "") {
    if (!isCalendarPeriod(periodo)) {
      return { error: `Periodo no reconocido: "${periodo}".` };
    }
    return resolveCalendarPeriod(periodo, new Date());
  }

  const desde = String(params.desde ?? "").trim();
  const hasta = String(params.hasta ?? "").trim();
  if (!desde && !hasta) {
    return {};
  }

  // `new Date("YYYY-MM-DD")` es medianoche UTC. Aceptable porque `Albaran.date`
  // se guarda como fecha (medianoche UTC); el desfase con Madrid no cruza día
  // para este campo. El camino `periodo` sí es TZ-aware (ver calendar-period.util).
  const from = desde ? new Date(desde) : undefined;
  const to = hasta ? new Date(hasta) : undefined;
  if (
    (desde && Number.isNaN(from?.getTime())) ||
    (hasta && Number.isNaN(to?.getTime()))
  ) {
    return { error: "Fechas inválidas. Usa el formato YYYY-MM-DD." };
  }
  return {
    from,
    // Fin de día inclusivo para 'hasta'.
    to: to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined,
  };
}
