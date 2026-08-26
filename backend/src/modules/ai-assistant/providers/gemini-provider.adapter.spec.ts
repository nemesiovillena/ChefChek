import { GeminiProviderAdapter } from "./gemini-provider.adapter";

describe("GeminiProviderAdapter", () => {
  let adapter: GeminiProviderAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new GeminiProviderAdapter();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("mapea role assistant->model y user->user en el request saliente", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "AQ.key",
      "gemini-2.0-flash",
      [
        { role: "system", content: "Eres Chefchek." },
        { role: "user", content: "hola" },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.systemInstruction).toEqual({
      parts: [{ text: "Eres Chefchek." }],
    });
    expect(sentBody.contents).toEqual([
      { role: "user", parts: [{ text: "hola" }] },
    ]);
  });

  it("parsea functionCall parts como toolCalls", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "get_low_stock_products", args: {} } },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "AQ.key",
      "gemini-2.0-flash",
      [{ role: "user", content: "?" }],
      [],
    );
    expect(result.toolCalls).toEqual([
      {
        id: "get_low_stock_products-0",
        name: "get_low_stock_products",
        params: {},
      },
    ]);
  });

  it("captura thoughtSignature de una functionCall (Gemini 3.x 'thinking' models la exigen de vuelta)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "get_top_purchased_products",
                    args: {},
                  },
                  thoughtSignature: "opaque-sig-abc123",
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "AQ.key",
      "gemini-3.7-flash",
      [{ role: "user", content: "?" }],
      [],
    );
    expect(result.toolCalls?.[0].thoughtSignature).toBe("opaque-sig-abc123");
  });

  it("reenvía thoughtSignature en la parte functionCall al reconstruir el turno model (400 real reproducido si se omite)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "AQ.key",
      "gemini-3.7-flash",
      [
        { role: "user", content: "?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "get_top_purchased_products-0",
              name: "get_top_purchased_products",
              params: {},
              thoughtSignature: "opaque-sig-abc123",
            },
          ],
        },
        {
          role: "tool",
          content: "{}",
          toolCallId: "get_top_purchased_products-0",
          toolName: "get_top_purchased_products",
        },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.contents[1].parts[0].thoughtSignature).toBe(
      "opaque-sig-abc123",
    );
  });

  it("agrupa 2+ mensajes role='tool' consecutivos (parallel tool calling) en UN solo turno role='user', nunca dos user seguidos", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "AQ.key",
      "gemini-2.0-flash",
      [
        { role: "user", content: "¿quién subió precios y qué se compró más?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "get_price_increases-0",
              name: "get_price_increases",
              params: {},
            },
            {
              id: "get_top_purchased_products-0",
              name: "get_top_purchased_products",
              params: {},
            },
          ],
        },
        {
          role: "tool",
          content: '{"a":1}',
          toolCallId: "get_price_increases-0",
          toolName: "get_price_increases",
        },
        {
          role: "tool",
          content: '{"b":2}',
          toolCallId: "get_top_purchased_products-0",
          toolName: "get_top_purchased_products",
        },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    // 3 contents: user pregunta, model con 2 functionCall, y UN user con las 2 functionResponse.
    expect(sentBody.contents).toHaveLength(3);
    expect(sentBody.contents[2]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "get_price_increases",
            response: { result: '{"a":1}' },
          },
        },
        {
          functionResponse: {
            name: "get_top_purchased_products",
            response: { result: '{"b":2}' },
          },
        },
      ],
    });
  });

  it("traduce mensaje role='tool' a functionResponse usando toolName (no el id)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "AQ.key",
      "gemini-2.0-flash",
      [
        {
          role: "tool",
          content: '{"quantity":30}',
          toolCallId: "get_top_purchased_products-0",
          toolName: "get_top_purchased_products",
        },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.contents[0].parts[0].functionResponse).toEqual({
      name: "get_top_purchased_products",
      response: { result: '{"quantity":30}' },
    });
  });
});
