import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AiAssistantService } from "./ai-assistant.service";
import { AskAssistantDto } from "./dto/ask-assistant.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";

@Controller("api/v1/ai-assistant")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("asistente-ia")
@RequireSection("asistente-ia")
@Roles("ADMIN", "OWNER", "SUPERADMIN", "USER", "VIEWER")
export class AiAssistantController {
  constructor(private readonly assistantService: AiAssistantService) {}

  @Post("ask")
  // 200, no el 201 por defecto de Nest en POST: no se "crea" un recurso desde
  // la perspectiva del cliente, es una respuesta de chat (plan.md fase 3).
  @HttpCode(HttpStatus.OK)
  // Llamadas al LLM cuestan dinero: límite más estricto que el default global (100/60s).
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async ask(@Req() req: any, @Body() dto: AskAssistantDto) {
    const data = await this.assistantService.ask(
      req.tenantId,
      req.user.id,
      dto.conversationId,
      dto.message,
      req.user?.role,
    );
    return { success: true, data };
  }

  @Get("conversations")
  async listConversations(@Req() req: any) {
    const data = await this.assistantService.listConversations(
      req.tenantId,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get("conversations/:id")
  async getConversation(@Req() req: any, @Param("id") id: string) {
    const data = await this.assistantService.getConversation(
      req.tenantId,
      req.user.id,
      id,
    );
    return { success: true, data };
  }
}
