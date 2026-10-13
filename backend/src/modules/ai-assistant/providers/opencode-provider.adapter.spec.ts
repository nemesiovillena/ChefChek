import { BadGatewayException } from "@nestjs/common";
import { OpenCodeProviderAdapter } from "./opencode-provider.adapter";

describe("OpenCodeProviderAdapter", () => {
  let adapter: OpenCodeProviderAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new OpenCodeProviderAdapter();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("llama al endpoint OpenAI-compatible de OpenCode Zen con Bearer", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "Hola." } }],
      }),
    });
    global.fetch = fetchMock as any;

    const result = await adapter.chat(
      "sk-oc",
      "deepseek-v4-flash",
      [{ role: "user", content: "hola" }],
      [],
    );

    expect(result).toEqual({ content: "Hola.", toolCalls: undefined });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://opencode.ai/zen/v1/chat/completions",
    );
    expect((fetchMock.mock.calls[0][1] as any).headers.Authorization).toBe(
      "Bearer sk-oc",
    );
  });

  it("parsea tool_calls igual que el formato de OpenAI", async () => {
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
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "get_stock",
                    arguments: '{"product":"harina"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await adapter.chat(
      "sk-oc",
      "glm-5.3-flash",
      [{ role: "user", content: "?" }],
      [],
    );

    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_stock", params: { product: "harina" } },
    ]);
  });

  it("etiqueta los errores como OpenCode Zen (no como OpenAI)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Invalid API key",
    }) as any;

    await expect(
      adapter.chat(
        "sk-bad",
        "deepseek-v4-flash",
        [{ role: "user", content: "?" }],
        [],
      ),
    ).rejects.toThrow(/OpenCode Zen respondió 401/);
    await expect(
      adapter.chat(
        "sk-bad",
        "deepseek-v4-flash",
        [{ role: "user", content: "?" }],
        [],
      ),
    ).rejects.toThrow(BadGatewayException);
  });
});
