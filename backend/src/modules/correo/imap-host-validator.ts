import { BadRequestException } from "@nestjs/common";
import { lookup } from "dns/promises";
import { BlockList, isIP } from "net";

/**
 * Evita que el backend se use para sondear la red interna: el servidor IMAP
 * debe resolver solo a direcciones públicas. Devuelve la IP a la que conectar
 * (se conecta a esa IP, con SNI del nombre original, para que un segundo
 * lookup no pueda devolver otra dirección).
 */
const PRIVATE_RANGES = new BlockList();
// IPv4: "esta red", privadas, CGNAT/Tailscale, loopback, link-local, multicast y reservadas
PRIVATE_RANGES.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_RANGES.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_RANGES.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("224.0.0.0", 3, "ipv4");
// IPv6: no especificada, loopback, ULA y link-local
PRIVATE_RANGES.addAddress("::", "ipv6");
PRIVATE_RANGES.addAddress("::1", "ipv6");
PRIVATE_RANGES.addSubnet("fc00::", 7, "ipv6");
PRIVATE_RANGES.addSubnet("fe80::", 10, "ipv6");

export function isPrivateAddress(address: string): boolean {
  // IPv4 mapeada en IPv6 (::ffff:10.0.0.1) → comprobar la parte IPv4
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) {
    return PRIVATE_RANGES.check(mapped[1], "ipv4");
  }
  const family = isIP(address);
  if (family === 4) {
    return PRIVATE_RANGES.check(address, "ipv4");
  }
  if (family === 6) {
    return PRIVATE_RANGES.check(address, "ipv6");
  }
  return true; // no es una IP válida → tratar como no permitida
}

const HOST_NOT_ALLOWED =
  "El servidor del buzón no es válido: usa el dominio público del proveedor (p. ej. imap.hostinger.com).";

export async function resolvePublicImapHost(host: string): Promise<string> {
  const name = host.trim().toLowerCase();
  if (
    !name ||
    name === "localhost" ||
    name.endsWith(".localhost") ||
    isIP(name)
  ) {
    throw new BadRequestException(HOST_NOT_ALLOWED);
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(name, { all: true });
  } catch {
    throw new BadRequestException(
      "No se encuentra el servidor del buzón: revisa el nombre.",
    );
  }
  if (
    addresses.length === 0 ||
    addresses.some((a) => isPrivateAddress(a.address))
  ) {
    throw new BadRequestException(HOST_NOT_ALLOWED);
  }
  return addresses[0].address;
}
