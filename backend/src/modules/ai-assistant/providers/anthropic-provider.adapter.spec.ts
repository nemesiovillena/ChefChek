import { AnthropicProviderAdapter } from "./anthropic-provider.adapter";

describe("AnthropicProviderAdapter", () => {
  let adapter: AnthropicProviderAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new AnthropicProviderAdapter();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("saca el system prompt de los mensajes y lo manda en el campo `system` aparte", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "sk-ant",
      "claude-3-5-haiku-latest",
      [
        { role: "system", content: "Eres Chefchek." },
        { role: "user", content: "hola" },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.system).toBe("Eres Chefchek.");
    expect(sentBody.messages).toEqual([{ role: "user", content: "hola" }]);
  });

  it("parsea tool_use blocks como toolCalls", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "get_recipe_cost",
            input: { recipeName: "Paella" },
          },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "sk-ant",
      "claude-3-5-haiku-latest",
      [{ role: "user", content: "?" }],
      [],
    );

    expect(result.toolCalls).toEqual([
      {
        id: "toolu_1",
        name: "get_recipe_cost",
        params: { recipeName: "Paella" },
      },
    ]);
    expect(result.content).toBeUndefined();
  });

  it("agrupa 2+ mensajes role='tool' consecutivos (parallel tool calling) en UN solo turno user, nunca dos user seguidos", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "sk-ant",
      "claude-3-5-haiku-latest",
      [
        { role: "user", content: "¿quién subió precios y qué se compró más?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "toolu_1", name: "get_price_increases", params: {} },
            { id: "toolu_2", name: "get_top_purchased_products", params: {} },
          ],
        },
        { role: "tool", content: '{"a":1}', toolCallId: "toolu_1" },
        { role: "tool", content: '{"b":2}', toolCallId: "toolu_2" },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    // 3 mensajes: user pregunta, assistant con 2 tool_use, y UN user con los 2 tool_result.
    expect(sentBody.messages).toHaveLength(3);
    expect(sentBody.messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_1", content: '{"a":1}' },
        { type: "tool_result", tool_use_id: "toolu_2", content: '{"b":2}' },
      ],
    });
  });

  it("traduce mensaje role='tool' a un content block tool_result dentro de un mensaje role='user'", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "sk-ant",
      "claude-3-5-haiku-latest",
      [{ role: "tool", content: '{"total":9.5}', toolCallId: "toolu_1" }],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.messages[0]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_1",
          content: '{"total":9.5}',
        },
      ],
    });
  });
});
