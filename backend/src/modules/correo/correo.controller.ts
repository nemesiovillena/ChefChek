import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  AuditAction,
  AuditService,
  EntityType,
} from "../../common/services/audit.service";
import { Roles } from "../../decorators/roles.decorator";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import {
  RequireSection,
  SectionAccessGuard,
} from "../../guards/section-access.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { CorreoAccessGuard } from "./correo-access.guard";
import { CorreoAccessLogService } from "./correo-access-log.service";
import { CorreoConfigService } from "./correo-config.service";
import { CorreoMailboxService } from "./correo-mailbox.service";
import {
  CorreoSendService,
  MAX_UPLOAD_BYTES,
  UploadedMailFile,
} from "./correo-send.service";
import { ImapConfigDto } from "./dto/imap-config.dto";
import { SendMailDto } from "./dto/send-mail.dto";
import { ImapClientService } from "./imap-client.service";
import { MAIL_PART_PATTERN } from "./mail-body-structure";

const AUDIT_TEXT_MAX = 80;

function parseUid(raw: string | undefined, field = "uid"): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(`Parámetro ${field} no válido.`);
  }
  return n;
}

function requireFolder(folder: string | undefined): string {
  if (!folder || folder.length > 500) {
    throw new BadRequestException("Falta la carpeta.");
  }
  return folder;
}

function requireUidValidity(value: string | undefined): string {
  if (!value || !/^\d+$/.test(value)) {
    throw new BadRequestException("Falta uidValidity: recarga la lista.");
  }
  return value;
}

