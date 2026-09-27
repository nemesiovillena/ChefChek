import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { assertAllowedAttachmentType } from "../../common/utils/attachment-upload.util";
import { SictedJobProfileService } from "./services/sicted-job-profile.service";
import { SictedTrainingService } from "./services/sicted-training.service";
import { SictedProtocolService } from "./services/sicted-protocol.service";
import {
  AssignJobProfileDto,
  CreateJobProfileDto,
  UpdateJobProfileDto,
} from "./dto/sicted-job-profile.dto";
import {
  AttendanceBatchEntry,
  CreateTrainingActionDto,
  CreateTrainingPlanDto,
  UpdateTrainingPlanStatusDto,
} from "./dto/sicted-training.dto";
import {
  CreateProtocolDto,
  PublishProtocolVersionDto,
  UpdateProtocolMetaDto,
} from "./dto/sicted-protocol.dto";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/**
 * Fachada SICTED de Personas (fase 7): fichas de puesto, plan de formación
 * con asistencia, protocolos con acuse versionado.
 */
@Controller("api/v1/sicted/personas")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedPersonasController {
  constructor(
    private readonly jobProfiles: SictedJobProfileService,
    private readonly training: SictedTrainingService,
    private readonly protocols: SictedProtocolService,
  ) {}

  // ───────────────────────────────────────────────────── Fichas de puesto

  @Get("job-profiles")
  @Roles("USER")
  async listJobProfiles(
    @Req() req: any,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const data = await this.jobProfiles.list(
      req.tenantId,
      includeArchived === "true",
    );
    return { success: true, data };
  }

  @Get("job-profiles/unassigned-users")
  @Roles("ADMIN", "OWNER")
  async listUnassignedUsers(@Req() req: any) {
    const data = await this.jobProfiles.listUnassignedActiveUsers(req.tenantId);
    return { success: true, data };
  }

  @Get("job-profiles/:id")
  @Roles("USER")
  async getJobProfile(@Req() req: any, @Param("id") id: string) {
    const data = await this.jobProfiles.getOneVisible(req.tenantId, id);
    return { success: true, data };
  }

  @Post("job-profiles")
  @Roles("ADMIN", "OWNER")
  async createJobProfile(@Req() req: any, @Body() dto: CreateJobProfileDto) {
    const data = await this.jobProfiles.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Put("job-profiles/:id")
  @Roles("ADMIN", "OWNER")
  async updateJobProfile(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateJobProfileDto,
  ) {
    const data = await this.jobProfiles.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Post("job-profiles/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archiveJobProfile(@Req() req: any, @Param("id") id: string) {
    const data = await this.jobProfiles.archive(req.tenantId, id);
    return { success: true, data };
  }

  @Post("job-profiles/:id/assign")
  @Roles("ADMIN", "OWNER")
  async assignJobProfile(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: AssignJobProfileDto,
  ) {
    const data = await this.jobProfiles.assign(req.tenantId, id, dto);
    return { success: true, data };
  }

  // ───────────────────────────────────────────────────────────── Formación

  @Get("training/plans")
  @Roles("USER")
  async listTrainingPlans(@Req() req: any) {
    const data = await this.training.listPlans(req.tenantId);
    return { success: true, data };
  }

  @Post("training/plans")
  @Roles("ADMIN", "OWNER")
  async createTrainingPlan(
    @Req() req: any,
    @Body() dto: CreateTrainingPlanDto,
  ) {
    const data = await this.training.getOrCreatePlan(req.tenantId, dto);
    return { success: true, data };
  }

  @Patch("training/plans/:id/status")
  @Roles("ADMIN", "OWNER")
  async updateTrainingPlanStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateTrainingPlanStatusDto,
  ) {
    const data = await this.training.updatePlanStatus(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Get("training/coverage")
  @Roles("USER")
  async trainingCoverage(@Req() req: any, @Query("year") yearParam?: string) {
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isInteger(year)) {
      throw new BadRequestException("year inválido");
    }
    const data = await this.training.coverage(req.tenantId, year);
    return { success: true, data };
  }

  @Get("training/plans/:id/actions")
  @Roles("USER")
  async listTrainingActions(@Req() req: any, @Param("id") planId: string) {
    const data = await this.training.listActions(req.tenantId, planId);
    return { success: true, data };
  }

  @Post("training/plans/:id/actions")
  @Roles("ADMIN", "OWNER")
  async createTrainingAction(
    @Req() req: any,
    @Param("id") planId: string,
    @Body() dto: CreateTrainingActionDto,
  ) {
    const data = await this.training.createAction(req.tenantId, planId, dto);
    return { success: true, data };
  }

  @Post("training/actions/:id/done")
  @Roles("ADMIN", "OWNER")
  async markTrainingActionDone(@Req() req: any, @Param("id") id: string) {
    const data = await this.training.markActionDone(req.tenantId, id);
    return { success: true, data };
  }

  @Get("training/actions/:id/attendance")
  @Roles("USER")
  async listAttendance(@Req() req: any, @Param("id") actionId: string) {
    const data = await this.training.listAttendance(req.tenantId, actionId);
    return { success: true, data };
  }

  @Post("training/actions/:id/attendance")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("certificate", {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async recordAttendance(
    @Req() req: any,
    @Param("id") actionId: string,
    @Body("attendees") attendeesRaw: string,
    @UploadedFile() certificate: Express.Multer.File | undefined,
  ) {
    let entries: AttendanceBatchEntry[];
    try {
      entries = JSON.parse(attendeesRaw);
    } catch {
      throw new BadRequestException("attendees debe ser JSON válido");
    }
    if (certificate) {
      assertAllowedAttachmentType(certificate);
    }
    const data = await this.training.recordAttendanceBatch(
      req.tenantId,
      actionId,
      entries,
      certificate,
    );
    return { success: true, data };
  }

  // ──────────────────────────────────────────────────────────── Protocolos

  @Get("protocols")
  @Roles("USER")
  async listProtocols(
    @Req() req: any,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const data = await this.protocols.list(
      req.tenantId,
      includeArchived === "true",
    );
    return { success: true, data };
  }

  @Get("protocols/pending-for-me")
  @Roles("USER")
  async listPendingProtocolsForMe(@Req() req: any) {
    const data = await this.protocols.listPendingForUser(
      req.tenantId,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get("protocols/matrix")
  @Roles("ADMIN", "OWNER")
  async protocolAckMatrix(@Req() req: any) {
    const data = await this.protocols.ackMatrix(req.tenantId);
    return { success: true, data };
  }

  @Get("protocols/:id")
  @Roles("USER")
  async getProtocol(@Req() req: any, @Param("id") id: string) {
    const data = await this.protocols.getOneWithContent(req.tenantId, id);
    return { success: true, data };
  }

  @Post("protocols")
  @Roles("ADMIN", "OWNER")
  async createProtocol(@Req() req: any, @Body() dto: CreateProtocolDto) {
    const data = await this.protocols.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Patch("protocols/:id")
  @Roles("ADMIN", "OWNER")
  async updateProtocolMeta(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateProtocolMetaDto,
  ) {
    const data = await this.protocols.updateMeta(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Post("protocols/:id/publish-version")
  @Roles("ADMIN", "OWNER")
  async publishProtocolVersion(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: PublishProtocolVersionDto,
  ) {
    const data = await this.protocols.publishVersion(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Post("protocols/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archiveProtocol(@Req() req: any, @Param("id") id: string) {
    const data = await this.protocols.archive(req.tenantId, id);
    return { success: true, data };
  }

  @Post("protocols/:id/ack")
  @Roles("USER")
  async ackProtocol(@Req() req: any, @Param("id") id: string) {
    const data = await this.protocols.ack(
      req.tenantId,
      id,
      req.user.id,
      req.user.name,
    );
    return { success: true, data };
  }
}
