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
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { BunnyStorageService } from "../../common/bunny/bunny-storage.service";
import { assertAllowedAttachmentType } from "../../common/utils/attachment-upload.util";
import { readPrivateAttachment } from "../../common/utils/store-private-attachment.util";
import { ChecklistAssetService } from "../checklists/services/checklist-asset.service";
import { ChecklistMaintenanceService } from "../checklists/services/checklist-maintenance.service";
import { ChecklistIncidentService } from "../checklists/services/checklist-incident.service";
import {
  CreateChecklistAssetDto,
  UpdateChecklistAssetDto,
} from "../checklists/dto/checklist-asset.dto";
import {
  CreateChecklistMaintenancePlanDto,
  UpdateChecklistMaintenancePlanDto,
} from "../checklists/dto/checklist-maintenance-plan.dto";
import {
  CreateChecklistIncidentDto,
  UpdateChecklistIncidentDto,
} from "../checklists/dto/checklist-incident.dto";
import { CHECKLIST_STARTER_ASSETS } from "../checklists/constants/checklist-starter-assets.constant";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RECORD = 5;

/**
 * Fachada SICTED del mantenimiento preventivo/correctivo (fase 4): equipos,
 * calendario de revisiones (con certificados adjuntos) y partes de avería /
 * acciones correctivas. Igual que `SictedChecklistController`: todo filtra
 * por `usedByModules` incluye "sicted".
 */
