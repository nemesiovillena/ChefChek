/**
 * Índice de rotación, periodo medio de pago y financiación de proveedores
 * (fórmulas del curso), con el periodo convertido a año para que el
 * resultado no dependa de si se mira un mes o un trimestre.
 */
export interface RotationInput {
  /** Compras del periodo (sin IVA). */
  purchases: number;
  /** Existencias iniciales y finales, valoradas a coste. */
  initialStock: number;
  finalStock: number;
  /** Deuda con proveedores al cierre. */
  supplierDebt: number;
  /** Pagos a proveedores hechos en el periodo. */
  payments: number;
  /** Días del periodo. */
  days: number;
}

export interface RotationResult {
  /** Consumo = Ei + Compras − Ef. */
  consumption: number;
  /** Media de stocks = (Ei + Ef) / 2. */
  averageStock: number;
  /** Veces que se consume el stock en el periodo. */
  rotationPeriod: number | null;
  /** Lo mismo llevado a un año (× 365 / días). */
  rotationYear: number | null;
  /** Días que dura el stock medio. */
  stockDays: number | null;
  /** Pago medio diario = pagos / días del periodo. */
  dailyPayment: number | null;
  /** PMP = deuda / pago medio diario (días). */
  paymentDays: number | null;
  /** % del stock que financian los proveedores = PMP × IR anual / 365 × 100. */
  supplierFinancingPct: number | null;
}

export function stockRotation(i: RotationInput): RotationResult {
  const consumption = i.initialStock + i.purchases - i.finalStock;
  const averageStock = (i.initialStock + i.finalStock) / 2;
  // Consumo ≤ 0 (más existencias al final que lo que había y entró): datos
  // incompletos, no hay rotación que calcular.
  const rotationPeriod = averageStock > 0 && consumption > 0 ? consumption / averageStock : null;
  const rotationYear = rotationPeriod !== null && i.days > 0 ? (rotationPeriod * 365) / i.days : null;
  const stockDays = rotationYear ? 365 / rotationYear : null;
  const dailyPayment = i.days > 0 && i.payments > 0 ? i.payments / i.days : null;
  const paymentDays = dailyPayment ? i.supplierDebt / dailyPayment : null;
  const supplierFinancingPct = paymentDays !== null && rotationYear !== null ? ((paymentDays * rotationYear) / 365) * 100 : null;
  return { consumption, averageStock, rotationPeriod, rotationYear, stockDays, dailyPayment, paymentDays, supplierFinancingPct };
}
