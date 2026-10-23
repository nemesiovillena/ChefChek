import type { ZebraDevice } from './zebra-browser-print';

/**
 * "Preparar impresora" (Ajustes → Etiquetas): deja la Zebra lista para el uso
 * diario — encender y imprimir, sin calibrar a mano cada mañana.
 *
 * Causa raíz que resuelve: de fábrica la impresora no re-mide el rollo al
 * encender. Tras apagarla, el sensor de hueco queda desfasado: saca etiquetas
 * en blanco y la impresión sale descuadrada (el texto de una etiqueta invade
 * la siguiente).
 *
 * Se manda solo ZPL estándar, sin leer respuesta, para que funcione también
 * por la cola de Windows (que no devuelve datos):
 * - `^MNY`: media troquelada, detectada por hueco.
 * - `^MFS,S`: calibración corta al encender y al cerrar el cabezal. Antes se
 *   usaba el SGD `media.power_up_action`, pero el firmware de la ZD220d de
 *   cocina (V89.21.48Z) contesta "?" y lo ignora.
 * - `^JUS`: guarda la configuración para que sobreviva a las apagadas.
 *
 * Nunca se envía `~JC` (calibración remota): dejó una ZD220d en error
 * (commit cdf522f).
 */
const PREPARE_FOR_DAILY_USE_ZPL = '^XA\n^MNY\n^MFS,S\n^JUS\n^XZ';

/**
 * Configura la impresora para el uso diario. Idempotente: se puede pulsar las
 * veces que haga falta. Después conviene apagar y encender la impresora una
 * vez para que la primera calibración deje el rollo medido.
 */
export async function preparePrinterForDailyUse(device: ZebraDevice): Promise<void> {
  await device.send(PREPARE_FOR_DAILY_USE_ZPL);
}
