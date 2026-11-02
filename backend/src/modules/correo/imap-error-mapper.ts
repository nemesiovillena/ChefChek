import {
  BadRequestException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

/**
 * Traduce los errores de imapflow/red a respuestas HTTP en español. El detalle
 * técnico solo va al log: al cliente nunca le llega un 500 ni el código interno.
 */
export class ImapOperationTimeoutError extends Error {
  constructor() {
    super("IMAP operation timeout");
    this.name = "ImapOperationTimeoutError";
  }
}

export const MAILBOX_UNAVAILABLE =
  "Buzón no disponible, reinténtalo en unos minutos.";
export const MAILBOX_BAD_CREDENTIALS =
  "No se pudo conectar con el buzón: revisa usuario y contraseña.";

const NETWORK_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "ETIMEOUT",
  "EPIPE",
  "CONNECT_TIMEOUT",
  "GREETING_TIMEOUT",
  "NoConnection",
  "EConnectionClosed",
]);

/** ¿El fallo indica que no se pudo conectar o autenticar? (cuenta para el breaker) */
export function isConnectionFailure(err: any): boolean {
  if (err instanceof HttpException) {
    return false;
  }
  if (err instanceof ImapOperationTimeoutError) {
    return true;
  }
  if (err?.authenticationFailed) {
    return true;
  }
  const code: string = err?.code ?? "";
  return NETWORK_CODES.has(code) || isTlsError(code);
}

function isTlsError(code: string): boolean {
  return (
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    code.startsWith("CERT_") ||
    code.startsWith("UNABLE_TO_") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  );
}

export function mapImapError(
  err: any,
  logger: Logger,
  tenantId: string,
): HttpException {
  if (err instanceof HttpException) {
    return err;
  }

  const code: string = err?.code ?? "";
  const detail = [code, err?.responseText, err?.message]
    .filter(Boolean)
    .join(" | ");
  logger.warn(`IMAP ${tenantId}: ${detail || "error desconocido"}`);

  if (err?.authenticationFailed) {
    return new BadRequestException(MAILBOX_BAD_CREDENTIALS);
  }
  if (err instanceof ImapOperationTimeoutError) {
    return new ServiceUnavailableException(
      "El buzón tarda demasiado en responder, reinténtalo.",
    );
  }
  // Red, TLS, "Too many connections" (respuesta NO) y cualquier otro fallo
  return new ServiceUnavailableException(MAILBOX_UNAVAILABLE);
}
