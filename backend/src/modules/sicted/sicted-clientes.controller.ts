import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { SictedFeedbackService } from "./services/sicted-feedback.service";
import { SictedSatisfactionService } from "./services/sicted-satisfaction.service";
import { SictedLostItemService } from "./services/sicted-lost-item.service";
import {
  CloseFeedbackDto,
  CreateFeedbackDto,
  RespondFeedbackDto,
} from "./dto/sicted-feedback.dto";
import { CreateSatisfactionSampleDto } from "./dto/sicted-satisfaction.dto";
import {
  CreateLostItemDto,
  ReturnLostItemDto,
} from "./dto/sicted-lost-item.dto";

/**
 * Fachada SICTED de Cliente y sostenibilidad (fase 8): quejas/sugerencias/
 * felicitaciones, satisfacción, objetos perdidos. Sin formulario público por
 * QR — solo captura interna por el personal (`@Roles("USER")`).
 */
@Controller("api/v1/sicted/clientes")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedClientesController {
  constructor(
    private readonly feedback: SictedFeedbackService,
    private readonly satisfaction: SictedSatisfactionService,
    private readonly lostItems: SictedLostItemService,
  ) {}

  // ──────────────────────────────────────────── Quejas/sugerencias/felicitaciones

  @Get("feedback")
  @Roles("USER")
  async listFeedback(@Req() req: any, @Query("status") status?: string) {
    const data = await this.feedback.list(req.tenantId, status);
    return { success: true, data };
  }

  @Get("feedback/overdue")
  @Roles("USER")
  async overdueFeedback(@Req() req: any) {
    const data = await this.feedback.overdue(req.tenantId);
    return { success: true, data };
  }

  @Get("feedback/:id")
  @Roles("USER")
  async getFeedback(@Req() req: any, @Param("id") id: string) {
    const data = await this.feedback.getOneVisible(req.tenantId, id);
    return { success: true, data };
  }

  @Post("feedback")
  @Roles("USER")
  async createFeedback(@Req() req: any, @Body() dto: CreateFeedbackDto) {
    const data = await this.feedback.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Post("feedback/:id/respond")
  @Roles("ADMIN", "OWNER")
  async respondFeedback(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: RespondFeedbackDto,
  ) {
    const data = await this.feedback.respond(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Post("feedback/:id/close")
  @Roles("ADMIN", "OWNER")
  async closeFeedback(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CloseFeedbackDto,
  ) {
    const data = await this.feedback.close(req.tenantId, id, dto);
    return { success: true, data };
  }

  // ──────────────────────────────────────────────────────────── Satisfacción

  @Get("satisfaction")
  @Roles("USER")
  async listSatisfaction(@Req() req: any) {
    const data = await this.satisfaction.list(req.tenantId);
    return { success: true, data };
  }

  @Post("satisfaction")
  @Roles("USER")
  async createSatisfaction(
    @Req() req: any,
    @Body() dto: CreateSatisfactionSampleDto,
  ) {
    const data = await this.satisfaction.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Get("satisfaction/monthly-summary")
  @Roles("USER")
  async satisfactionMonthlySummary(
    @Req() req: any,
    @Query("year") yearParam?: string,
    @Query("month") monthParam?: string,
  ) {
    const now = new Date();
    const year = yearParam ? Number(yearParam) : now.getFullYear();
    const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException("year/month inválidos");
    }
    const data = await this.satisfaction.monthlySummary(
      req.tenantId,
      year,
      month,
    );
    return { success: true, data };
  }

  // ─────────────────────────────────────────────────────────── Objetos perdidos

  @Get("lost-items")
  @Roles("USER")
  async listLostItems(
    @Req() req: any,
    @Query("onlyPending") onlyPending?: string,
  ) {
    const data = await this.lostItems.list(
      req.tenantId,
      onlyPending === "true",
    );
    return { success: true, data };
  }

  @Post("lost-items")
  @Roles("USER")
  async createLostItem(@Req() req: any, @Body() dto: CreateLostItemDto) {
    const data = await this.lostItems.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Post("lost-items/:id/return")
  @Roles("USER")
  async returnLostItem(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ReturnLostItemDto,
  ) {
    const data = await this.lostItems.markReturned(req.tenantId, id, dto);
    return { success: true, data };
  }
}
