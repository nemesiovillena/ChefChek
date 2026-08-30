import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { AiAssistantConfigService } from "./config/ai-assistant-config.service";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { OpenAiProviderAdapter } from "./providers/openai-provider.adapter";
import { GeminiProviderAdapter } from "./providers/gemini-provider.adapter";
import { AnthropicProviderAdapter } from "./providers/anthropic-provider.adapter";
import {
  ChatMessage,
  ProviderAdapter,
} from "./providers/provider-adapter.interface";
import { AiAssistantProvider } from "./config/dto/ai-assistant-config.dto";
import { RoleAccessService } from "../role-access/role-access.service";

const MAX_TOOL_TURNS = 4;
/** Ventana de historial mandada al proveedor — evita reventar el context window en conversaciones largas (plan.md fase 6, hallazgo de code review). */
const MAX_HISTORY_MESSAGES = 30;
const NO_CONFIG_MESSAGE =
  "¡Hola! Soy Chefchek 👋 Todavía no tengo un proveedor de IA configurado para poder responderte. Ve a Ajustes → Asistente IA y configura tu proveedor y API key para que pueda empezar a ayudarte.";
const TOOL_LIMIT_MESSAGE =
  "No he conseguido completar la respuesta con los datos disponibles. ¿Puedes reformular la pregunta de forma más concreta?";
const PROVIDER_ERROR_MESSAGE =
  "He tenido un problema para conectar con el proveedor de IA. Revisa la configuración en Ajustes → Asistente IA (modelo/API key) e inténtalo de nuevo.";

const SYSTEM_PROMPT_BASE = `Eres "Chefchek", el asistente de IA de la aplicación ChefChek para hostelería.
Respondes SIEMPRE en español, con un tono cercano y profesional.
Para CUALQUIER dato numérico o de negocio (precios, compras, stock, costes de receta, proveedores, lotes) DEBES usar una de las funciones disponibles — nunca inventes cifras ni asumas datos que no te haya devuelto una función.
Si una función no encuentra lo que el usuario pide, dilo con claridad en vez de inventar una respuesta.
Sé breve y directo: dale al usuario la cifra o el dato que pide, sin rodeos.`;

/**
 * Ancla temporal para que el LLM pueda resolver expresiones relativas ("la
 * semana pasada", "este mes") al llamar a las funciones. Sin esto el modelo
 * adivina la fecha y falla.
 */
function buildSystemPrompt(now: Date): string {
  const hoy = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "full",
  }).format(now);
  return `${SYSTEM_PROMPT_BASE}
Hoy es ${hoy} (zona horaria Europe/Madrid). "La semana pasada" = de lunes a domingo de la semana natural anterior; "esta semana" = lunes a hoy.`;
}

/** Añadido al prompt cuando el rol no puede ver costes (sección `recipes.cost`). */
const NO_COST_ACCESS_PROMPT = `\n\nIMPORTANTE: este usuario NO tiene permiso para ver costes ni precios de compra. Si pregunta por importes, coste de recetas, gasto en compras, márgenes o variaciones de precio, responde con claridad que no tienes acceso a esa información para su rol. Sí puedes informarle de qué artículos se han comprado y en qué cantidades, y del stock.`;

