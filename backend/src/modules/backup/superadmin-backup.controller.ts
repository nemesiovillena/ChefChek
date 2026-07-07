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
import { SuperadminGuard } from "../../guards/superadmin.guard";
import { BackupService } from "./backup.service";
import { CreateBackupDto } from "./dto/backup.dto";

const RESTORE_MAX_BYTES = 500 * 1024 * 1024; // 500 MB (global: varios tenants)

/**
 * Copias de seguridad GLOBALES (toda la BD, todos los tenants). Sólo SUPERADMIN.
 * tenantId es null: respalda/restaura el ecosistema completo.
 */
@Controller("api/v1/superadmin/backups")
@UseGuards(AuthGuard, SuperadminGuard)
export class SuperadminBackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  async list() {
    const data = await this.backupService.list("GLOBAL", null);
    return { success: true, data };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBackupDto) {
    const data = await this.backupService.createExport(
      "GLOBAL",
      null,
      null,
      req.user?.id ?? null,
      dto.notes,
    );
    return { success: true, data };
  }

  @Get(":id/status")
  async status(@Param("id") id: string) {
    const data = await this.backupService.getJobStatus(id, "GLOBAL", null);
    return { success: true, data };
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res() res: Response) {
    const row = await this.backupService.getOne(id, "GLOBAL", null);
    if (!row.filename) {
      res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, error: "Sin archivo" });
      return;
    }
    res.download(this.backupService.filepathOf(row), row.filename);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @Req() req: any) {
    await this.backupService.deleteBackup(id, "GLOBAL", null, req.user?.id);
  }

  @Post(":id/restore")
  async restoreExisting(@Param("id") id: string, @Req() req: any) {
    const data = await this.backupService.restoreFromExisting(
      id,
      "GLOBAL",
      null,
      null,
      req.user?.id ?? null,
    );
    return { success: true, data };
  }

  @Post("restore")
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
      "GLOBAL",
      null,
      null,
      req.user?.id ?? null,
      undefined,
      `Restauración global desde archivo: ${file.originalname}`,
    );
    return { success: true, data };
  }
}
