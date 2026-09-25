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
import { UpdateSictedPracticeDto } from "./dto/sicted-practice-catalog.dto";
import {
  CreateAssessmentDto,
  UpsertScoreDto,
} from "./dto/sicted-assessment.dto";

/**
 * Fachada SICTED de Dirección (fase 9, sub-PR 1): catálogo de buenas
 * prácticas (BP1-BP6) y autoevaluación con la escala real 1-5 + No aplica.
 */
@Controller("api/v1/sicted/direccion")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedDireccionController {
  constructor(
    private readonly catalog: SictedPracticeCatalogService,
    private readonly assessments: SictedAssessmentService,
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
}