export interface AskAssistantResult {
  conversationId: string;
  answer: string;
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly adapters: Record<AiAssistantProvider, ProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AiAssistantConfigService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly roleAccess: RoleAccessService,
    openai: OpenAiProviderAdapter,
    gemini: GeminiProviderAdapter,
    anthropic: AnthropicProviderAdapter,
  ) {
    this.adapters = { openai, gemini, anthropic };
  }

  async ask(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    userMessage: string,
    role?: string,
  ): Promise<AskAssistantResult> {
    const config = await this.configService.resolveForRequest(tenantId);
    if (!config) {
      // Sin proveedor configurado: degradar con mensaje propio, nunca 500 (plan.md fase 3).
      return {
        conversationId: conversationId ?? "",
        answer: NO_CONFIG_MESSAGE,
      };
    }

    const conversation = await this.resolveConversation(
      tenantId,
      userId,
      conversationId,
      userMessage,
    );
    await this.saveMessage(conversation.id, "user", userMessage);
    const history = await this.loadRecentHistory(conversation.id);

    const canViewCosts = await this.roleAccess.isSectionAllowed(
      tenantId,
      role,
      "recipes.cost",
    );

    const systemPrompt = buildSystemPrompt(new Date());
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: canViewCosts
          ? systemPrompt
          : systemPrompt + NO_COST_ACCESS_PROMPT,
      },
      ...history.map(
        (m): ChatMessage => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
          ...(m.toolCalls
            ? this.decodeToolCallsColumn(
                m.toolCalls as any,
                m.role as ChatMessage["role"],
              )
            : {}),
        }),
      ),
    ];

    const adapter = this.adapters[config.provider];
    const toolSchemas = this.toolRegistry.getToolSchemas({ canViewCosts });

    let turns = 0;
    let finalContent: string | undefined;

    while (turns < MAX_TOOL_TURNS) {
      let result;
      try {
        result = await adapter.chat(
          config.apiKey,
          config.model,
          messages,
          toolSchemas,
        );
      } catch (e: any) {
        // Nunca reenviar el error crudo del proveedor al usuario (podría filtrar
        // detalles internos) ni dejar la conversación en un estado roto: se
        // responde con un mensaje propio y se corta el loop en este turno.
        // Sí se loguea server-side para poder diagnosticar (proveedor/modelo,
        // nunca la API key ni el contenido de la pregunta del usuario).
        this.logger.error(
          `adapter.chat falló (provider=${config.provider}, model=${config.model}): ${e?.message ?? e}`,
          e?.stack,
        );
        finalContent = PROVIDER_ERROR_MESSAGE;
        break;
      }

      if (!result.toolCalls?.length) {
        finalContent = result.content?.trim() || TOOL_LIMIT_MESSAGE;
        break;
      }

      messages.push({
        role: "assistant",
        content: result.content ?? "",
        toolCalls: result.toolCalls,
      });
      await this.saveMessage(
        conversation.id,
        "assistant",
        result.content ?? "",
        result.toolCalls,
      );

      for (const call of result.toolCalls) {
        const toolResultText = await this.runTool(
          tenantId,
          call.name,
          call.params,
          canViewCosts,
        );
        messages.push({
          role: "tool",
          content: toolResultText,
          toolCallId: call.id,
          toolName: call.name,
        });
        await this.saveMessage(conversation.id, "tool", toolResultText, [
          { id: call.id, name: call.name, params: call.params },
        ]);
      }

      turns += 1;
    }

    const answer = finalContent ?? TOOL_LIMIT_MESSAGE;
    await this.saveMessage(conversation.id, "assistant", answer);
    // Toca updatedAt para que listConversations() (orden por actividad reciente)
    // refleje la conversación real, no solo su fecha de creación (hallazgo de code review).
    await this.prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: {},
    });

    return { conversationId: conversation.id, answer };
  }

  async listConversations(tenantId: string, userId: string) {
    return this.prisma.assistantConversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.assistantConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation || conversation.tenantId !== tenantId) {
      throw new NotFoundException("Conversación no encontrada");
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        "Esta conversación pertenece a otro usuario",
      );
    }
    return conversation;
  }

  /** Ejecuta un tool y siempre devuelve texto para el LLM — nunca lanza (una tool desconocida/rota se reporta como resultado, no rompe la request). */
  private async runTool(
    tenantId: string,
    name: string,
    params: Record<string, any>,
    canViewCosts: boolean,
  ): Promise<string> {
    try {
      const result = await this.toolRegistry.executeTool(
        tenantId,
        name,
        params,
        { canViewCosts },
      );
      return JSON.stringify(result);
    } catch (e: any) {
      return JSON.stringify({
        error: e?.message ?? "Error ejecutando la función",
      });
    }
  }

  private async resolveConversation(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    firstMessage: string,
  ) {
    if (conversationId) {
      const existing = await this.prisma.assistantConversation.findUnique({
        where: { id: conversationId },
      });
      if (
        existing &&
        existing.tenantId === tenantId &&
        existing.userId === userId
      ) {
        return existing;
      }
      // conversationId inválido/ajeno: se crea una nueva en vez de fallar silenciosamente sobre datos de otro usuario.
    }
    const title = firstMessage
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .join(" ")
      .slice(0, 80);
    return this.prisma.assistantConversation.create({
      data: { tenantId, userId, title: title || null },
    });
  }

  /**
   * Últimos MAX_HISTORY_MESSAGES, recortados a un límite "seguro": si la
   * ventana corta a mitad de un intercambio tool-calling, se descartan los
   * mensajes assistant/tool huérfanos al principio hasta el primer "user"
   * (nunca lleva tool_call_id pendiente, es un límite de turno real). El
   * mensaje "user" recién guardado siempre está presente (es el más reciente),
   * así que este límite nunca deja el historial vacío.
   */
  private async loadRecentHistory(conversationId: string) {
    const rows = await this.prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    const chronological = rows.reverse();
    const firstSafeIndex = chronological.findIndex((m) => m.role === "user");
    return firstSafeIndex > 0
      ? chronological.slice(firstSafeIndex)
      : chronological;
  }

  private async saveMessage(
    conversationId: string,
    role: "user" | "assistant" | "tool",
    content: string,
    toolCalls?: unknown,
  ) {
    await this.prisma.assistantMessage.create({
      data: {
        conversationId,
        role,
        content,
        ...(toolCalls ? { toolCalls: toolCalls as any } : {}),
      },
    });
  }

  private decodeToolCallsColumn(
    raw: any,
    role: ChatMessage["role"],
  ): Partial<ChatMessage> {
    if (role === "assistant" && Array.isArray(raw)) {
      return { toolCalls: raw };
    }
    if (role === "tool" && Array.isArray(raw) && raw[0]) {
      return { toolCallId: raw[0].id, toolName: raw[0].name };
    }
    return {};
  }
}
