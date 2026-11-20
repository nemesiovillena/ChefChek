/**
 * Comprobación de la Zebra justo antes de imprimir.
 *
 * En cocina la impresora se enciende cuando hace falta una etiqueta, con el PC
 * y ChefChek ya en marcha. Un vigilante del PC reinicia Browser Print al
 * detectar la Zebra, y durante ~30 s no contesta. Si se imprime en ese rato, o
 * con la impresora sin papel o con la medida de etiqueta perdida, la etiqueta
 * no sale y nadie sabe por qué. Aquí se espera a que esté lista y, si tiene un
 * problema que solo arregla una persona, se explica qué hacer sin mandar nada.
 *
 * Se usan dos rollos (60×40 y 57×32) y la Zebra solo guarda la medida de uno.
 * Si la medida que tiene no es la del formato elegido en Ajustes (o la perdió y
 * marca sin papel), ChefChek la calibra sola con el sensor de raya negra (el
 * único con el que estos rollos Z-Select se leen bien), lo guarda y sigue.
 */
import {
  readZebraStatus,
  type ZebraDevice,
  type ZebraHostStatus,
} from './zebra-browser-print';
import { PrintTrace, traceErrorMessage } from './zebra-print-trace';

/** Margen para que Browser Print termine de reiniciarse tras encender la Zebra. */
const READY_TIMEOUT_MS = 45_000;
const RETRY_MS = 2_000;
/**
 * Tras un fallo de conexión USB caducada, reintentar enseguida puede tumbar
 * Browser Print: se deja tiempo a que el vigilante lo reinicie.
 */
const STALE_RETRY_MS = 6_000;
const STALE_USB_PATTERN = /error writing to port|connection closed|perdió la conexión/i;

/**
 * Lo que la impresora mide al calibrar es etiqueta + hueco: 57×32 da 266
 * puntos (pide 256) y 60×40 da 324 (pide 320). Entre los dos formatos hay
 * más de 50 puntos, así que este margen distingue el rollo puesto.
 */
const LENGTH_TOLERANCE_BELOW = 12;
const LENGTH_TOLERANCE_ABOVE = 32;
/**
 * Sensor de raya negra + calibrar. Sin `^JUS`: solo se guarda si sale bien.
 * Probado en la ZD220d de cocina con el rollo 57×32 (2026-11-19).
 */
const CALIBRATE_ZPL = '^XA^MNM^XZ~JC';
const SAVE_ZPL = '^XA^JUS^XZ';
/** La calibración saca unas etiquetas en blanco; durante ese rato no contesta bien. */
const CALIBRATION_FIRST_CHECK_MS = 10_000;
const CALIBRATION_TIMEOUT_MS = 30_000;

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

/** ¿La medida que tiene la impresora es la de esta etiqueta (más su hueco)? */
export function labelLengthMatches(measuredDots: number, expectedDots: number): boolean {
  return (
    measuredDots >= expectedDots - LENGTH_TOLERANCE_BELOW &&
    measuredDots <= expectedDots + LENGTH_TOLERANCE_ABOVE
  );
}

const DOTS_PER_MM = 8; // 203 ppp

/** Hace falta calibrar: marca sin papel o tiene la medida de otro rollo. */
export function needsCalibration(status: ZebraHostStatus, expectedLengthDots: number | null): boolean {
  if (status.headOpen || status.paused) return false;
  if (status.paperOut) return true;
  return expectedLengthDots !== null && !labelLengthMatches(status.labelLengthDots, expectedLengthDots);
}

