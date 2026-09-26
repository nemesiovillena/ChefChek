import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { SictedPracticeCatalogService } from "./services/sicted-practice-catalog.service";
import { SictedAssessmentService } from "./services/sicted-assessment.service";
import { SictedImprovementActionService } from "./services/sicted-improvement-action.service";
import { SictedObjectiveService } from "./services/sicted-objective.service";
import { UpdateSictedPracticeDto } from "./dto/sicted-practice-catalog.dto";
import {
  CreateAssessmentDto,
  UpsertScoreDto,
} from "./dto/sicted-assessment.dto";
import {
  CreateImprovementActionDto,
  UpdateImprovementActionDto,
} from "./dto/sicted-improvement-action.dto";
import {
  CreateObjectiveDto,
  UpdateObjectiveDto,
} from "./dto/sicted-objective.dto";

/**
 * Fachada SICTED de Dirección: catálogo de buenas prácticas (BP1-BP6) y
 * autoevaluación con la escala real 1-5 + No aplica (fase 9, sub-PR 1);
 * plan de mejora y objetivos anuales (fase 9, sub-PR 2).
 */
@Controller("api/v1/sicted/direccion")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedDireccionController {
  constructor(
    private readonly catalog: SictedPracticeCatalogService,
    private readonly assessments: SictedAssessmentService,
    private readonly improvementActions: SictedImprovementActionService,
    private readonly objectives: SictedObjectiveService,
  ) {}

  // ────────────────────────────────────────────────────────────── Catálogo

  @Get("practices")
  @Roles("USER")
  async listPractices(
    @Req() req: any,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const data = await this.catalog.list(
      req.tenantId,
      includeArchived === "true",
    );
    return { success: true, data };
  }

  @Post("practices/seed")
  @Roles("ADMIN", "OWNER")
  async seedCatalog(@Req() req: any) {
    const data = await this.catalog.seedCatalog(req.tenantId);
    return { success: true, data };
  }

  @Patch("practices/:id")
  @Roles("ADMIN", "OWNER")
  async updatePractice(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateSictedPracticeDto,
  ) {
    const data = await this.catalog.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Post("practices/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archivePractice(@Req() req: any, @Param("id") id: string) {
    const data = await this.catalog.archive(req.tenantId, id);
    return { success: true, data };
  }

  // ─────────────────────────────────────────────────────────── Autoevaluación

  @Get("assessments")
  @Roles("USER")
  async listAssessments(@Req() req: any) {
    const data = await this.assessments.list(req.tenantId);
    return { success: true, data };
  }

  @Post("assessments")
  @Roles("ADMIN", "OWNER")
  async createAssessment(@Req() req: any, @Body() dto: CreateAssessmentDto) {
    const data = await this.assessments.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Get("assessments/:id/scores")
  @Roles("USER")
  async getScores(@Req() req: any, @Param("id") id: string) {
    const data = await this.assessments.getScores(req.tenantId, id);
    return { success: true, data };
  }

  @Get("assessments/:id/pending-mandatory")
  @Roles("USER")
  async pendingMandatory(@Req() req: any, @Param("id") id: string) {
    const data = await this.assessments.pendingMandatory(req.tenantId, id);
    return { success: true, data };
  }

  @Post("assessments/:id/scores/:practiceId")
  @Roles("ADMIN", "OWNER")
  async upsertScore(
    @Req() req: any,
    @Param("id") id: string,
    @Param("practiceId") practiceId: string,
    @Body() dto: UpsertScoreDto,
  ) {
    const data = await this.assessments.upsertScore(
      req.tenantId,
      id,
      practiceId,
      dto,
    );
    return { success: true, data };
  }

  @Post("assessments/:id/close")
  @Roles("ADMIN", "OWNER")
  async closeAssessment(@Req() req: any, @Param("id") id: string) {
    const data = await this.assessments.close(req.tenantId, id);
    return { success: true, data };
  }

  @Post("assessments/:id/generate-actions")
  @Roles("ADMIN", "OWNER")
  async generateActionsFromAssessment(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const data = await this.improvementActions.generateFromAssessment(
      req.tenantId,
      id,
    );
    return { success: true, data };
  }

  // ────────────────────────────────────────────────────────── Plan de mejora

  @Get("improvement-actions")
  @Roles("USER")
  async listImprovementActions(
    @Req() req: any,
    @Query("status") status?: string,
  ) {
    const data = await this.improvementActions.list(req.tenantId, status);
    return { success: true, data };
  }

  @Post("improvement-actions")
  @Roles("ADMIN", "OWNER")
  async createImprovementAction(
    @Req() req: any,
    @Body() dto: CreateImprovementActionDto,
  ) {
    const data = await this.improvementActions.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Patch("improvement-actions/:id")
  @Roles("ADMIN", "OWNER")
  async updateImprovementAction(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateImprovementActionDto,
  ) {
    const data = await this.improvementActions.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  // ──────────────────────────────────────────────────────────────── Objetivos

  @Get("objectives")
  @Roles("USER")
  async listObjectives(@Req() req: any, @Query("year") year?: string) {
    const data = await this.objectives.list(
      req.tenantId,
      year ? Number(year) : undefined,
    );
    return { success: true, data };
  }

  @Post("objectives")
  @Roles("ADMIN", "OWNER")
  async createObjective(@Req() req: any, @Body() dto: CreateObjectiveDto) {
    const data = await this.objectives.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Patch("objectives/:id")
  @Roles("ADMIN", "OWNER")
  async updateObjective(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateObjectiveDto,
  ) {
    const data = await this.objectives.update(req.tenantId, id, dto);
    return { success: true, data };
  }
}
