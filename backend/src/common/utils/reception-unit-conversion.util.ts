/**
 * Conversión de lo recibido en un albarán a la unidad de la línea de pedido.
 *
 * El pedido pide en su unidad de línea ("ud", "kilo", o el formato de compra
 * en texto libre tipo "Caja 6und") y el albarán factura en la unidad real del
 * proveedor (kg, ud…). Comparar números planos genera discrepancias falsas
 * (20 ud pedidas vs 7,4 kg servidos). Este módulo convierte la cantidad y el
 * precio recibidos a la unidad del pedido:
 *
 * - Misma magnitud (kg↔g, L↔ml): factores de UNIT_ALIASES.
 * - Magnitudes cruzadas (ud↔kg/L): puente con el peso/volumen medio por
 *   unidad del artículo (Product.avgUnitWeight). Si aún no existe, se deriva
 *   del ratio de precios del propio cruce pedido/albarán y se devuelve para
 *   que la conciliación lo persista (aprendizaje "una sola vez").
 * - Unidad de pedido irreconocible (cajas, texto libre): comportamiento
 *   histórico — se asume que el albarán factura en uds y se divide por
 *   unitsPerFormat para expresar el recibido en formatos.
 *
 * Toda la aritmética normaliza primero a la base de la categoría (kg / l /
 * ud) y solo al final re-expresa en la unidad destino, para que los factores
 * no se inviertan con submúltiplos (g, ml).
 */

import { getUnitMeta } from "./product-costing.util";

/** kg (o L) por unidad fuera de los cuales un ratio de precios no es fiable. */
const MIN_WEIGHT_PER_UNIT = 0.005; // una aceituna
const MAX_WEIGHT_PER_UNIT = 25; // un bidón

export interface ReceptionConversionInput {
  /** Unidad de la línea de pedido (texto libre: "ud", "kilo", "Caja 6und"…). */
  orderUnit: string | null | undefined;
  /** Cantidad tal como viene en la línea del albarán. */
  receivedQuantity: number;
  /** Unidad de la línea del albarán, cruda del papel. */
  receivedUnit: string | null | undefined;
  /** Precio unitario del albarán: € por receivedUnit. */
  receivedUnitPrice: number;
  /** Precio esperado de la línea de pedido: € por orderUnit (o null). */
  expectedPrice: number | null;
  /** Unidades reales por unidad de pedido cuando esta no es "ud" (caja). */
  unitsPerFormat: number;
  /** Peso/volumen medio por unidad (base kg o L) ya aprendido en el artículo. */
  avgUnitWeight: number | null;
}

export interface ReceptionConversionResult {
  /** Cantidad recibida expresada en la unidad de la línea de pedido. */
  quantity: number;
  /** Precio recibido: € por unidad de la línea de pedido (coherente con quantity). */
  price: number;
  /** Cantidad cruda del albarán cuando su unidad difiere de la del pedido. */
  sourceQuantity: number | null;
  /** Unidad cruda del albarán (p.ej. "kg"), junto a sourceQuantity. */
  sourceUnit: string | null;
  /** true si hizo falta cruzar magnitudes (ud↔kg/L) para convertir. */
  crossCategory: boolean;
  /**
   * Peso por unidad recién derivado de los precios (para persistir en el
   * artículo la primera vez); null si ya existía o no se pudo derivar.
   */
  learnedWeightPerUnit: number | null;
}

const canonicalOf = (meta: NonNullable<ReturnType<typeof getUnitMeta>>) =>
  meta.category === "peso" ? "kg" : meta.category === "volumen" ? "l" : "ud";

/**
 * Deriva el peso/volumen por unidad a partir de un precio por unidad y un
 * precio por magnitud base: €/ud ÷ €/kg = kg/ud. Descartado si no es plausible.
 */
export function deriveWeightPerUnit(
  pricePerUnit: number | null,
  pricePerBase: number | null,
): number | null {
  if (
    pricePerUnit === null ||
    pricePerUnit <= 0 ||
    pricePerBase === null ||
    pricePerBase <= 0
  ) {
    return null;
  }
  const wpu = pricePerUnit / pricePerBase;
  return wpu >= MIN_WEIGHT_PER_UNIT && wpu <= MAX_WEIGHT_PER_UNIT ? wpu : null;
}

