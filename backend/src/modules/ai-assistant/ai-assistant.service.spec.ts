import { Test } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AiAssistantService } from "./ai-assistant.service";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";
import { AiAssistantConfigService } from "./config/ai-assistant-config.service";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { OpenAiProviderAdapter } from "./providers/openai-provider.adapter";
import { GeminiProviderAdapter } from "./providers/gemini-provider.adapter";
import { AnthropicProviderAdapter } from "./providers/anthropic-provider.adapter";

function makePrismaMock() {
  const conversations = new Map<string, any>();
  const messages: any[] = [];
  let idCounter = 0;
  return {
    conversations,
    messages,
    assistantConversation: {
      create: jest.fn(async ({ data }: any) => {
        const conv = {
          id: `conv-${++idCounter}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversations.set(conv.id, conv);
        return conv;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        const conv = conversations.get(where.id);
        if (!conv) {
          return null;
        }
        if (include?.messages) {
          return {
            ...conv,
            messages: messages.filter((m) => m.conversationId === conv.id),
          };
        }
        return conv;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        [...conversations.values()].filter(
          (c) => c.tenantId === where.tenantId && c.userId === where.userId,
        ),
      ),
      update: jest.fn(async ({ where }: any) => {
        const conv = conversations.get(where.id);
        if (conv) {
          conv.updatedAt = new Date();
        }
        return conv;
      }),
    },
    assistantMessage: {
      create: jest.fn(async ({ data }: any) => {
        // createdAt monotónico: Date.now() puede repetirse entre creates
        // consecutivos en el mismo tick, y el orden importa para el
        // recorte de historial (loadRecentHistory ordena por createdAt).
        const msg = {
          id: `msg-${++idCounter}`,
          createdAt: new Date(Date.now() + idCounter),
          ...data,
        };
        messages.push(msg);
        return msg;
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        let result = messages
          .filter((m) => m.conversationId === where.conversationId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (orderBy?.createdAt === "desc") {
          result = [...result].reverse();
        }
        if (typeof take === "number") {
          result = result.slice(0, take);
        }
        return result;
      }),
    },
  };
}

describe("AiAssistantService", () => {
  let service: AiAssistantService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let configMock: any;
  let toolRegistryMock: any;
  let openaiMock: any;
  let roleAccessMock: { isSectionAllowed: jest.Mock };

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    configMock = {
      resolveForRequest: jest.fn().mockResolvedValue({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-test",
      }),
    };
    toolRegistryMock = {
      getToolSchemas: jest.fn().mockReturnValue([
        {
          name: "get_top_purchased_products",
          description: "d",
          parameters: { type: "object", properties: {} },
        },
      ]),
      executeTool: jest
        .fn()
        .mockResolvedValue({ productName: "Harina", quantity: 500 }),
    };
    openaiMock = { chat: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiAssistantConfigService, useValue: configMock },
        { provide: ToolRegistryService, useValue: toolRegistryMock },
        { provide: OpenAiProviderAdapter, useValue: openaiMock },
        { provide: GeminiProviderAdapter, useValue: {} },
        { provide: AnthropicProviderAdapter, useValue: {} },
        {
          provide: RoleAccessService,
          useValue: (roleAccessMock = {
            isSectionAllowed: jest.fn().mockResolvedValue(true),
          }),
        },
      ],
    }).compile();
    service = module.get(AiAssistantService);
  });

  it("sin config guardada, responde 200 con el mensaje de Chefchek pidiendo configurar (nunca lanza)", async () => {
    configMock.resolveForRequest.mockResolvedValueOnce(null);
    const result = await service.ask("t1", "u1", undefined, "hola");
    expect(result.answer).toContain("Ajustes");
    expect(openaiMock.chat).not.toHaveBeenCalled();
  });

  it("respuesta directa sin tools", async () => {
    openaiMock.chat.mockResolvedValueOnce({ content: "Todo bien por aquí." });
    const result = await service.ask("t1", "u1", undefined, "hola chefchek");
    expect(result.answer).toBe("Todo bien por aquí.");
    expect(toolRegistryMock.executeTool).not.toHaveBeenCalled();
  });

  it("rol sin acceso a coste: pide schema y ejecuta tools con canViewCosts=false", async () => {
    roleAccessMock.isSectionAllowed.mockImplementation(
      (_t: string, _r: string, key: string) =>
        Promise.resolve(key !== "recipes.cost"),
    );
    openaiMock.chat
      .mockResolvedValueOnce({
        toolCalls: [
          { id: "c1", name: "get_top_purchased_products", params: {} },
        ],
      })
      .mockResolvedValueOnce({ content: "listo" });

    await service.ask("t1", "u1", undefined, "¿compramos tomate?", "USER");

    expect(toolRegistryMock.getToolSchemas).toHaveBeenCalledWith({
      canViewCosts: false,
    });
    expect(toolRegistryMock.executeTool).toHaveBeenCalledWith(
      "t1",
      "get_top_purchased_products",
      {},
      { canViewCosts: false },
    );
  });

  it("respuesta con 1 tool call: ejecuta la tool y vuelve a llamar al provider", async () => {
    openaiMock.chat
      .mockResolvedValueOnce({
        toolCalls: [
          {
            id: "call-1",
            name: "get_top_purchased_products",
            params: { period: "week" },
          },
        ],
      })
      .mockResolvedValueOnce({ content: "Se compró más Harina (500 kg)." });

    const result = await service.ask(
      "t1",
      "u1",
      undefined,
      "¿qué se compró más?",
    );

    expect(toolRegistryMock.executeTool).toHaveBeenCalledWith(
      "t1",
      "get_top_purchased_products",
      { period: "week" },
      { canViewCosts: true },
    );
    expect(result.answer).toBe("Se compró más Harina (500 kg).");
    expect(openaiMock.chat).toHaveBeenCalledTimes(2);
  });

  it("respuesta con 2 tools encadenadas (2 turnos) antes de la respuesta final", async () => {
    openaiMock.chat
      .mockResolvedValueOnce({
        toolCalls: [{ id: "call-1", name: "tool_a", params: {} }],
      })
      .mockResolvedValueOnce({
        toolCalls: [{ id: "call-2", name: "tool_b", params: {} }],
      })
      .mockResolvedValueOnce({ content: "Respuesta final." });

    const result = await service.ask(
      "t1",
      "u1",
      undefined,
      "pregunta compleja",
    );

    expect(toolRegistryMock.executeTool).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe("Respuesta final.");
  });

  it("corta al llegar a MAX_TOOL_TURNS si el LLM insiste en pedir tools sin converger", async () => {
    openaiMock.chat.mockResolvedValue({
      toolCalls: [{ id: "call-x", name: "tool_a", params: {} }],
    });

    const result = await service.ask("t1", "u1", undefined, "pregunta en loop");

    expect(openaiMock.chat).toHaveBeenCalledTimes(4); // MAX_TOOL_TURNS
    expect(result.answer).not.toBe("");
    expect(typeof result.answer).toBe("string");
  });

  it("respuesta con 2 tool calls en el MISMO turno (parallel tool calling): ejecuta ambas antes de responder", async () => {
    openaiMock.chat
      .mockResolvedValueOnce({
        toolCalls: [
          { id: "call-1", name: "tool_a", params: {} },
          { id: "call-2", name: "tool_b", params: {} },
        ],
      })
      .mockResolvedValueOnce({ content: "Respuesta con ambos datos." });

    const result = await service.ask(
      "t1",
      "u1",
      undefined,
      "pregunta compuesta",
    );

    expect(toolRegistryMock.executeTool).toHaveBeenCalledTimes(2);
    expect(toolRegistryMock.executeTool).toHaveBeenNthCalledWith(
      1,
      "t1",
      "tool_a",
      {},
      { canViewCosts: true },
    );
    expect(toolRegistryMock.executeTool).toHaveBeenNthCalledWith(
      2,
      "t1",
      "tool_b",
      {},
      { canViewCosts: true },
    );
    expect(result.answer).toBe("Respuesta con ambos datos.");
  });

  it("si el proveedor falla (red/API), responde con un mensaje propio y NUNCA filtra el error crudo", async () => {
    openaiMock.chat.mockRejectedValueOnce(
      new Error("401 Unauthorized: sk-abc invalid"),
    );

    const result = await service.ask("t1", "u1", undefined, "pregunta");

    expect(result.answer).not.toContain("sk-abc");
    expect(result.answer).not.toContain("401");
    expect(result.answer).toContain("Ajustes");
  });

  it("toca updatedAt de la conversación tras responder (para que el listado ordene por actividad real)", async () => {
    openaiMock.chat.mockResolvedValueOnce({ content: "ok" });
    const result = await service.ask("t1", "u1", undefined, "hola");
    expect(prismaMock.assistantConversation.update).toHaveBeenCalledWith({
      where: { id: result.conversationId },
      data: {},
    });
  });

  it("recorta el historial mandado al proveedor a una ventana segura (no revienta el context window)", async () => {
    // Sembrar una conversación con más mensajes que MAX_HISTORY_MESSAGES (30),
    // simulando turnos previos ya persistidos.
    const conv = await prismaMock.assistantConversation.create({
      data: { tenantId: "t1", userId: "u1", title: "larga" },
    });
    for (let i = 0; i < 40; i++) {
      await prismaMock.assistantMessage.create({
        data: {
          conversationId: conv.id,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg ${i}`,
        },
      });
    }

    openaiMock.chat.mockResolvedValueOnce({ content: "ok" });
    await service.ask("t1", "u1", conv.id, "pregunta nueva");

    const sentMessages = openaiMock.chat.mock.calls[0][2]; // (apiKey, model, messages, tools)
    // +1 por el system prompt; la ventana real de historial nunca supera MAX_HISTORY_MESSAGES.
    expect(sentMessages.length).toBeLessThanOrEqual(31);
    // El primer mensaje de historial (tras el system prompt) siempre debe ser
    // role="user" — nunca un "assistant"/"tool" huérfano de un turno cortado.
    expect(sentMessages[1].role).toBe("user");
  });

  it("una tool desconocida/rota no rompe la request: el error vuelve como resultado de tool", async () => {
    toolRegistryMock.executeTool.mockRejectedValueOnce(
      new Error("Tool desconocida"),
    );
    openaiMock.chat
      .mockResolvedValueOnce({
        toolCalls: [{ id: "call-1", name: "tool_rota", params: {} }],
      })
      .mockResolvedValueOnce({ content: "No he podido con esa función." });

    const result = await service.ask("t1", "u1", undefined, "pregunta");
    expect(result.answer).toBe("No he podido con esa función.");
  });

  describe("getConversation — aislamiento", () => {
    it("lanza NotFoundException si la conversación no existe o es de otro tenant", async () => {
      const conv = await prismaMock.assistantConversation.create({
        data: { tenantId: "t1", userId: "u1", title: "x" },
      });
      await expect(
        service.getConversation("t2", "u1", conv.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("lanza ForbiddenException si la conversación es de otro usuario del mismo tenant", async () => {
      const conv = await prismaMock.assistantConversation.create({
        data: { tenantId: "t1", userId: "u1", title: "x" },
      });
      await expect(
        service.getConversation("t1", "u2", conv.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
