import { BadRequestException } from "@nestjs/common";
import { assertPublicHttpUrl } from "./ssrf-safe-url.util";

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
