/**
 * Cuaderno de bitácora de un intento de impresión térmica: cada paso (qué
 * contestó la impresora, si se calibró, errores) con su instante. Al terminar
 * se manda a ChefChek para poder saber qué pasó cuando en cocina sale algo
 * raro (etiquetas en blanco, luz roja…), porque la impresora solo la ve el PC.
 */
export interface PrintTraceStep {
  /** Milisegundos desde el inicio del intento. */
  t: number;
  step: string;
  data?: Record<string, unknown>;
}

const MAX_STEPS = 200;

export class PrintTrace {
  private readonly startedAt = Date.now();
  readonly steps: PrintTraceStep[] = [];
  calibrated = false;
  deviceUid: string | null = null;

  add(step: string, data?: Record<string, unknown>): void {
    if (this.steps.length >= MAX_STEPS) return;
    this.steps.push({ t: Date.now() - this.startedAt, step, ...(data ? { data } : {}) });
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }
}

/** Texto de un error para el registro, sin reventar con valores raros. */
export function traceErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 500);
  if (typeof e === 'string') return e.slice(0, 500);
  return 'Error desconocido';
}