/** Qué le pasa a la impresora, en palabras de cocina; null si puede imprimir. */
export function printerProblem(status: ZebraHostStatus): string | null {
  if (status.headOpen) {
    return 'La tapa de la impresora está abierta: ciérrala hasta oír el clic y vuelve a imprimir.';
  }
  if (status.paperOut) {
    return 'La impresora no detecta etiquetas (luz roja): abre la tapa, coloca bien el rollo, ciérrala hasta el clic, pulsa una vez el botón de avance y vuelve a imprimir.';
  }
  if (status.paused) {
    return 'La impresora está en pausa (luz verde parpadeando): pulsa una vez el botón de avance y vuelve a imprimir.';
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isStaleUsbError = (e: unknown) => e instanceof Error && STALE_USB_PATTERN.test(e.message);

/**
 * Calibra la impresora para el rollo puesto y, si queda bien para esta
 * etiqueta, lo guarda. Si no, explica qué pasa sin guardar nada.
 */
async function calibrateForLabel(
  device: ZebraDevice,
  expectedLengthDots: number | null,
  trace?: PrintTrace,
): Promise<void> {
  if (trace) trace.calibrated = true;
  trace?.add('calibrate-start');
  await device.send(CALIBRATE_ZPL);
  await sleep(CALIBRATION_FIRST_CHECK_MS);
  const deadline = Date.now() + CALIBRATION_TIMEOUT_MS;
  let last: ZebraHostStatus | null = null;
  for (;;) {
    try {
      last = await readZebraStatus(device);
      trace?.add('calibrate-status', { ...last });
      if (!needsCalibration(last, expectedLengthDots) && !last.headOpen && !last.paused) {
        await device.send(SAVE_ZPL);
        trace?.add('calibrate-saved');
        return;
      }
    } catch (e) {
      // Mientras calibra puede no contestar: se vuelve a preguntar.
      trace?.add('calibrate-status-error', { message: traceErrorMessage(e) });
    }
    if (Date.now() >= deadline) break;
    await sleep(RETRY_MS);
  }
  trace?.add('calibrate-failed');
  if (!last || last.paperOut) {
    throw new ZebraPrinterProblemError(
      'La impresora no detecta las etiquetas (luz roja): abre la tapa, centra el rollo con las guías ajustadas a su ancho, ciérrala hasta oír el clic y vuelve a imprimir.',
    );
  }
  const otherProblem = printerProblem(last);
  if (otherProblem) throw new ZebraPrinterProblemError(otherProblem);
  const measuredMm = Math.round(last.labelLengthDots / DOTS_PER_MM);
  const expectedMm = expectedLengthDots ? Math.round(expectedLengthDots / DOTS_PER_MM) : null;
  throw new ZebraPrinterProblemError(
    `El rollo puesto no es del formato elegido: la impresora mide etiquetas de unos ${measuredMm} mm${
      expectedMm ? ` y esta etiqueta es de ${expectedMm} mm` : ''
    }. Cambia el formato en Ajustes → Etiquetas o pon el rollo que corresponde, y vuelve a imprimir.`,
  );
}

/**
 * Devuelve la impresora cuando está lista para imprimir. Mientras Browser Print
 * no conteste o la Zebra no aparezca, reintenta (avisando una vez con
 * `onWaiting`) hasta ~45 s; si la impresora contesta con un problema, lo lanza
 * enseguida como `ZebraPrinterProblemError`.
 */
export async function waitForReadyZebra(
  resolveDevice: () => Promise<ZebraDevice>,
  opts: { expectedLengthDots: number | null; onWaiting?: () => void; trace?: PrintTrace },
): Promise<ZebraDevice> {
  const trace = opts.trace;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let notified = false;
  for (;;) {
    let lastError: unknown;
    try {
      const device = await resolveDevice();
      if (trace) trace.deviceUid = device.uid;
      trace?.add('device', { uid: device.uid, connection: device.connection });
      let status: ZebraHostStatus;
      try {
        status = await readZebraStatus(device);
        trace?.add('status', { ...status });
      } catch (e) {
        trace?.add('status-error', { message: traceErrorMessage(e) });
        // Conexión USB caducada: se espera a que el vigilante reinicie Browser
        // Print. Si solo es que no contesta a la consulta, se imprime como
        // siempre: la comprobación no debe impedir imprimir.
        if (isStaleUsbError(e)) throw e;
        return device;
      }
      if (needsCalibration(status, opts.expectedLengthDots)) {
        if (!notified) {
          notified = true;
          opts.onWaiting?.();
        }
        await calibrateForLabel(device, opts.expectedLengthDots, trace);
        return device;
      }
      const problem = printerProblem(status);
      if (problem) throw new ZebraPrinterProblemError(problem);
      return device;
    } catch (e) {
      if (e instanceof ZebraPrinterProblemError) {
        trace?.add('problem', { message: e.message });
        throw e;
      }
      lastError = e;
      trace?.add('not-ready', { message: traceErrorMessage(e) });
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
