import { BadRequestException } from "@nestjs/common";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  AssistantCompletionError,
  AssistantCompletionService,
} from "./assistant-completion.service";
import {
  MODEL_UNAVAILABLE_MESSAGE,
  PROVIDER_ERROR_MESSAGE,
  PROVIDER_OVERLOADED_MESSAGE,
  PROVIDER_QUOTA_MESSAGE,
} from "./provider-error-message.util";

describe("AssistantCompletionService", () => {
  const config = { resolveForRequest: jest.fn() };
  const openai = { chat: jest.fn() };
  const gemini = { chat: jest.fn() };
  const anthropic = { chat: jest.fn() };
  let service: AssistantCompletionService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AssistantCompletionService(
      config as any,
      openai as any,
      gemini as any,
      anthropic as any,
    );
    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
  });

  it("llama al adaptador del proveedor configurado, sin tools y con las opciones", async () => {
    config.resolveForRequest.mockResolvedValue({
      provider: "gemini",
      model: "gemini-x",
      apiKey: "k",
    });
    gemini.chat.mockResolvedValue({ content: "{}" });
    const messages = [{ role: "user" as const, content: "hola" }];

    const result = await service.complete("t1", messages, {
      maxOutputTokens: 4096,
    });

    expect(result).toEqual({ content: "{}" });
    expect(gemini.chat).toHaveBeenCalledWith("k", "gemini-x", messages, [], {
      maxOutputTokens: 4096,
    });
    expect(openai.chat).not.toHaveBeenCalled();
  });

  it("assertConfigured lanza 400 accionable si la config está incompleta", async () => {
    config.resolveForRequest.mockResolvedValue(null);

    await expect(service.assertConfigured("t1")).rejects.toThrow(
      new BadRequestException(AI_NOT_CONFIGURED_MESSAGE),
    );
  });

  it.each([
    ["Gemini respondió 404: models/x not found", MODEL_UNAVAILABLE_MESSAGE],
    ["OpenAI respondió 503: overloaded", PROVIDER_OVERLOADED_MESSAGE],
    ["Gemini respondió 429: resource exhausted", PROVIDER_OVERLOADED_MESSAGE],
    [
      "Gemini respondió 429: You exceeded your current quota, please check your plan and billing details",
      PROVIDER_QUOTA_MESSAGE,
    ],
    [
      'OpenAI respondió 429: {"code":"insufficient_quota"}',
      PROVIDER_QUOTA_MESSAGE,
    ],
    ['Anthropic respondió 401: {"secret":"sk-abc"}', PROVIDER_ERROR_MESSAGE],
  ])(
    "traduce el error del proveedor y nunca muestra el cuerpo crudo: %s",
    async (raw, expected) => {
      config.resolveForRequest.mockResolvedValue({
        provider: "openai",
        model: "m",
        apiKey: "k",
      });
      openai.chat.mockRejectedValue(new Error(raw));

      const error = await service
        .complete("t1", [{ role: "user", content: "x" }])
        .catch((e) => e);

      expect(error).toBeInstanceOf(AssistantCompletionError);
      expect(error.message).toBe(expected);
      expect(error.message).not.toContain("sk-abc");
    },
  );
});
