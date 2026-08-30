import { BadRequestException } from "@nestjs/common";
import { isIP } from "net";

/**
 * Defensa SSRF para URLs que el backend va a descargar (`fetch`).
 *
 * Rechaza:
 *  - esquemas que no sean http(s)
 *  - hostnames locales (`localhost`, `*.local`, `*.internal`, sin punto)
 *  - IP literales de rangos privados / reservados / link-local, incluyendo
 *    la IP de metadatos de cloud 169.254.169.254
 *
 * No resuelve DNS: valida el literal de la URL. Es una barrera de defensa en
 * profundidad, no la única (las URLs deberían venir de un origen de confianza).
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException("URL no válida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("Solo se permiten URLs http(s)");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = isIP(host);

  if (ipVersion === 0) {
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      !host.includes(".")
    ) {
      throw new BadRequestException("Destino no permitido");
    }
    return url;
  }

  if (isPrivateOrReservedIp(host, ipVersion)) {
    throw new BadRequestException("Destino no permitido (IP interna)");
  }
  return url;
}

function isPrivateOrReservedIp(ip: string, version: number): boolean {
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10.0.0.0/8
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
      (a === 169 && b === 254) || // link-local (incl. metadata 169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) // 192.168.0.0/16
    );
  }
  // IPv6
  const v = ip.toLowerCase();
  // Cualquier dirección que empieza por "::" no es global: loopback (::1),
  // no especificada (::), IPv4-mapped (::ffff:a.b.c.d) e IPv4-compatible.
  if (v.startsWith("::")) {
    return true;
  }
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) {
    return true; // link-local + unique-local
  }
  return false;
}
