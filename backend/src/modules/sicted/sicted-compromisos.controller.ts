import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
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
import { SictedCommitmentsService } from "./services/sicted-commitments.service";
import { SictedSettingsService } from "./services/sicted-settings.service";
import { SictedImprovementEvidenceService } from "./services/sicted-improvement-evidence.service";
import { UpdateSictedCycleDto } from "./dto/sicted-practice-catalog.dto";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/**
 * Fachada SICTED de compromisos por fase del ciclo de distinción: fase y
 * comité (Configuración → SICTED), panel de compromisos calculado y
 * evidencias adjuntas del plan de mejora.
 */
@Controller("api/v1/sicted/direccion")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedCompromisosController {
  constructor(
    private readonly commitments: SictedCommitmentsService,
    private readonly settings: SictedSettingsService,
    private readonly evidence: SictedImprovementEvidenceService,
    private readonly bunny: BunnyStorageService,
  ) {}

  @Get("commitments")
  @Roles("USER")
  async getCommitments(@Req() req: any) {
    const data = await this.commitments.get(req.tenantId);
    return { success: true, data };
  }

  @Patch("cycle")
  @Roles("ADMIN", "OWNER")
  async updateCycle(@Req() req: any, @Body() dto: UpdateSictedCycleDto) {
    const data = await this.settings.updateCycle(req.tenantId, dto);
    return { success: true, data };
  }

  @Post("improvement-actions/:id/evidence")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("attachment", {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async uploadEvidence(
    @Req() req: any,
    @Param("id") id: string,
    @UploadedFile() attachment: Express.Multer.File | undefined,
  ) {
    if (!attachment) {
      throw new BadRequestException("Falta el archivo de evidencia");
    }
    assertAllowedAttachmentType(attachment);
    const data = await this.evidence.attach(req.tenantId, id, attachment);
    return { success: true, data };
  }

  @Get("improvement-actions/:id/evidence")
  @Roles("USER")
  async downloadEvidence(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.evidence.getAttachment(req.tenantId, id);
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
}
