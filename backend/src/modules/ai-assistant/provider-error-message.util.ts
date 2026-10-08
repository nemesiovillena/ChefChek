/**
 * Traduce el fallo de una llamada al proveedor de IA a un mensaje que el
 * usuario puede leer y sobre el que puede actuar. El error crudo del proveedor
 * nunca se muestra (puede filtrar detalles internos): solo se registra en log.
 */

export const PROVIDER_ERROR_MESSAGE =
  "He tenido un problema para conectar con el proveedor de IA. Revisa la configuración en Ajustes → Asistente IA (modelo/API key) e inténtalo de nuevo.";

/** El proveedor respondió 404: el modelo configurado ya no existe (los
 *  proveedores retiran modelos con frecuencia). El usuario debe elegir otro. */
export const MODEL_UNAVAILABLE_MESSAGE =
  "El modelo de IA configurado ya no está disponible en el proveedor. Ve a Ajustes → Asistente IA y elige otro modelo.";

/** El proveedor respondió 429/5xx tras agotar los reintentos de
 *  `postJsonWithRetry` (saturación puntual, no un problema de configuración).
 *  Confundir esto con un fallo de config hace que el usuario pierda tiempo
 *  cambiando de modelo o API key sin motivo. */
export const PROVIDER_OVERLOADED_MESSAGE =
  "El proveedor de IA está saturado en este momento (fallo temporal, no es un problema de tu configuración). Espera unos segundos y vuelve a intentarlo, o prueba con otro modelo en Ajustes → Asistente IA.";

/** 429 por cuota o facturación agotada: no se arregla esperando unos segundos. */
export const PROVIDER_QUOTA_MESSAGE =
  "La clave de IA ha agotado su cuota o no tiene facturación activa en el proveedor. Revisa tu plan en el proveedor o usa otra clave en Ajustes → Asistente IA.";

/** Códigos que `postJsonWithRetry` reintenta — ver RETRYABLE_STATUS en
 *  provider-http.util.ts. */
const RETRYABLE_STATUS_PATTERN = /respondió (429|500|502|503|504):/;

/** Los adaptadores formatean sus errores como "<Proveedor> respondió <código>: ...". */
export function toUserFacingProviderError(error: unknown): string {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? (error as { message: string }).message
      : "";
  if (message.includes("respondió 404")) {
    return MODEL_UNAVAILABLE_MESSAGE;
  }
  if (message.includes("respondió 429") && /quota|billing/i.test(message)) {
    return PROVIDER_QUOTA_MESSAGE;
  }
  if (RETRYABLE_STATUS_PATTERN.test(message)) {
    return PROVIDER_OVERLOADED_MESSAGE;
  }
  return PROVIDER_ERROR_MESSAGE;
}
