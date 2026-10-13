import * as http from "http";
import * as zlib from "zlib";
import { AddressInfo } from "net";
import { fetchPublicPage, PageFetchError } from "./safe-page-fetcher";

// Registro de los descompresores brotli que crea el código bajo prueba, para
// poder comprobar que se detienen (las funciones de `zlib` no admiten espías).
const brotliDecompressors: {
  stream: zlib.BrotliDecompress;
  produced: number;
}[] = [];
jest.mock("zlib", () => {
  const actual = jest.requireActual("zlib");
  return {
    ...actual,
    createBrotliDecompress: (options?: zlib.BrotliOptions) => {
      const entry = {
        stream: actual.createBrotliDecompress(options),
        produced: 0,
      };
      entry.stream.on(
        "data",
        (chunk: Buffer) => (entry.produced += chunk.length),
      );
      brotliDecompressors.push(entry);
      return entry.stream;
    },
  };
});

/**
 * Servidor HTTP real en loopback: permite contar conexiones abiertas (la
 * prueba de que una URL rechazada no llega a tocar la red) y comprobar que la
 * petición va a la dirección resuelta y validada, no a una segunda resolución.
 */
describe("fetchPublicPage", () => {
  let server: http.Server;
  let port: number;
  let connections: number;
  let handler: http.RequestListener;

  beforeAll(async () => {
    server = http.createServer((req, res) => handler(req, res));
    server.on("connection", () => connections++);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    connections = 0;
    handler = (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end("<html><body>hola</body></html>");
    };
  });

  const loopback = [{ address: "127.0.0.1", family: 4 }];
  // Solo para tests: trata loopback como público para poder llegar al servidor.
  const trustLoopback = () => ({
    allowedPorts: [port],
    isPublicAddress: () => true,
  });

  describe("rechaza sin abrir conexión", () => {
    it.each([
      ["host literal privado", () => `http://192.168.18.160:${port}/`],
      ["loopback literal", () => `http://127.0.0.1:${port}/`],
      ["Tailscale literal", () => `http://100.68.34.99:${port}/`],
      ["IPv6 loopback", () => `http://[::1]:${port}/`],
      ["localhost", () => `http://localhost:${port}/`],
      ["esquema no http", () => "file:///etc/passwd"],
      [
        "credenciales en la URL",
        () => `http://user:pass@recetas.test:${port}/`,
      ],
    ])("%s", async (_name, url) => {
      const resolve = jest.fn().mockResolvedValue(loopback);
      await expect(
        fetchPublicPage(url(), { resolve, allowedPorts: [port] }),
      ).rejects.toBeInstanceOf(PageFetchError);
      expect(resolve).not.toHaveBeenCalled();
      expect(connections).toBe(0);
    });

    it("puerto distinto de 80/443", async () => {
      const resolve = jest.fn().mockResolvedValue(loopback);
      await expect(
        fetchPublicPage(`http://recetas.test:${port}/`, { resolve }),
      ).rejects.toBeInstanceOf(PageFetchError);
      expect(resolve).not.toHaveBeenCalled();
      expect(connections).toBe(0);
    });

    it("dominio que resuelve a una dirección privada", async () => {
      const resolve = jest.fn().mockResolvedValue(loopback);
      await expect(
        fetchPublicPage(`http://recetas.test:${port}/`, {
          resolve,
          allowedPorts: [port],
        }),
      ).rejects.toThrow("no es una página web pública");
      expect(connections).toBe(0);
    });

    it("dominio con una dirección pública y otra privada", async () => {
      const resolve = jest.fn().mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]);
      await expect(
        fetchPublicPage(`http://recetas.test:${port}/`, {
          resolve,
          allowedPorts: [port],
        }),
      ).rejects.toBeInstanceOf(PageFetchError);
      expect(connections).toBe(0);
    });
  });

  it("conecta a la dirección validada y no vuelve a resolver el host", async () => {
    // `.invalid` no existe en DNS: si la petición resolviera por su cuenta
    // fallaría. Además el resolvedor cambiaría de respuesta en una 2ª llamada.
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(loopback)
      .mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    const html = await fetchPublicPage(`http://recetas.invalid:${port}/tarta`, {
      resolve,
      ...trustLoopback(),
    });

    expect(html).toContain("hola");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(connections).toBe(1);
  });

  it("revalida cada redirección y rechaza la que apunta a una IP privada", async () => {
    let hits = 0;
    handler = (_req, res) => {
      hits++;
      res.statusCode = 302;
      res.setHeader("Location", `http://192.168.18.160:${port}/admin`);
      res.end();
    };

    await expect(
      fetchPublicPage(`http://recetas.invalid:${port}/`, {
        resolve: jest.fn().mockResolvedValue(loopback),
        ...trustLoopback(),
      }),
    ).rejects.toThrow("no es una página web pública");
    expect(hits).toBe(1);
  });

  it("sigue redirecciones válidas hasta un máximo", async () => {
    handler = (req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", `${req.url}x`);
      res.end();
    };

    await expect(
      fetchPublicPage(`http://recetas.invalid:${port}/`, {
        resolve: jest.fn().mockResolvedValue(loopback),
        ...trustLoopback(),
      }),
    ).rejects.toThrow("redirige demasiadas veces");
  });

  it("rechaza contenido que no es HTML", async () => {
    handler = (_req, res) => {
      res.setHeader("Content-Type", "application/pdf");
      res.end("%PDF");
    };

    await expect(
      fetchPublicPage(`http://recetas.invalid:${port}/`, {
        resolve: jest.fn().mockResolvedValue(loopback),
        ...trustLoopback(),
      }),
    ).rejects.toBeInstanceOf(PageFetchError);
  });

  it("explica cuando la web bloquea el acceso", async () => {
    handler = (_req, res) => {
      res.statusCode = 403;
      res.end();
    };

    await expect(
      fetchPublicPage(`http://recetas.invalid:${port}/`, {
        resolve: jest.fn().mockResolvedValue(loopback),
        ...trustLoopback(),
      }),
    ).rejects.toThrow("bloquea el acceso automático");
  });

  it("corta en 2 MB un cuerpo comprimido que se expande más", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, "a");
    handler = (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Encoding", "gzip");
      res.end(zlib.gzipSync(big));
    };

    const html = await fetchPublicPage(`http://recetas.invalid:${port}/`, {
      resolve: jest.fn().mockResolvedValue(loopback),
      ...trustLoopback(),
    });

    expect(html.length).toBe(2 * 1024 * 1024);
  });

  // Una respuesta de 3 KB puede expandirse a gigas: tras devolver los 2 MB
  // el descompresor tiene que parar, no seguir llenando memoria.
  it("detiene la descompresión al alcanzar el límite", async () => {
    const bomb = zlib.brotliCompressSync(Buffer.alloc(256 * 1024 * 1024));
    handler = (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Encoding", "br");
      res.end(bomb);
    };
    brotliDecompressors.length = 0;

    const html = await fetchPublicPage(`http://recetas.invalid:${port}/`, {
      resolve: jest.fn().mockResolvedValue(loopback),
      ...trustLoopback(),
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(html.length).toBe(2 * 1024 * 1024);
    expect(brotliDecompressors).toHaveLength(1);
    expect(brotliDecompressors[0].stream.destroyed).toBe(true);
    expect(brotliDecompressors[0].produced).toBeLessThan(4 * 1024 * 1024);
  });

  it("no reutiliza la conexión de una petición anterior al mismo host", async () => {
    const resolve = jest.fn().mockResolvedValue(loopback);
    const url = `http://recetas.invalid:${port}/`;

    await fetchPublicPage(url, { resolve, ...trustLoopback() });
    await fetchPublicPage(url, { resolve, ...trustLoopback() });

    expect(connections).toBe(2);
  });

  it("rechaza con el resolvedor real un nombre que resuelve a loopback", async () => {
    await expect(
      fetchPublicPage(`http://localhost.:${port}/`, { allowedPorts: [port] }),
    ).rejects.toBeInstanceOf(PageFetchError);
    expect(connections).toBe(0);
  });

  it("decodifica páginas en ISO-8859-1", async () => {
    handler = (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=ISO-8859-1");
      res.end(Buffer.from("<p>jamón y piña</p>", "latin1"));
    };

    const html = await fetchPublicPage(`http://recetas.invalid:${port}/`, {
      resolve: jest.fn().mockResolvedValue(loopback),
      ...trustLoopback(),
    });

    expect(html).toContain("jamón y piña");
  });

  it("usa el charset del <meta> cuando la cabecera no lo indica", async () => {
    handler = (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        Buffer.from(
          '<html><head><meta charset="windows-1252"></head><p>azúcar</p>',
          "latin1",
        ),
      );
    };

    const html = await fetchPublicPage(`http://recetas.invalid:${port}/`, {
      resolve: jest.fn().mockResolvedValue(loopback),
      ...trustLoopback(),
    });

    expect(html).toContain("azúcar");
  });
});
