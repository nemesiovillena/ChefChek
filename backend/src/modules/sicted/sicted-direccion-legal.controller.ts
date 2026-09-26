import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { SictedEventService } from "./services/sicted-event.service";
import { SictedComplianceDocService } from "./services/sicted-compliance-doc.service";
import { CreateEventDto } from "./dto/sicted-event.dto";
import {
  CreateComplianceDocDto,
  UpdateComplianceDocDto,
} from "./dto/sicted-compliance-doc.dto";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/**
 * Fachada SICTED de Dirección — eventos (grupos de mejora, formación del
 * destino, evaluación externa) y documentos legales con caducidad (fase 9,
 * sub-PR 3). Controlador propio (no el mismo `sicted-direccion.controller.ts`
 * de catálogo/autoevaluación/mejora/objetivos) para no superar las ~200
 * líneas por archivo, mismo criterio de modularización del resto del
 * proyecto.
 */
@Controller("api/v1/sicted/direccion")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedDireccionLegalController {
  constructor(
    private readonly events: SictedEventService,
    private readonly complianceDocs: SictedComplianceDocService,
    private readonly bunny: BunnyStorageService,
  ) {}

  // ─────────────────────────────────────────────────────────────── Eventos

  @Get("events")
  @Roles("USER")
  async listEvents(@Req() req: any, @Query("kind") kind?: string) {
    const data = await this.events.list(req.tenantId, kind);
    return { success: true, data };
  }

  @Post("events")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("attachment", {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async createEvent(
    @Req() req: any,
    @Body() dto: CreateEventDto,
    @UploadedFile() attachment: Express.Multer.File | undefined,
  ) {
    if (attachment) {
      assertAllowedAttachmentType(attachment);
    }
    const data = await this.events.create(req.tenantId, dto, attachment);
    return { success: true, data };
  }

  @Get("events/:id/attachment")
  @Roles("USER")
  async downloadEventAttachment(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.events.getAttachment(req.tenantId, id);
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

  // ────────────────────────────────────────────────────────────────── Legal

  @Get("compliance-docs")
  @Roles("USER")
  async listComplianceDocs(
    @Req() req: any,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const data = await this.complianceDocs.list(
      req.tenantId,
      includeArchived === "true",
    );
    return { success: true, data };
  }

  @Post("compliance-docs")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("attachment", {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async createComplianceDoc(
    @Req() req: any,
    @Body() dto: CreateComplianceDocDto,
    @UploadedFile() attachment: Express.Multer.File | undefined,
  ) {
    if (attachment) {
      assertAllowedAttachmentType(attachment);
    }
    const data = await this.complianceDocs.create(
      req.tenantId,
      dto,
      attachment,
    );
    return { success: true, data };
  }

  @Patch("compliance-docs/:id")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("attachment", {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async updateComplianceDoc(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateComplianceDocDto,
    @UploadedFile() attachment: Express.Multer.File | undefined,
  ) {
    if (attachment) {
      assertAllowedAttachmentType(attachment);
    }
    const data = await this.complianceDocs.update(
      req.tenantId,
      id,
      dto,
      attachment,
    );
    return { success: true, data };
  }

  @Post("compliance-docs/:id/archive")
  @Roles("ADMIN", "OWNER")
  async archiveComplianceDoc(@Req() req: any, @Param("id") id: string) {
    const data = await this.complianceDocs.archive(req.tenantId, id);
    return { success: true, data };
  }

  @Get("compliance-docs/:id/attachment")
  @Roles("USER")
  async downloadComplianceDocAttachment(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.complianceDocs.getAttachment(
      req.tenantId,
      id,
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
}
