import * as http from "http";
import * as https from "https";
import * as zlib from "zlib";
import { promises as dns } from "dns";
import { Readable } from "stream";
import {
  assertPublicHttpUrl,
  isPublicUnicastAddress,
} from "../../../common/utils/ssrf-safe-url.util";

/**
 * Descarga de páginas web cuya URL escribe un usuario.
 *
 * El servidor ve redes que Internet no ve (LAN, VPN), así que no basta con
 * validar la URL: se resuelve el host, se exige que TODAS sus direcciones
 * sean públicas y la conexión se abre contra esa misma dirección ya validada
 * (`lookup` fijado). Sin eso, un DNS que responde distinto la segunda vez
 * llevaría la petición a una IP interna. Por eso se usa `http(s).request` y
 * no `fetch`, que resuelve por su cuenta.
 */

const MAX_REDIRECTS = 3;
const TOTAL_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CHARSET_SNIFF_BYTES = 2048;
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

/** Error con un mensaje pensado para mostrarse tal cual al usuario. */
export class PageFetchError extends Error {}

const NOT_PUBLIC = "La dirección no es una página web pública";
const NO_RESPONSE = "La web no respondió";
const BLOCKED = "La web bloquea el acceso automático";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface PageFetcherDeps {
  resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  isPublicAddress: (ip: string) => boolean;
  allowedPorts: number[];
}

const defaultDeps: PageFetcherDeps = {
  resolve: (hostname) => dns.lookup(hostname, { all: true }),
  isPublicAddress: isPublicUnicastAddress,
  allowedPorts: [80, 443],
};

export async function fetchPublicPage(
  rawUrl: string,
  overrides: Partial<PageFetcherDeps> = {},
): Promise<string> {
  const deps = { ...defaultDeps, ...overrides };
  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);

  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (signal.aborted) {
      throw new PageFetchError(NO_RESPONSE);
    }
    const url = validateUrl(current, deps);
    const pinned = await resolvePinnedAddresses(url.hostname, deps, signal);

    let response: http.IncomingMessage;
    try {
      response = await request(url, pinned, signal);
    } catch {
      throw new PageFetchError(NO_RESPONSE);
    }

    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.destroy();
      try {
        current = new URL(response.headers.location, url).toString();
      } catch {
        throw new PageFetchError(NO_RESPONSE);
      }
      continue;
    }
    if (status === 401 || status === 403 || status === 429) {
      response.destroy();
      throw new PageFetchError(BLOCKED);
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw new PageFetchError(`${NO_RESPONSE} (código ${status})`);
    }

    const contentType = String(response.headers["content-type"] ?? "");
    if (!HTML_TYPES.some((type) => contentType.toLowerCase().includes(type))) {
      response.destroy();
      throw new PageFetchError(NOT_PUBLIC);
    }

    try {
      const body = await readBody(response);
      return decodeBody(body, contentType);
    } catch {
      throw new PageFetchError(NO_RESPONSE);
    }
  }
  throw new PageFetchError("La web redirige demasiadas veces");
}

function validateUrl(raw: string, deps: PageFetcherDeps): URL {
  let url: URL;
  try {
    url = assertPublicHttpUrl(raw);
  } catch {
    throw new PageFetchError(NOT_PUBLIC);
  }
  if (url.username || url.password) {
    throw new PageFetchError(NOT_PUBLIC);
  }
  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80;
  if (!deps.allowedPorts.includes(port)) {
    throw new PageFetchError(NOT_PUBLIC);
  }
  return url;
}

/**
 * Resuelve el host una sola vez y devuelve las direcciones a las que se podrá
 * conectar. Basta una no pública entre las resueltas para rechazar el host.
 */
async function resolvePinnedAddresses(
  hostname: string,
  deps: PageFetcherDeps,
  signal: AbortSignal,
): Promise<ResolvedAddress[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  let addresses: ResolvedAddress[];
  try {
    // El límite de tiempo total también cubre un DNS lento.
    addresses = await Promise.race([
      deps.resolve(host),
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("timeout")), {
          once: true,
        });
      }),
    ]);
  } catch {
    throw new PageFetchError(NO_RESPONSE);
  }
  if (!addresses.length) {
    throw new PageFetchError(NO_RESPONSE);
  }
  if (!addresses.every((a) => deps.isPublicAddress(a.address))) {
    throw new PageFetchError(NOT_PUBLIC);
  }
  return addresses;
}

function request(
  url: URL,
  pinned: ResolvedAddress[],
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  const transport = url.protocol === "https:" ? https : http;
  // Node puede pedir una dirección o la lista completa (`all`, con
  // autoSelectFamily, para probar IPv6 e IPv4); solo se ofrecen las validadas.
  const lookup = (
    _hostname: string,
    options: { all?: boolean },
    callback: (...args: unknown[]) => void,
  ) => {
    if (options?.all) {
      callback(null, pinned);
    } else {
      callback(null, pinned[0].address, pinned[0].family);
    }
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: "GET",
        signal,
        // Sin pool: un socket reutilizado iría a la dirección con la que se
        // abrió, no a la que se acaba de validar para esta petición.
        agent: false,
        lookup: lookup as never,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es,en;q=0.5",
          "Accept-Encoding": "gzip, br",
        },
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Lee el cuerpo ya descomprimido y lo corta en MAX_BODY_BYTES: el límite se
 * aplica tras descomprimir para que una respuesta pequeña no se expanda sin
 * tope en memoria.
 */
function readBody(response: http.IncomingMessage): Promise<Buffer> {
  const encoding = String(
    response.headers["content-encoding"] ?? "",
  ).toLowerCase();
  let stream: Readable = response;
  if (encoding === "gzip" || encoding === "x-gzip") {
    stream = response.pipe(zlib.createGunzip());
  } else if (encoding === "br") {
    stream = response.pipe(zlib.createBrotliDecompress());
  } else if (encoding === "deflate") {
    stream = response.pipe(zlib.createInflate());
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      // Hay que parar también el descompresor: si solo se cierra la respuesta
      // sigue expandiendo en memoria lo que ya tenía en el búfer.
      if (stream !== response) {
        response.unpipe();
        stream.destroy();
      }
      response.destroy();
      resolve(Buffer.concat(chunks).subarray(0, MAX_BODY_BYTES));
    };
    stream.on("data", (chunk: Buffer) => {
      if (settled) {
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
      if (size >= MAX_BODY_BYTES) {
        finish();
      }
    });
    stream.on("end", finish);
    stream.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    response.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

/** Decodifica con el juego de caracteres de la cabecera o del `<meta>`. */
function decodeBody(body: Buffer, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const head = body.subarray(0, CHARSET_SNIFF_BYTES).toString("latin1");
  const fromMeta = /charset=["']?([\w-]+)/i.exec(head)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) {
      continue;
    }
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      // etiqueta desconocida: probar la siguiente
    }
  }
  return body.toString("utf8");
}
