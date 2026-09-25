import type { ZebraDevice } from './zebra-browser-print';

/**
 * "Preparar impresora" (Ajustes → Etiquetas): deja la Zebra lista para el uso
 * diario — encender y imprimir, sin calibrar a mano cada mañana.
 *
 * Causa raíz que resuelve: de fábrica la acción al encender NO es calibrar.
 * Tras apagar el PC/impresora, el perfil de sensor queda desfasado y la
 * impresión sale descuadrada desde la primera etiqueta (en lotes largos el
 * error de avance se acumula y el texto de una etiqueta invade la siguiente).
 * Fijando la acción de encendido a "calibrate" la impresora re-mide el rollo
 * por sí sola en cada arranque.
 *
 * Sondeo previo obligatorio: si el firmware no soporta SGD (o no contesta), no
 * se toca nada de eso y solo se persiste la configuración de media troquelada
 * (`^MNY` + `^JUS`, que SÍ es seguro). Aquí nunca se envía `~JC`: la
 * calibración remota dejó una ZD220d en error (commit cdf522f); el
 * auto-calibrado al encender usa el propio camino seguro del firmware.
 */

/** SGD de la acción al encender: de fábrica vale "feed"; se cambia a "calibrate". */
const SGD_GET_POWER_UP_ACTION = '! U1 getvar "media.power_up_action"';
const SGD_SET_POWER_UP_CALIBRATE = '! U1 setvar "media.power_up_action" "calibrate"';

/** Media troquelada detectada por hueco + guardado persistente de la configuración. */
const SAVE_GAP_MEDIA_CONFIG_ZPL = '^XA\n^MNY\n^JUS\n^XZ';

export type PrinterPrepareResult =
  /** SGD soportado: la impresora calibrará sola en cada arranque. */
  | 'auto-calibrate-on'
  /**
   * Firmware sin SGD accesible: solo se persistió la media por hueco. Si
   * descuadra, calibración manual con el botón FEED de la impresora.
   */
  | 'config-saved-only';

/**
 * Configura la impresora para el uso diario. Idempotente: se puede pulsar las
 * veces que haga falta. Tras "auto-calibrate-on" conviene apagar y encender la
 * impresora una vez para que la primera auto-calibración deje el rollo medido.
 */
export async function preparePrinterForDailyUse(
  device: ZebraDevice,
): Promise<PrinterPrepareResult> {
  let powerUpAction: string | null = null;
  try {
    powerUpAction = await device.sendThenRead(SGD_GET_POWER_UP_ACTION);
  } catch {
    // Sin respuesta (timeout o error): firmware sin SGD — no se insiste.
    powerUpAction = null;
  }

  // Respuesta esperada: el valor entrecomillado, p. ej. `"feed"`. Vacío o con
  // marca de error = no soportado.
  const answer = powerUpAction ?? '';
  const supported = answer.trim().length > 0 && !/error/i.test(answer);

  if (supported && !/calibrate/i.test(answer)) {
    await device.send(SGD_SET_POWER_UP_CALIBRATE);
  }
  // En cualquier caso: media por hueco + config viva guardadas de forma
  // persistente (sobrevive a apagadas). Inofensivo si ya lo estaba.
  await device.send(SAVE_GAP_MEDIA_CONFIG_ZPL);
  return supported ? 'auto-calibrate-on' : 'config-saved-only';
}
