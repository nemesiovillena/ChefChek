import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { Roles } from "../../decorators/roles.decorator";
import { BackupService } from "./backup.service";
import { CreateBackupDto, RestoreExistingDto } from "./dto/backup.dto";

const RESTORE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Copias de seguridad por tenant (ADMIN/OWNER). SUPERADMIN usa el controller
 * global en superadmin-backup.controller.ts.
 */
@Controller("api/v1/backups")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles("ADMIN", "OWNER")
  async list(@Req() req: any) {
    const data = await this.backupService.list("TENANT", req.tenantId);
    return { success: true, data };
  }

  @Post()
  @Roles("ADMIN", "OWNER")
  async create(@Req() req: any, @Body() dto: CreateBackupDto) {
    const data = await this.backupService.createExport(
      "TENANT",
      req.tenantId,
      req.tenantSlug,
      req.user?.id ?? null,
      dto.notes,
    );
    return { success: true, data };
  }

  @Get(":id/status")
  @Roles("ADMIN", "OWNER")
  async status(@Param("id") id: string, @Req() req: any) {
    const data = await this.backupService.getJobStatus(
      id,
      "TENANT",
      req.tenantId,
    );
    return { success: true, data };
  }

  @Get(":id/download")
  @Roles("ADMIN", "OWNER")
  async download(
    @Param("id") id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const row = await this.backupService.getOne(id, "TENANT", req.tenantId);
    if (!row.filename) {
      res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, error: "Sin archivo" });
      return;
    }
    res.download(this.backupService.filepathOf(row), row.filename);
  }

  @Delete(":id")
  @Roles("ADMIN", "OWNER")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @Req() req: any) {
    await this.backupService.deleteBackup(
      id,
      "TENANT",
      req.tenantId,
      req.user?.id,
    );
  }

  /** Restaura desde una copia existente (auto-backup previo obligatorio). */
  @Post(":id/restore")
  @Roles("ADMIN", "OWNER")
  async restoreExisting(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: RestoreExistingDto,
  ) {
    const data = await this.backupService.restoreFromExisting(
      id,
      "TENANT",
      req.tenantId,
      req.tenantSlug,
      req.user?.id ?? null,
      dto.notes,
    );
    return { success: true, data };
  }

  /** Restaura desde un archivo .json subido (auto-backup previo obligatorio). */
  @Post("restore")
  @Roles("ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: RESTORE_MAX_BYTES } }),
  )
  async restoreUpload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file?.buffer) {
      return { success: false, error: "No se recibió ningún archivo." };
    }
    const payload = this.backupService.parseJson(file.buffer.toString("utf8"));
    const data = await this.backupService.restoreFromPayload(
      payload,
      "TENANT",
      req.tenantId,
      req.tenantSlug,
      req.user?.id ?? null,
      undefined,
      `Restaurado desde archivo: ${file.originalname}`,
    );
    return { success: true, data };
  }
}
