import { BadRequestException } from "@nestjs/common";
import { AssistantCompletionError } from "../ai-assistant/assistant-completion.service";
import {
  RECIPE_CAPTURE_NOT_CONFIGURED_MESSAGE,
  RecipeCaptureCompletionService,
} from "./recipe-capture-completion.service";

describe("RecipeCaptureCompletionService", () => {
  const captureConfig = { resolveForRequest: jest.fn() };
  const assistantConfig = { resolveForRequest: jest.fn() };
  const completion = { completeWith: jest.fn() };
  let service: RecipeCaptureCompletionService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new RecipeCaptureCompletionService(
      captureConfig as any,
      assistantConfig as any,
      completion as any,
    );
  });

  const capture = {
    provider: "opencode",
    model: "deepseek-v4-flash-vision-exp",
    apiKey: "sk-capture",
  };
  const assistant = {
    provider: "gemini",
    model: "gemini-flash-latest",
    apiKey: "sk-assistant",
  };

  it("usa la config propia de captura cuando está completa", async () => {
    captureConfig.resolveForRequest.mockResolvedValue(capture);
    completion.completeWith.mockResolvedValue({ content: "{}" });

    const result = await service.complete("t1", [
      { role: "user", content: "hola" },
    ]);

    expect(result).toEqual({ content: "{}" });
    expect(completion.completeWith).toHaveBeenCalledWith(
      capture,
      [{ role: "user", content: "hola" }],
      undefined,
    );
    // Con captura configurada ni se consulta la del asistente.
    expect(assistantConfig.resolveForRequest).not.toHaveBeenCalled();
  });

  it("cae a la config del asistente si la de captura no está configurada", async () => {
    captureConfig.resolveForRequest.mockResolvedValue(null);
    assistantConfig.resolveForRequest.mockResolvedValue(assistant);
    completion.completeWith.mockResolvedValue({ content: "ok" });

    await service.complete("t1", [{ role: "user", content: "x" }]);

    expect(completion.completeWith).toHaveBeenCalledWith(
      assistant,
      [{ role: "user", content: "x" }],
      undefined,
    );
  });

  it("assertConfigured lanza 400 accionable si no hay ninguna config", async () => {
    captureConfig.resolveForRequest.mockResolvedValue(null);
    assistantConfig.resolveForRequest.mockResolvedValue(null);

    await expect(service.assertConfigured("t1")).rejects.toThrow(
      new BadRequestException(RECIPE_CAPTURE_NOT_CONFIGURED_MESSAGE),
    );
  });

  it("assertConfigured no lanza si la config del asistente sirve de respaldo", async () => {
    captureConfig.resolveForRequest.mockResolvedValue(null);
    assistantConfig.resolveForRequest.mockResolvedValue(assistant);

    await expect(service.assertConfigured("t1")).resolves.toBeUndefined();
  });

  it("complete lanza AssistantCompletionError si no hay ninguna config", async () => {
    captureConfig.resolveForRequest.mockResolvedValue(null);
    assistantConfig.resolveForRequest.mockResolvedValue(null);

    await expect(
      service.complete("t1", [{ role: "user", content: "x" }]),
    ).rejects.toBeInstanceOf(AssistantCompletionError);
    expect(completion.completeWith).not.toHaveBeenCalled();
  });
});
