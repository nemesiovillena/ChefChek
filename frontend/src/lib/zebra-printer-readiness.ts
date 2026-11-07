/**
 * Comprobación de la Zebra justo antes de imprimir.
 *
 * En cocina la impresora se enciende cuando hace falta una etiqueta, con el PC
 * y ChefChek ya en marcha. Un vigilante del PC reinicia Browser Print al
 * detectar la Zebra, y durante ~30 s no contesta. Si se imprime en ese rato, o
 * con la impresora sin papel o con la medida de etiqueta perdida, la etiqueta
 * no sale y nadie sabe por qué. Aquí se espera a que esté lista y, si tiene un
 * problema que solo arregla una persona, se explica qué hacer sin mandar nada.
 */
import {
  readZebraStatus,
  type ZebraDevice,
  type ZebraHostStatus,
} from './zebra-browser-print';

/** Margen para que Browser Print termine de reiniciarse tras encender la Zebra. */
const READY_TIMEOUT_MS = 45_000;
const RETRY_MS = 2_000;
/**
 * Tras un fallo de conexión USB caducada, reintentar enseguida puede tumbar
 * Browser Print: se deja tiempo a que el vigilante lo reinicie.
 */
const STALE_RETRY_MS = 6_000;
const STALE_USB_PATTERN = /error writing to port|connection closed|perdió la conexión/i;

/** Problema de la impresora que no se arregla esperando: hay que tocarla. */
export class ZebraPrinterProblemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZebraPrinterProblemError';
  }
}

/** Largo (en puntos) que pide el ZPL de la etiqueta (`^LL`), o null si no lo lleva. */
export function zplLabelLengthDots(zpl: string): number | null {
  const match = /\^LL(\d+)/.exec(zpl);
  return match ? parseInt(match[1], 10) : null;
}

/** Qué le pasa a la impresora, en palabras de cocina; null si puede imprimir. */
export function printerProblem(
  status: ZebraHostStatus,
  expectedLengthDots: number | null,
): string | null {
  if (status.headOpen) {
    return 'La tapa de la impresora está abierta: ciérrala hasta oír el clic y vuelve a imprimir.';
  }
  if (status.paperOut) {
    return 'La impresora no detecta etiquetas (luz roja): abre la tapa, coloca bien el rollo, ciérrala hasta el clic, pulsa una vez el botón de avance y vuelve a imprimir.';
  }
  if (status.paused) {
    return 'La impresora está en pausa (luz verde parpadeando): pulsa una vez el botón de avance y vuelve a imprimir.';
  }
  // Con la medida perdida avanza un poco y no sale nada (visto con 13 puntos
  // en vez de ~320). Solo se avisa si es claramente más corta de lo esperado.
  if (expectedLengthDots && status.labelLengthDots < expectedLengthDots / 2) {
    return 'La impresora ha perdido la medida de la etiqueta. Con la luz verde fija, mantén pulsado el botón de avance y suéltalo justo después del 2.º parpadeo (no llegues al 4.º). Si se queda en rojo, abre y cierra la tapa y pulsa el botón una vez. Después vuelve a imprimir.';
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isStaleUsbError = (e: unknown) => e instanceof Error && STALE_USB_PATTERN.test(e.message);

/**
 * Devuelve la impresora cuando está lista para imprimir. Mientras Browser Print
 * no conteste o la Zebra no aparezca, reintenta (avisando una vez con
 * `onWaiting`) hasta ~45 s; si la impresora contesta con un problema, lo lanza
 * enseguida como `ZebraPrinterProblemError`.
 */
export async function waitForReadyZebra(
  resolveDevice: () => Promise<ZebraDevice>,
  opts: { expectedLengthDots: number | null; onWaiting?: () => void },
): Promise<ZebraDevice> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let notified = false;
  for (;;) {
    let lastError: unknown;
    try {
      const device = await resolveDevice();
      let status: ZebraHostStatus;
      try {
        status = await readZebraStatus(device);
      } catch (e) {
        // Conexión USB caducada: se espera a que el vigilante reinicie Browser
        // Print. Si solo es que no contesta a la consulta, se imprime como
        // siempre: la comprobación no debe impedir imprimir.
        if (isStaleUsbError(e)) throw e;
        return device;
      }
      const problem = printerProblem(status, opts.expectedLengthDots);
      if (problem) throw new ZebraPrinterProblemError(problem);
      return device;
    } catch (e) {
      if (e instanceof ZebraPrinterProblemError) throw e;
      lastError = e;
    }
    if (Date.now() >= deadline) {
      throw lastError instanceof Error ? lastError : new Error('La impresora no está lista.');
    }
    if (!notified) {
      notified = true;
      opts.onWaiting?.();
    }
    await sleep(isStaleUsbError(lastError) ? STALE_RETRY_MS : RETRY_MS);
  }
}
