import { BadGatewayException } from "@nestjs/common";
import { postJsonWithRetry } from "./provider-http.util";

/** Sin esperas reales entre intentos. Longitud 2 => hasta 3 intentos. */
const NO_WAIT = { retryDelaysMs: [0, 0] };

describe("postJsonWithRetry", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const ok = (json: unknown) => ({
    ok: true,
    status: 200,
    json: async () => json,
  });
  const httpError = (status: number, body = "boom") => ({
    ok: false,
    status,
    headers: { get: () => null },
    text: async () => body,
  });

  it("devuelve el JSON al primer intento cuando responde 200", async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ hello: "world" }));
    global.fetch = fetchMock as any;

    const data = await postJsonWithRetry(
      "Gemini",
      "https://x",
      { headers: {}, body: "{}" },
      NO_WAIT,
    );

    expect(data).toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta un 503 transitorio y devuelve la respuesta buena", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(httpError(503, "high demand"))
      .mockResolvedValueOnce(ok({ recovered: true }));
    global.fetch = fetchMock as any;

    const data = await postJsonWithRetry(
      "Gemini",
      "https://x",
      { headers: {}, body: "{}" },
      NO_WAIT,
    );

    expect(data).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta un 429 y luego un fallo de red antes de tener éxito", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(httpError(429))
      .mockRejectedValueOnce(
        Object.assign(new Error("ECONNRESET"), { name: "Error" }),
      )
      .mockResolvedValueOnce(ok({ ok: 1 }));
    global.fetch = fetchMock as any;

    const data = await postJsonWithRetry(
      "OpenAI",
      "https://x",
      { headers: {}, body: "{}" },
      NO_WAIT,
    );

    expect(data).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("agota los reintentos ante un 503 persistente y lanza BadGatewayException con el cuerpo", async () => {
    const fetchMock = jest.fn().mockResolvedValue(httpError(503, "still down"));
    global.fetch = fetchMock as any;

    await expect(
      postJsonWithRetry(
        "Gemini",
        "https://x",
        { headers: {}, body: "{}" },
        NO_WAIT,
      ),
    ).rejects.toThrow(/Gemini respondió 503: still down/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("NO reintenta un 400/401/404 — falla al primer intento", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(httpError(401, "Invalid API key"));
    global.fetch = fetchMock as any;

    await expect(
      postJsonWithRetry(
        "Anthropic",
        "https://x",
        { headers: {}, body: "{}" },
        NO_WAIT,
      ),
    ).rejects.toThrow(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("NO reintenta un timeout de la petición", async () => {
    const fetchMock = jest.fn().mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    global.fetch = fetchMock as any;

    await expect(
      postJsonWithRetry(
        "Gemini",
        "https://x",
        { headers: {}, body: "{}" },
        NO_WAIT,
      ),
    ).rejects.toThrow(/No se pudo conectar con Gemini/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respeta el header Retry-After (con tope) antes de reintentar", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: (h: string) => (h === "retry-after" ? "2" : null) },
        text: async () => "slow down",
      })
      .mockResolvedValueOnce(ok({ done: true }));
    global.fetch = fetchMock as any;
    const sleepSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
      fn: () => void,
    ) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as any);

    const data = await postJsonWithRetry("OpenAI", "https://x", {
      headers: {},
      body: "{}",
    });

    expect(data).toEqual({ done: true });
    expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    sleepSpy.mockRestore();
  });
});