@Controller("api/v1/sicted/maintenance")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedMaintenanceController {
  private readonly module = "sicted" as const;

  constructor(
    private readonly assets: ChecklistAssetService,
    private readonly maintenance: ChecklistMaintenanceService,
    private readonly incidents: ChecklistIncidentService,
    private readonly bunny: BunnyStorageService,
  ) {}

  // ─────────────────────────────────────────────────────────── Equipos

  @Get("assets")
  @Roles("USER")
  async listAssets(@Req() req: any, @Query("category") category?: string) {
    const data = await this.assets.list(req.tenantId, this.module, category);
    return { success: true, data };
  }

  @Post("assets")
  @Roles("ADMIN", "OWNER")
  async createAsset(@Req() req: any, @Body() dto: CreateChecklistAssetDto) {
    const data = await this.assets.create(req.tenantId, this.module, dto);
    return { success: true, data };
  }

  @Put("assets/:id")
  @Roles("ADMIN", "OWNER")
  async updateAsset(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateChecklistAssetDto,
  ) {
    const data = await this.assets.update(req.tenantId, this.module, id, dto);
    return { success: true, data };
  }

  @Post("assets/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archiveAsset(@Req() req: any, @Param("id") id: string) {
    const data = await this.assets.archive(req.tenantId, this.module, id);
    return { success: true, data };
  }

  /** Equipo de ejemplo (control de extintores) + su plan trimestral; idempotente. */
  @Post("assets/starter")
  @Roles("ADMIN", "OWNER")
  async seedStarterAssets(@Req() req: any) {
    const created = [];
    for (const starter of CHECKLIST_STARTER_ASSETS) {
      created.push(
        await this.assets.seedStarterAsset(req.tenantId, this.module, starter),
      );
    }
    return { success: true, data: created };
  }

  // ────────────────────────────────────────────────── Planes de revisión

  @Get("plans")
  @Roles("USER")
  async listPlans(@Req() req: any, @Query("assetId") assetId?: string) {
    const data = await this.maintenance.listPlans(
      req.tenantId,
      this.module,
      assetId,
    );
    return { success: true, data };
  }

  @Post("plans")
  @Roles("ADMIN", "OWNER")
  async createPlan(
    @Req() req: any,
    @Body() dto: CreateChecklistMaintenancePlanDto,
  ) {
    const data = await this.maintenance.createPlan(
      req.tenantId,
      this.module,
      dto,
    );
    return { success: true, data };
  }

  @Put("plans/:id")
  @Roles("ADMIN", "OWNER")
  async updatePlan(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateChecklistMaintenancePlanDto,
  ) {
    const data = await this.maintenance.updatePlan(
      req.tenantId,
      this.module,
      id,
      dto,
    );
    return { success: true, data };
  }

  @Post("plans/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archivePlan(@Req() req: any, @Param("id") id: string) {
    const data = await this.maintenance.archivePlan(
      req.tenantId,
      this.module,
      id,
    );
    return { success: true, data };
  }

  // ─────────────────────────────────────────────────────────── Registros

  @Get("plans/:id/records")
  @Roles("USER")
  async listRecords(@Req() req: any, @Param("id") planId: string) {
    const data = await this.maintenance.listRecords(
      req.tenantId,
      this.module,
      planId,
    );
    return { success: true, data };
  }

  @Post("plans/:id/records")
  @Roles("USER")
  @UseInterceptors(
    FilesInterceptor("files", MAX_ATTACHMENTS_PER_RECORD, {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async createRecord(
    @Req() req: any,
    @Param("id") planId: string,
    @Body("performedByName") performedByName: string,
    @Body("performedAt") performedAt: string | undefined,
    @Body("providerName") providerName: string | undefined,
    @Body("cost") cost: string | undefined,
    @Body("notes") notes: string | undefined,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    if (!performedByName?.trim()) {
      throw new BadRequestException("Quién hizo la revisión es obligatorio");
    }
    for (const file of files) {
      assertAllowedAttachmentType(file);
    }
    const data = await this.maintenance.createRecord(
      req.tenantId,
      this.module,
      planId,
      req.user.id,
      {
        performedByName: performedByName.trim(),
        performedAt: performedAt ? new Date(performedAt) : undefined,
        providerName: providerName?.trim() || undefined,
        cost: cost !== undefined && cost !== "" ? Number(cost) : undefined,
        notes: notes?.trim() || undefined,
      },
      files,
    );
    return { success: true, data };
  }

  @Get("records/:recordId/attachments/:index")
  @Roles("USER")
  async downloadAttachment(
    @Req() req: any,
    @Param("recordId") recordId: string,
    @Param("index") indexParam: string,
    @Res() res: Response,
  ) {
    const index = Number(indexParam);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException("Índice de adjunto inválido");
    }
    const attachment = await this.maintenance.getRecordAttachment(
      req.tenantId,
      recordId,
      index,
    );
    const buffer = await readPrivateAttachment(
      this.bunny,
      attachment.storageKey,
    );
    res.set({
      "Content-Type": attachment.mime,
      "Content-Disposition": `attachment; filename="${attachment.name}"`,
    });
    res.send(buffer);
  }

  // ────────────────────────────────────────────────────────── Incidencias

  @Get("incidents")
  @Roles("USER")
  async listIncidents(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("kind") kind?: string,
    @Query("assetId") assetId?: string,
  ) {
    const data = await this.incidents.list(req.tenantId, this.module, {
      status,
      kind,
      assetId,
    });
    return { success: true, data };
  }

  @Get("incidents/:id")
  @Roles("USER")
  async getIncident(@Req() req: any, @Param("id") id: string) {
    const data = await this.incidents.getOneVisible(
      req.tenantId,
      this.module,
      id,
    );
    return { success: true, data };
  }

  @Post("incidents")
  @Roles("USER")
  async createIncident(
    @Req() req: any,
    @Body() dto: CreateChecklistIncidentDto,
  ) {
    const data = await this.incidents.create(req.tenantId, this.module, dto);
    return { success: true, data };
  }

  @Patch("incidents/:id")
  @Roles("USER")
  async updateIncident(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateChecklistIncidentDto,
  ) {
    const data = await this.incidents.update(
      req.tenantId,
      this.module,
      id,
      dto,
    );
    return { success: true, data };
  }
}
