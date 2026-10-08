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

  describe("adjuntos y opciones por llamada", () => {
    const respond = (finish: string) =>
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: finish,
              message: { role: "assistant", content: "{}" },
            },
          ],
        }),
      });

    it("envía adjuntos, tope de salida y modo JSON cuando se piden", async () => {
      const fetchMock = respond("stop");
      global.fetch = fetchMock as any;

      await adapter.chat(
        "key",
        "gpt-4o-mini",
        [
          {
            role: "user",
            content: "lee esto",
            attachments: [
              { mimeType: "image/png", dataBase64: "AAA" },
              { mimeType: "application/pdf", dataBase64: "BBB" },
            ],
          },
        ],
        [],
        { maxOutputTokens: 4096, jsonMode: true },
      );

      const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
      expect(sentBody.max_completion_tokens).toBe(4096);
      expect(sentBody.response_format).toEqual({ type: "json_object" });
      expect(sentBody.messages[0].content).toEqual([
        { type: "text", text: "lee esto" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
        {
          type: "file",
          file: {
            filename: "documento.pdf",
            file_data: "data:application/pdf;base64,BBB",
          },
        },
      ]);
    });

    it("sin opciones ni adjuntos el cuerpo es el de siempre", async () => {
      const fetchMock = respond("stop");
      global.fetch = fetchMock as any;

      const result = await adapter.chat(
        "key",
        "gpt-4o-mini",
        [{ role: "user", content: "hola" }],
        [],
      );

      const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
      expect(sentBody).toEqual({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hola" }],
      });
      expect(result.truncated).toBeUndefined();
    });

    it("avisa cuando el proveedor corta la respuesta por el tope de tokens", async () => {
      global.fetch = respond("length") as any;

      const result = await adapter.chat(
        "key",
        "gpt-4o-mini",
        [{ role: "user", content: "hola" }],
        [],
      );

      expect(result.truncated).toBe(true);
    });

    it("no reintenta cuando se pide noRetry", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: { get: () => null },
        text: async () => "sobrecargado",
      });
      global.fetch = fetchMock as any;

      await expect(
        adapter.chat(
          "key",
          "gpt-4o-mini",
          [{ role: "user", content: "hola" }],
          [],
          {
            noRetry: true,
          },
        ),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
