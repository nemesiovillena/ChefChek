import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { CHECK_IN_MANAGER_ROLE } from "../check-in/constants/check-in-permissions";
import { CheckInManagerGuard } from "../check-in/guards/check-in-manager.guard";
import {
  UploadEmployeeDocumentDto,
  UploadOwnDocumentDto,
} from "./dto/employee-document.dto";
import { EmployeeDocumentsService } from "./services/employee-documents.service";
import { EmployeeSelfService } from "./services/employee-self.service";

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const upload = () =>
  FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_SIZE } });

const actorOf = (req: any) => ({ id: req.user.id, name: req.user.name });

function sendFile(
  res: Response,
  file: { name: string; mime: string; buffer: Buffer },
) {
  res.set({
    "Content-Type": file.mime,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store",
  });
  res.send(file.buffer);
}

/**
 * Documentación laboral. Gerencia sube y consulta los documentos de todos;
 * cada persona ve, descarga y da acuse solo de los suyos.
 */
@Controller("api/v1/rrhh")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("rrhh")
@RequireSection("rrhh")
@Roles("VIEWER")
export class DocumentsController {
  constructor(
    private readonly documents: EmployeeDocumentsService,
    private readonly self: EmployeeSelfService,
  ) {}

  // ───────────────────────────────────────────────────────────────── Lo mío

  @Get("me/documents")
  async listOwn(@Req() req: any) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.documents.list(req.tenantId, employee.id);
  }

  @Post("me/documents")
  @UseInterceptors(upload())
  async uploadOwn(
    @Req() req: any,
    @Body() dto: UploadOwnDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    if (!file) {
      throw new BadRequestException("Falta el archivo.");
    }
    return this.documents.uploadOwn(
      req.tenantId,
      employee,
      dto.title,
      file,
      actorOf(req),
    );
  }

  @Get("me/documents/:id/file")
  async downloadOwn(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    sendFile(res, await this.documents.getFile(req.tenantId, id, employee.id));
  }

  @Post("me/documents/:id/ack")
  async acknowledge(
    @Req() req: any,
    @Param("id") id: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.documents.acknowledge(req.tenantId, employee, id, {
      ipAddress: req.ip,
      userAgent,
    });
  }

  // ─────────────────────────────────────────────────────────────── Gerencia

  @Get("documents")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async list(@Req() req: any, @Query("employeeId") employeeId?: string) {
    return this.documents.list(req.tenantId, employeeId || undefined);
  }

  @Post("documents")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  @UseInterceptors(upload())
  async uploadForEmployees(
    @Req() req: any,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("Falta el archivo.");
    }
    return this.documents.upload(req.tenantId, dto, file, actorOf(req));
  }

  @Get("documents/:id/file")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async download(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.documents.getFile(req.tenantId, id));
  }

  @Delete("documents/:id")
  @HttpCode(204)
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async remove(@Req() req: any, @Param("id") id: string) {
    await this.documents.remove(req.tenantId, id);
  }
}