/**
 * Convierte una línea de albarán a la unidad de la línea de pedido.
 * Devuelve null cuando no hay forma segura de convertir (unidades
 * desconocidas sin precio de referencia): el llamador debe aplicar entonces
 * el comportamiento histórico (cantidad cruda ÷ unitsPerFormat).
 */
export function convertReceivedToOrderUnit(
  input: ReceptionConversionInput,
): ReceptionConversionResult | null {
  const {
    orderUnit,
    receivedQuantity,
    receivedUnit,
    receivedUnitPrice,
    expectedPrice,
    unitsPerFormat,
    avgUnitWeight,
  } = input;

  const orderMeta = getUnitMeta(orderUnit);
  const recvMeta = getUnitMeta(receivedUnit);

  // Unidad del albarán desconocida: hoy ya se trata como ud del formato.
  if (!recvMeta) {
    return null;
  }

  // Magnitud recibida normalizada a la base de su categoría: kg / l / ud.
  const receivedBase = receivedQuantity * recvMeta.toBase;
  const pricePerBaseRecv = receivedUnitPrice / recvMeta.toBase; // € por kg/l/ud
  const differs =
    !orderMeta || canonicalOf(recvMeta) !== canonicalOf(orderMeta);
  const source = differs
    ? { sourceQuantity: receivedQuantity, sourceUnit: receivedUnit || null }
    : { sourceQuantity: null, sourceUnit: null };

  // Misma magnitud: factor directo (kg↔g, L↔ml, ud↔ud).
  // 1 unidad de pedido = orderMeta.toBase bases = toBase/recv.toBase unidades de albarán.
  if (orderMeta && orderMeta.category === recvMeta.category) {
    return {
      quantity: receivedBase / orderMeta.toBase,
      price: receivedUnitPrice * (orderMeta.toBase / recvMeta.toBase),
      ...source,
      crossCategory: false,
      learnedWeightPerUnit: null,
    };
  }

  // Cruzado ud↔peso/volumen: se necesita el puente kg (o L) por unidad.
  const orderIsUnit = orderMeta?.category === "unidad";
  const recvIsUnit = recvMeta.category === "unidad";
  if (orderMeta && !orderIsUnit && !recvIsUnit) {
    return null; // peso↔volumen: no convertible
  }

  let learned: number | null = null;
  let wpu = avgUnitWeight ?? 0;
  if (wpu <= 0) {
    // €/ud y €/kg de ambos lados del cruce, según quién factura en uds.
    const pricePerUnit = orderIsUnit
      ? expectedPrice // pedido en uds: expectedPrice ya es €/ud
      : expectedPrice !== null && orderMeta === null
        ? expectedPrice / Math.max(unitsPerFormat, 1) // caja: €/formato → €/ud
        : receivedUnitPrice; // albarán en uds: €/ud directo
    const pricePerBase = orderIsUnit
      ? pricePerBaseRecv // albarán factura €/kg (o €/L)
      : expectedPrice !== null && orderMeta !== null
        ? expectedPrice / orderMeta.toBase // pedido en g: €/g → €/kg
        : null;
    learned = deriveWeightPerUnit(pricePerUnit, pricePerBase);
    wpu = learned ?? 0;
  }
  if (wpu <= 0) {
    return null; // sin puente fiable → comportamiento histórico
  }

  // Pedido en uds, albarán en kg/L: 7,4 kg ÷ 0,37 kg/ud = 20 ud.
  if (orderIsUnit) {
    return {
      quantity: receivedBase / wpu,
      price: pricePerBaseRecv * wpu, // €/kg × kg/ud = €/ud
      ...source,
      crossCategory: true,
      learnedWeightPerUnit: learned,
    };
  }

  // Unidad de pedido irreconocible (caja): recibir en uds y bajar a formatos.
  if (!orderMeta) {
    const upf = Math.max(unitsPerFormat, 1);
    return {
      quantity: receivedBase / wpu / upf,
      price: pricePerBaseRecv * wpu * upf, // €/ud × ud/formato
      ...source,
      crossCategory: true,
      learnedWeightPerUnit: learned,
    };
  }

  // Pedido en kg/L, albarán en uds: 20 ud × 0,37 kg/ud = 7,4 kg.
  return {
    quantity: (receivedBase * wpu) / orderMeta.toBase,
    price: receivedUnitPrice / wpu / orderMeta.toBase, // €/ud ÷ kg/ud = €/kg
    ...source,
    crossCategory: true,
    learnedWeightPerUnit: learned,
  };
}
