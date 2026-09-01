import { BadGatewayException } from "@nestjs/common";

/**
 * POST de JSON a la API de un proveedor de IA (OpenAI/Gemini/Anthropic) con
 * reintentos acotados ante fallos transitorios del proveedor.
 *
 * Motivación (reproducido en producción contra Gemini real): `gemini-3.6-flash`
 * devuelve 503 "This model is currently experiencing high demand ... UNAVAILABLE"
 * de forma intermitente, y un corte de red puntual (ECONNRESET, socket hang up)
 * tumbaba la respuesta del asistente al primer intento. Ahora esos casos se
 * reintentan con un backoff corto; un 503 de saturación suele resolverse en el
 * segundo intento (vuelve en ~1 s).
 *
 * NO se reintenta:
 *  - Errores no recuperables: 4xx distinto de 429 (400/401/403/404/422...).
 *  - Timeout / abort de la petición: el proveedor ya va lento, reintentar solo
 *    alarga la espera del usuario. Sin `AbortSignal.timeout` una petición
 *    colgada no termina nunca (undici's fetch no tiene límite propio).
 *
 * Devuelve el cuerpo ya parseado como JSON. `providerLabel` es el nombre legible
 * del proveedor para los mensajes de error ("Gemini", "OpenAI", "Anthropic").
 */

/** Códigos que indican un fallo transitorio del proveedor y se reintentan. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
/** Límite por intento; sin esto la petición puede quedarse colgada. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Esperas entre intentos (ms); su longitud fija el nº de reintentos. */
const DEFAULT_RETRY_DELAYS_MS = [500, 1_200];
/** Tope al `Retry-After` que devuelva el proveedor, para no bloquear al usuario. */
const MAX_RETRY_AFTER_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface PostJsonOptions {
  timeoutMs?: number;
  /** Sobrescribe las esperas entre intentos — usado en tests para no esperar. */
  retryDelaysMs?: number[];
}

export async function postJsonWithRetry(
  providerLabel: string,
  url: string,
  init: { headers: Record<string, string>; body: string },
  opts: PostJsonOptions = {},
): Promise<any> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxAttempts = retryDelaysMs.length + 1;

  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: init.headers,
        body: init.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e: any) {
      // Timeout / abort: no se reintenta.
      if (e?.name === "TimeoutError" || e?.name === "AbortError") {
        throw new BadGatewayException(
          `No se pudo conectar con ${providerLabel}: ${e?.message ?? e}`,
        );
      }
      lastNetworkError = e;
      if (attempt < maxAttempts) {
        await sleep(retryDelaysMs[attempt - 1]);
        continue;
      }
      throw new BadGatewayException(
        `No se pudo conectar con ${providerLabel}: ${e?.message ?? e}`,
      );
    }

    if (res.ok) {
      return res.json();
    }

    const text = await res.text().catch(() => "");
    if (RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
      await sleep(retryAfterMs(res) ?? retryDelaysMs[attempt - 1]);
      continue;
    }
    throw new BadGatewayException(
      `${providerLabel} respondió ${res.status}: ${text.slice(0, 300)}`,
    );
  }

  // Inalcanzable: el bucle siempre devuelve o lanza dentro de la última vuelta.
  throw new BadGatewayException(
    `No se pudo conectar con ${providerLabel}: ${
      (lastNetworkError as any)?.message ?? "error desconocido"
    }`,
  );
}

/** Lee `Retry-After` (segundos) si el proveedor lo manda, con tope defensivo. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) {
    return null;
  }
  const secs = Number(raw);
  if (!Number.isFinite(secs) || secs <= 0) {
    return null;
  }
  return Math.min(secs * 1_000, MAX_RETRY_AFTER_MS);
}
