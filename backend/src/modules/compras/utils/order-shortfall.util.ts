import { getUnitMeta } from "../../../common/utils/product-costing.util";

/** Línea de pedido con lo mínimo para saber si llegó entera. */
export interface ShortfallOrderLine {
  quantity: number;
  unit: string | null;
  receivedQuantity: number | null;
  receivedSourceUnit: string | null;
}

/** Artículo que falta: `received` null = no ha llegado nada. */
export interface ShortfallItem {
  name: string;
  quantity: number;
  unit: string | null;
  received: number | null;
}

/** Línea de albarán con el artículo vinculado o, si aún no, el sugerido. */
export interface ArrivedAlbaranLine {
  matchedProductId: string | null;
  suggestedProductId: string | null;
}

/**
 * Artículos que vienen en un albarán sin confirmar. Cuenta también el
 * artículo sugerido: cocina marca «Pedido recibido» al descargar y oficina
 * acepta las sugerencias después; sin esto el apio sugerido pero aún sin
 * vincular salía como «no ha llegado».
 */
export function arrivedProductIds(lines: ArrivedAlbaranLine[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    const productId = line.matchedProductId ?? line.suggestedProductId;
    if (productId) {
      ids.add(productId);
    }
  }
  return ids;
}

/** Filtro Prisma de líneas que llevan artículo vinculado o sugerido. */
export const LINE_HAS_PRODUCT = {
  OR: [
    { matchedProductId: { not: null } },
    { suggestedProductId: { not: null } },
  ],
};

/** Máximo de artículos nombrados en el aviso; el resto se resume. */
const MAX_ITEMS_IN_MESSAGE = 6;

/**
 * ¿Cubre lo recibido lo pedido? Con tolerancias: un cruce ud↔kg/L convertido
 * con peso medio aprendido arrastra el redondeo del peso (±10 %), y lo pedido
 * a peso nunca llega al gramo exacto (±2 %, mismo criterio que la recepción
 * en frontend). Unidades: exacto, no hay «0,3 ud» de sobra.
 */
export function isOrderLineCovered(line: ShortfallOrderLine): boolean {
  const received = line.receivedQuantity ?? 0;
  if (received >= line.quantity) {
    return true;
  }
  const orderMeta = getUnitMeta(line.unit);
  const sourceMeta = getUnitMeta(line.receivedSourceUnit);
  const crossed =
    !!orderMeta && !!sourceMeta && orderMeta.category !== sourceMeta.category;
  const tolerance = crossed
    ? line.quantity * 0.1
    : orderMeta && orderMeta.category !== "unidad"
      ? Math.max(line.quantity * 0.02, 0.01)
      : 0;
  return received >= line.quantity - tolerance;
}

const qty = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

function describeItem(item: ShortfallItem): string {
  const unit = item.unit ? ` ${item.unit}` : "";
  if (item.received && item.received > 0) {
    return `${item.name} (llegan ${qty.format(item.received)} de ${qty.format(item.quantity)}${unit})`;
  }
  return `${item.name} (${qty.format(item.quantity)}${unit})`;
}

/**
 * Texto del aviso de faltas: «PED-0116 (Dialvi): falta Tomillo (1 Bote) y
 * Pimienta (1 Bote).». Nombra hasta 6 artículos y resume el resto.
 */
export function formatShortfallMessage(
  orderNumber: string,
  supplierName: string,
  items: ShortfallItem[],
): string {
  const named = items.slice(0, MAX_ITEMS_IN_MESSAGE).map(describeItem);
  const rest = items.length - named.length;
  if (rest > 0) {
    named.push(`${rest} más`);
  }
  const list =
    named.length > 1
      ? `${named.slice(0, -1).join(", ")} y ${named[named.length - 1]}`
      : named[0];
  return (
    `${orderNumber} (${supplierName}): falta ${list}. ` +
    "Reclámalo al proveedor o cierra el pedido si no lo va a traer."
  );
}
