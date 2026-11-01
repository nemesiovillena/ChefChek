/**
 * Reparto FIFO de un consumo de raciones entre las fuentes de un contador.
 * Función pura: el servicio carga las fuentes en orden y escribe el resultado.
 *
 * Orden de las fuentes (lo decide quien llama): primero las raciones sin
 * etiqueta (recuento a mano, ya estaban en cámara) y luego las etiquetas
 * activas de la más antigua a la más nueva.
 */

/** Redondeo a centésimas: evita restos tipo 0,30000000000000004. */
export const roundPortions = (n: number): number => Math.round(n * 100) / 100;

export interface PortionSource {
  /** null = raciones sin etiqueta del contador. */
  labelId: string | null;
  remaining: number;
}

export interface PortionTake {
  labelId: string | null;
  quantity: number;
}

export interface FifoResult {
  takes: PortionTake[];
  /** Lo que no se pudo cubrir: se vendió más de lo etiquetado/contado. */
  shortfall: number;
}

export function allocateFifo(
  amount: number,
  sources: PortionSource[],
): FifoResult {
  let pending = roundPortions(amount);
  const takes: PortionTake[] = [];
  for (const source of sources) {
    if (pending <= 0) {
      break;
    }
    const available = roundPortions(source.remaining);
    if (available <= 0) {
      continue;
    }
    const quantity = Math.min(available, pending);
    takes.push({ labelId: source.labelId, quantity });
    pending = roundPortions(pending - quantity);
  }
  return { takes, shortfall: Math.max(0, pending) };
}

export type ThresholdState = "ok" | "low" | "out";

/** Estado del contador: agotado (≤ 0), pocas (≤ mínimo) u OK. */
export function thresholdState(
  available: number,
  minPortions: number,
): ThresholdState {
  if (available <= 0) {
    return "out";
  }
  if (minPortions > 0 && available <= minPortions) {
    return "low";
  }
  return "ok";
}
