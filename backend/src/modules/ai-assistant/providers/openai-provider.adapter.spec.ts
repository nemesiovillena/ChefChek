import { BadGatewayException } from "@nestjs/common";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";

describe("OpenAiProviderAdapter", () => {
  let adapter: OpenAiProviderAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new OpenAiProviderAdapter();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parsea contenido de texto sin tool_calls", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { role: "assistant", content: "Hola, soy Chefchek." } },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "sk-x",
      "gpt-4o-mini",
      [{ role: "user", content: "hola" }],
      [],
    );
    expect(result).toEqual({
      content: "Hola, soy Chefchek.",
      toolCalls: undefined,
    });
  });

  it("parsea tool_calls y decodifica los argumentos JSON string a objeto", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function",
                  function: {
                    name: "get_top_purchased_products",
                    arguments: '{"period":"week"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "sk-x",
      "gpt-4o-mini",
      [{ role: "user", content: "?" }],
      [],
    );
    expect(result.toolCalls).toEqual([
      {
        id: "call_abc123",
        name: "get_top_purchased_products",
        params: { period: "week" },
      },
    ]);
  });

  it("traduce mensajes role='tool' a tool_call_id + role='assistant' con tool_calls al request saliente", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    global.fetch = fetchMock as any;

    await adapter.chat(
      "sk-x",
      "gpt-4o-mini",
      [
        { role: "user", content: "?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "get_x", params: { a: 1 } }],
        },
        { role: "tool", content: '{"result":42}', toolCallId: "call_1" },
      ],
      [],
    );

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(sentBody.messages[1]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_x", arguments: '{"a":1}' },
        },
      ],
    });
    expect(sentBody.messages[2]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"result":42}',
    });
  });

  it("lanza BadGatewayException si la API responde con error HTTP", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Invalid API key",
    }) as any;

    await expect(
      adapter.chat(
        "sk-bad",
        "gpt-4o-mini",
        [{ role: "user", content: "?" }],
        [],
      ),
    ).rejects.toThrow(BadGatewayException);
  });
});
