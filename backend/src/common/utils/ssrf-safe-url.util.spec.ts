import { BadRequestException } from "@nestjs/common";
import {
  assertPublicHttpUrl,
  isPublicUnicastAddress,
} from "./ssrf-safe-url.util";

describe("assertPublicHttpUrl", () => {
  it("acepta URLs http(s) públicas", () => {
    expect(assertPublicHttpUrl("https://example.com/a.jpg").hostname).toBe(
      "example.com",
    );
    expect(() =>
      assertPublicHttpUrl("http://cdn.proveedor.es/x.png"),
    ).not.toThrow();
  });

  it("rechaza esquemas que no son http(s)", () => {
    for (const u of [
      "file:///etc/passwd",
      "ftp://example.com/x",
      "gopher://example.com",
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrow(BadRequestException);
    }
  });

  it("rechaza localhost y hostnames internos", () => {
    for (const u of [
      "http://localhost/x",
      "http://backend/x",
      "http://db.internal/x",
      "http://foo.local/x",
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrow(BadRequestException);
    }
  });

  it("rechaza IPs privadas, loopback y link-local (metadata cloud)", () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://10.1.2.3/x",
      "http://172.16.0.1/x",
      "http://192.168.1.1/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.100.0.1/x",
      "http://[::1]/x",
      "http://[fd00::1]/x",
      "http://[::ffff:10.0.0.1]/x",
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrow(BadRequestException);
    }
  });

  it("rechaza URLs no parseables", () => {
    expect(() => assertPublicHttpUrl("no es una url")).toThrow(
      BadRequestException,
    );
  });
});

describe("assertPublicHttpUrl con punto final", () => {
  it.each([
    "http://localhost./",
    "http://cocina.local./",
    "http://127.0.0.1./",
  ])("rechaza %s", (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(BadRequestException);
  });
});

describe("isPublicUnicastAddress", () => {
  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "2606:4700:4700::1111",
    "2a00:1450:4003:80f::200e",
    "64:ff9b::808:808", // NAT64 de 8.8.8.8
    "2002:808:808::1", // 6to4 de 8.8.8.8
  ])("accepts public address %s", (ip) => {
    expect(isPublicUnicastAddress(ip)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.68.34.99", // Tailscale (CGNAT)
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.0.2.1",
    "192.168.18.160", // LAN
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:10.0.0.1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe9a::1", // dentro de fe80::/10
    "febf::1",
    "ff02::1",
    "64:ff9b::c0a8:12a0", // NAT64 de 192.168.18.160
    "2002:c0a8:12a0::1", // 6to4 de 192.168.18.160
    "2001::1", // Teredo
    "2001:db8::1",
    "no-es-una-ip",
    "",
  ])("rejects non-public address %s", (ip) => {
    expect(isPublicUnicastAddress(ip)).toBe(false);
  });
});
