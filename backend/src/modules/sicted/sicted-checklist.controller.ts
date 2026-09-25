import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { ChecklistTemplateService } from "../checklists/services/checklist-template.service";
import { ChecklistRunService } from "../checklists/services/checklist-run.service";
import {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
} from "../checklists/dto/checklist-template.dto";
import {
  CreateChecklistEntriesDto,
  SuperviseChecklistRunDto,
} from "../checklists/dto/checklist-entry.dto";
import { CHECKLIST_STARTER_TEMPLATES } from "../checklists/constants/checklist-starter-templates.constant";

/**
 * Fachada SICTED del motor de checklist compartido (fase 2). Todas las
 * consultas/escrituras filtran por `usedByModules` incluye "sicted" — una
 * plantilla/hoja que exista solo para "appcc" es invisible aquí (404), aunque
 * la fila subyacente sea la misma.
 */
@Controller("api/v1/sicted/checklists")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedChecklistController {
  private readonly module = "sicted" as const;

  constructor(
    private readonly templates: ChecklistTemplateService,
    private readonly runs: ChecklistRunService,
  ) {}

  @Get("templates")
  async listTemplates(@Req() req: any, @Query("area") area?: string) {
    const data = await this.templates.list(req.tenantId, this.module, area);
    return { success: true, data };
  }

  @Post("templates")
  @Roles("ADMIN", "OWNER")
  async createTemplate(
    @Req() req: any,
    @Body() dto: CreateChecklistTemplateDto,
  ) {
    const data = await this.templates.create(
      req.tenantId,
      this.module,
      req.user.id,
      dto,
    );
    return { success: true, data };
  }

  @Put("templates/:id")
  @Roles("ADMIN", "OWNER")
  async updateTemplate(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    const data = await this.templates.update(
      req.tenantId,
      this.module,
      id,
      dto,
    );
    return { success: true, data };
  }

  @Post("templates/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archiveTemplate(@Req() req: any, @Param("id") id: string) {
    const data = await this.templates.archive(req.tenantId, this.module, id);
    return { success: true, data };
  }

  /** Plantillas de ejemplo (digitalizadas de documentos reales de Warynessy); idempotente. */
  @Post("templates/starter")
  @Roles("ADMIN", "OWNER")
  async seedStarterTemplates(@Req() req: any) {
    const created = [];
    for (const starter of CHECKLIST_STARTER_TEMPLATES) {
      created.push(
        await this.templates.seedStarter(
          req.tenantId,
          this.module,
          req.user.id,
          starter,
        ),
      );
    }
    return { success: true, data: created };
  }

  @Get("runs/today")
  @Roles("USER")
  async runsToday(@Req() req: any) {
    await this.runs.ensureRunsForToday(req.tenantId, this.module);
    const data = await this.runs.listRuns(req.tenantId, this.module, {
      from: new Date(new Date().setUTCHours(0, 0, 0, 0)),
    });
    return { success: true, data };
  }

  @Get("runs")
  @Roles("USER")
  async listRuns(
    @Req() req: any,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("templateId") templateId?: string,
    @Query("status") status?: string,
    @Query("area") area?: string,
  ) {
    const data = await this.runs.listRuns(req.tenantId, this.module, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      templateId,
      status,
      area,
    });
    return { success: true, data };
  }

  @Get("runs/:id")
  @Roles("USER")
  async getRun(@Req() req: any, @Param("id") id: string) {
    const data = await this.runs.getRun(req.tenantId, this.module, id);
    return { success: true, data };
  }

  @Post("runs/:id/entries")
  @Roles("USER")
  async addEntries(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CreateChecklistEntriesDto,
  ) {
    const data = await this.runs.addEntries(
      req.tenantId,
      this.module,
      id,
      req.user.id,
      dto.entries,
    );
    return { success: true, data };
  }

  @Post("runs/:id/supervise")
  @Roles("ADMIN", "OWNER")
  async supervise(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SuperviseChecklistRunDto,
  ) {
    const data = await this.runs.supervise(
      req.tenantId,
      this.module,
      id,
      req.user.id,
      dto,
    );
    return { success: true, data };
  }

  @Get("performers")
  @Roles("USER")
  async performers(@Req() req: any) {
    const data = await this.runs.listPerformers(req.tenantId);
    return { success: true, data };
  }
}
