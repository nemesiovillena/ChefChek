/**
 * Traduce el fallo de una llamada al proveedor de IA a un mensaje que el
 * usuario puede leer y sobre el que puede actuar. El error crudo del proveedor
 * nunca se muestra (puede filtrar detalles internos): solo se registra en log.
 */

/** Dónde cambia el usuario el modelo/clave. La captura de recetas tiene su
 *  propia config: mandarle al Asistente IA no arregla nada. */
export const ASSISTANT_SETTINGS_LOCATION = "Ajustes → Asistente IA";

const providerErrorMessage = (where: string) =>
  `He tenido un problema para conectar con el proveedor de IA. Revisa la configuración en ${where} (modelo/API key) e inténtalo de nuevo.`;

/** El proveedor respondió 404: el modelo configurado ya no existe (los
 *  proveedores retiran modelos con frecuencia). El usuario debe elegir otro. */
const modelUnavailableMessage = (where: string) =>
  `El modelo de IA configurado ya no está disponible en el proveedor. Ve a ${where} y elige otro modelo.`;

/** El proveedor respondió 429/5xx tras agotar los reintentos de
 *  `postJsonWithRetry` (saturación puntual, no un problema de configuración).
 *  Confundir esto con un fallo de config hace que el usuario pierda tiempo
 *  cambiando de modelo o API key sin motivo. */
const providerOverloadedMessage = (where: string) =>
  `El proveedor de IA está saturado en este momento (fallo temporal, no es un problema de tu configuración). Espera unos segundos y vuelve a intentarlo, o prueba con otro modelo en ${where}.`;

/** Cuota o facturación agotada: no se arregla esperando unos segundos. El
 *  proveedor lo señala con 429 (OpenAI/Gemini) pero también con 400/402/403
 *  (p. ej. Anthropic devuelve 400 "Your credit balance is too low"). */
const providerQuotaMessage = (where: string) =>
  `La clave de IA ha agotado su cuota o no tiene facturación activa en el proveedor. Revisa tu plan en el proveedor o usa otra clave en ${where}.`;

export const PROVIDER_ERROR_MESSAGE = providerErrorMessage(
  ASSISTANT_SETTINGS_LOCATION,
);
export const MODEL_UNAVAILABLE_MESSAGE = modelUnavailableMessage(
  ASSISTANT_SETTINGS_LOCATION,
);
export const PROVIDER_OVERLOADED_MESSAGE = providerOverloadedMessage(
  ASSISTANT_SETTINGS_LOCATION,
);
export const PROVIDER_QUOTA_MESSAGE = providerQuotaMessage(
  ASSISTANT_SETTINGS_LOCATION,
);

/** Códigos que `postJsonWithRetry` reintenta — ver RETRYABLE_STATUS en
 *  provider-http.util.ts. */
const RETRYABLE_STATUS_PATTERN = /respondió (429|500|502|503|504):/;

/** Estado HTTP con el que cada proveedor señala cuota/facturación agotada. */
const QUOTA_STATUS_PATTERN = /respondió (400|402|403|429):/;

/** Motivo de cuota/facturación dentro del cuerpo del error. */
const QUOTA_REASON_PATTERN =
  /quota|billing|credit balance|insufficient[\s_-]{0,2}(quota|credit)/i;

/**
 * Los adaptadores formatean sus errores como "<Proveedor> respondió <código>: ...".
 * `where` es la pantalla donde se configuró el modelo usado.
 */
export function toUserFacingProviderError(
  error: unknown,
  where: string = ASSISTANT_SETTINGS_LOCATION,
): string {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? (error as { message: string }).message
      : "";
  if (message.includes("respondió 404")) {
    return modelUnavailableMessage(where);
  }
  if (
    QUOTA_STATUS_PATTERN.test(message) &&
    QUOTA_REASON_PATTERN.test(message)
  ) {
    return providerQuotaMessage(where);
  }
  if (RETRYABLE_STATUS_PATTERN.test(message)) {
    return providerOverloadedMessage(where);
  }
  return providerErrorMessage(where);
}
