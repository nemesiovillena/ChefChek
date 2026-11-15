import { GestionDashboardService } from "../../gestion/gestion-dashboard.service";
import { GestionReportsService } from "../../gestion/gestion-reports.service";
import { ToolDefinition } from "./tool-definition.interface";

const DATE_PARAM = (what: string) => ({
  type: "string",
  description: `${what} (AAAA-MM-DD, día de caja; incluido)`,
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function rangeOf(params: Record<string, any>) {
  const from = String(params.from ?? "");
  const to = String(params.to ?? "");
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
    throw new Error("Indica las fechas en formato AAAA-MM-DD");
  }
  return { from, to };
}

/**
 * Ventas del TPV (Cuiner) para el asistente, sobre los mismos servicios que
 * el módulo Gestión: lo que responde cuadra con el panel y los informes.
 */
export function createSalesTools(
  dashboard: GestionDashboardService,
  reports: GestionReportsService,
): ToolDefinition[] {
  return [
    {
      name: "get_sales_summary",
      description:
        "Ventas del TPV en un rango de fechas: total con y sin IVA, tickets, ticket medio, anulado e invitaciones, comparado con el mismo periodo del año anterior (mismos días de la semana) o con el periodo anterior; platos y familias que más venden.",
      parameters: {
        type: "object",
        properties: {
          from: DATE_PARAM("Primer día"),
          to: DATE_PARAM("Último día"),
          compare: {
            type: "string",
            description:
              "Con qué comparar: year = mismo periodo del año anterior (por defecto), previous = los mismos días justo antes",
            enum: ["year", "previous"],
          },
        },
        required: ["from", "to"],
      },
      handler: async (tenantId, params) => {
        const d = await dashboard.build(
          tenantId,
          rangeOf(params),
          params.compare === "previous" ? "previous" : "year",
        );
        return {
          range: d.range,
          compareRange: d.compare.range,
          kpis: d.kpis,
          compareKpis: d.compareKpis,
          deltasPercent: d.deltas,
          topDishes: d.topDishes.slice(0, 5),
          topFamilies: d.families.slice(0, 5),
        };
      },
    },
    {
      name: "get_dish_sales_ranking",
      description:
        "Ranking de platos vendidos en un rango de fechas (más o menos vendidos, por importe o por unidades).",
      parameters: {
        type: "object",
        properties: {
          from: DATE_PARAM("Primer día"),
          to: DATE_PARAM("Último día"),
          order: {
            type: "string",
            description:
              "desc = más vendidos (por defecto), asc = menos vendidos",
            enum: ["desc", "asc"],
          },
          by: {
            type: "string",
            description:
              "total = por importe (por defecto), units = por unidades",
            enum: ["total", "units"],
          },
        },
        required: ["from", "to"],
      },
      handler: async (tenantId, params) => {
        const table = await reports.build(tenantId, "ranking", {
          ...rangeOf(params),
          order: params.order === "asc" ? "asc" : "desc",
          by: params.by === "units" ? "units" : "total",
          limit: 15,
        });
        return {
          title: table.title,
          subtitle: table.subtitle,
          rows: table.rows,
        };
      },
    },
    {
      name: "get_sales_calendar",
      description:
        "Cuándo se vende más en un rango de fechas: los días con más ventas y la media de ventas por día de la semana.",
      parameters: {
        type: "object",
        properties: {
          from: DATE_PARAM("Primer día"),
          to: DATE_PARAM("Último día"),
        },
        required: ["from", "to"],
      },
      handler: async (tenantId, params) =>
        dashboard.calendar(tenantId, rangeOf(params), 10),
    },
  ];
}