/** `filename="ascii"; filename*=UTF-8''…` para que ñ y tildes lleguen bien. */
export function attachmentDisposition(filename: string): string {
  const ascii =
    filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "adjunto";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Buzón del restaurante: leer (sección «correo») y enviar («correo.enviar»). Lo usan gerencia (ADMIN/OWNER) y las
 * personas con el permiso por persona «correo»; SUPERADMIN nunca.
 */
@ApiTags("Correo")
@ApiBearerAuth()
@Controller("api/v1/correo")
@UseGuards(
  AuthGuard,
  TenantGuard,
  CorreoAccessGuard,
  RolesGuard,
  SectionAccessGuard,
)
@RequireSection("correo")
@Roles("VIEWER")
export class CorreoController {
  constructor(
    private readonly config: CorreoConfigService,
    private readonly mailbox: CorreoMailboxService,
    private readonly imap: ImapClientService,
    private readonly accessLog: CorreoAccessLogService,
    private readonly sender: CorreoSendService,
    private readonly audit: AuditService,
  ) {}

  // ── Configuración (gerencia) ──────────────────────────────────────────

  @Get("config")
  @Roles("ADMIN")
  @ApiOperation({
    summary: "Configuración IMAP (nunca devuelve la contraseña)",
  })
  async getConfig(@Req() req: any) {
    return { success: true, data: await this.config.getPublic(req.tenantId) };
  }

  @Put("config")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Guardar configuración IMAP (contraseña cifrada)" })
  async saveConfig(@Req() req: any, @Body() dto: ImapConfigDto) {
    const data = await this.config.save(req.tenantId, dto, req.user.id);
    this.imap.resetBreaker(req.tenantId);
    this.mailbox.clearCache(req.tenantId);
    return { success: true, data };
  }

  @Post("config/test")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Probar conexión con la configuración guardada" })
  async testConfig(@Req() req: any) {
    return {
      success: true,
      data: await this.mailbox.testConnection(req.tenantId),
    };
  }

  @Get("access-log")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Registro de accesos al buzón (solo gerencia)" })
  async getAccessLog(@Req() req: any, @Query("cursor") cursor?: string) {
    return {
      success: true,
      data: await this.accessLog.list(req.tenantId, cursor || undefined),
    };
  }

  // ── Lectura ───────────────────────────────────────────────────────────

  @Get("folders")
  @ApiOperation({ summary: "Carpetas del buzón" })
  async getFolders(@Req() req: any, @Query("fresh") fresh?: string) {
    const data = await this.mailbox.listFolders(req.tenantId, fresh === "1");
    return { success: true, data };
  }

  @Get("messages")
  @ApiOperation({ summary: "Lista de correos (50, por cursor beforeUid)" })
  async getMessages(
    @Req() req: any,
    @Query("folder") folder?: string,
    @Query("beforeUid") beforeUid?: string,
    @Query("uidValidity") uidValidity?: string,
    @Query("fresh") fresh?: string,
  ) {
    const data = await this.mailbox.listMessages(
      req.tenantId,
      requireFolder(folder),
      {
        beforeUid: beforeUid ? parseUid(beforeUid, "beforeUid") : undefined,
        uidValidity: uidValidity || undefined,
        fresh: fresh === "1",
      },
    );
    return { success: true, data };
  }

  @Get("messages/:uid")
  @ApiOperation({
    summary: "Detalle de un correo (HTML saneado). No lo marca leído.",
  })
  async getMessage(
    @Req() req: any,
    @Param("uid") uidRaw: string,
    @Query("folder") folder?: string,
    @Query("uidValidity") uidValidity?: string,
  ) {
    const f = requireFolder(folder);
    const uidv = requireUidValidity(uidValidity);
    const uid = parseUid(uidRaw);
    const data = await this.mailbox.getMessage(req.tenantId, f, uid, uidv);
    // Para «Responder a todos»: no incluir el propio buzón entre los destinatarios
    const { user: mailboxAddress } = await this.config.getPublic(req.tenantId);
    await this.logAccess(req, `${f}:${uidv}:${uid}`, {
      messageId: data.messageId,
      subject: data.subject,
      from: data.from[0]?.address || data.from[0]?.name,
    });
    return { success: true, data: { ...data, mailboxAddress } };
  }

  @Get("messages/:uid/parts/:part")
  @ApiOperation({
    summary: "Descargar un adjunto (siempre como archivo, nunca se abre)",
  })
  async getPart(
    @Req() req: any,
    @Res() res: Response,
    @Param("uid") uidRaw: string,
    @Param("part") part: string,
    @Query("folder") folder?: string,
    @Query("uidValidity") uidValidity?: string,
  ) {
    const f = requireFolder(folder);
    const uidv = requireUidValidity(uidValidity);
    const uid = parseUid(uidRaw);
    if (!MAIL_PART_PATTERN.test(part)) {
      throw new BadRequestException("Parte del mensaje no válida.");
    }
    const file = await this.mailbox.downloadPart(
      req.tenantId,
      f,
      uid,
      part,
      uidv,
    );
    await this.logAccess(req, `${f}:${uidv}:${uid}`, {
      messageId: file.messageId,
      subject: file.subject,
      from: file.from,
      part,
    });
    res.set({
      // Nunca el tipo real: un HTML/SVG adjunto no debe poder ejecutarse en el navegador
      "Content-Type": "application/octet-stream",
      "Content-Disposition": attachmentDisposition(file.filename),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    });
    res.send(file.buffer);
  }

  // ── Envío ─────────────────────────────────────────────────────────────

  @Post("send")
  @RequireSection("correo.enviar")
  @UseInterceptors(
    FilesInterceptor("files", 10, { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiOperation({
    summary: "Enviar, responder o reenviar desde el buzón (copia en Enviados)",
  })
  async send(
    @Req() req: any,
    @Body() dto: SendMailDto,
    @UploadedFiles() files: UploadedMailFile[] = [],
  ) {
    const result = await this.sender.send(req.tenantId, dto, files ?? []);
    await this.audit.log(req.user.id, req.tenantId, {
      action: AuditAction.CREATE,
      entityType: EntityType.MAIL_MESSAGE,
      entityId: `sent:${result.messageId}`,
      details: {
        mode: dto.mode,
        messageId: result.messageId,
        subject: dto.subject?.slice(0, AUDIT_TEXT_MAX),
        to: result.recipients.join(", ").slice(0, AUDIT_TEXT_MAX),
        attachments: files?.length ?? 0,
      },
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });
    this.mailbox.clearCache(req.tenantId);
    return { success: true, data: { savedToSent: result.savedToSent } };
  }

  private async logAccess(
    req: any,
    entityId: string,
    info: {
      messageId?: string;
      subject?: string;
      from?: string;
      part?: string;
    },
  ) {
    await this.audit.log(req.user.id, req.tenantId, {
      action: AuditAction.VIEW,
      entityType: EntityType.MAIL_MESSAGE,
      entityId,
      details: {
        messageId: info.messageId,
        part: info.part,
        subject: info.subject?.slice(0, AUDIT_TEXT_MAX),
        from: info.from?.slice(0, AUDIT_TEXT_MAX),
      },
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });
  }
}
