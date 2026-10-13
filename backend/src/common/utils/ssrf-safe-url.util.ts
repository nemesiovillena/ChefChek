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
 * No resuelve DNS: valida el literal de la URL. Quien descargue una URL
 * escrita por un usuario debe además validar las direcciones resueltas con
 * `isPublicUnicastAddress` y conectar a esa misma dirección.
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

  // El punto final ("localhost.") es el mismo host para el DNS.
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
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

  if (!isPublicUnicastAddress(host)) {
    throw new BadRequestException("Destino no permitido (IP interna)");
  }
  return url;
}

/**
 * true solo si `ip` es una dirección unicast global, es decir, alcanzable en
 * Internet y no en la máquina, la LAN o una VPN. Sirve tanto para literales
 * de URL como para direcciones ya resueltas por DNS. Ante la duda, false.
 */
export function isPublicUnicastAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPublicIpv4(ip.split(".").map(Number));
  }
  if (version !== 6) {
    return false;
  }
  const bytes = parseIpv6(ip);
  if (!bytes) {
    return false;
  }

  // NAT64 (64:ff9b::/96): lleva una IPv4 en los últimos 4 bytes.
  const isNat64 =
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((b) => b === 0);
  if (isNat64) {
    return isPublicIpv4(bytes.slice(12, 16));
  }

  // Fuera de 2000::/3 nada es unicast global: ::, ::1, IPv4-mapped,
  // unique-local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)...
  if ((bytes[0] & 0xe0) !== 0x20) {
    return false;
  }
  // 6to4 (2002::/16): la IPv4 va en los bytes 2-5.
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPublicIpv4(bytes.slice(2, 6));
  }
  // 2001::/32 Teredo (túnel hacia una IPv4 ofuscada) y 2001:db8::/32 documentación.
  if (bytes[0] === 0x20 && bytes[1] === 0x01) {
    const second = (bytes[2] << 8) | bytes[3];
    if (second === 0x0000 || second === 0x0db8) {
      return false;
    }
  }
  return true;
}

// Bloques IPv4 de uso especial (IANA): privados, loopback, link-local, CGNAT
// (Tailscale), documentación, benchmarking, multicast y reservados.
function isPublicIpv4(octets: number[]): boolean {
  if (octets.length !== 4 || octets.some((o) => !(o >= 0 && o <= 255))) {
    return false;
  }
  const [a, b, c] = octets;
  const special =
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local (incl. metadatos 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // benchmarking 198.18.0.0/15
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224; // multicast 224/4, reservado 240/4 y broadcast
  return !special;
}

/** IPv6 textual → 16 bytes; null si no se puede interpretar. */
function parseIpv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  const zone = ip.indexOf("%");
  if (zone !== -1) {
    ip = ip.slice(0, zone);
  }

  // Cola IPv4 embebida (p. ej. ::ffff:10.0.0.1) → dos grupos hexadecimales.
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  if (tail.includes(".")) {
    const o = tail.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => !(n >= 0 && n <= 255))) {
      return null;
    }
    ip =
      ip.slice(0, lastColon + 1) +
      ((o[0] << 8) | o[1]).toString(16) +
      ":" +
      ((o[2] << 8) | o[3]).toString(16);
  }

  const halves = ip.split("::");
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return null;
  }
  const groups = [...head, ...Array(missing).fill("0"), ...rest];

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return null;
    }
    const value = parseInt(group, 16);
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}
