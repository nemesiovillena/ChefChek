import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isEmail } from "class-validator";
import * as nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { PrismaService } from "../../common/services/prisma.service";
import { CorreoConfigService, ImapSecretConfig } from "./correo-config.service";
import {
  CorreoMailboxService,
  OriginalAttachment,
} from "./correo-mailbox.service";
import { SendMailDto } from "./dto/send-mail.dto";
import { ImapClientService } from "./imap-client.service";
import { MAILBOX_BAD_CREDENTIALS } from "./imap-error-mapper";
import { resolvePublicImapHost } from "./imap-host-validator";
import {
  buildBody,
  OriginalForReply,
  threadHeaders,
} from "./mail-reply-builder";

/**
 * Envío desde el buzón del restaurante por el SMTP de Hostinger (mismas
 * credenciales que el IMAP). El mismo MIME que sale se guarda en «Enviados».
 * Orden deliberado: 1) leer el original, 2) enviar, 3) copiar. Si la copia
 * falla, el envío ya está hecho: se avisa, nunca se reintenta (duplicados).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_RECIPIENTS = 50;

export interface UploadedMailFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SendResult {
  messageId: string;
  savedToSent: boolean;
  recipients: string[];
}

export function parseRecipients(
  raw: string | undefined,
  field: string,
): string[] {
  const list = (raw ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    // "Nombre <correo@x.es>" → correo@x.es
    .map((s) => /<([^>]+)>\s*$/.exec(s)?.[1]?.trim() ?? s)
    .filter(Boolean);
  const invalid = list.filter((a) => !isEmail(a));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Dirección no válida en ${field}: ${invalid.slice(0, 3).join(", ")}`,
    );
  }
  return list;
}

@Injectable()
export class CorreoSendService {
  private readonly logger = new Logger(CorreoSendService.name);

  constructor(
    private readonly config: CorreoConfigService,
    private readonly mailbox: CorreoMailboxService,
    private readonly imap: ImapClientService,
    private readonly prisma: PrismaService,
  ) {}

  async send(
    tenantId: string,
    dto: SendMailDto,
    files: UploadedMailFile[],
  ): Promise<SendResult> {
    const to = parseRecipients(dto.to, "Para");
    const cc = parseRecipients(dto.cc, "CC");
    const bcc = parseRecipients(dto.bcc, "CCO");
    const recipients = [...to, ...cc, ...bcc];
    if (to.length === 0) {
      throw new BadRequestException(
        "Indica al menos un destinatario en «Para».",
      );
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new BadRequestException(
        `Como mucho ${MAX_RECIPIENTS} destinatarios por correo.`,
      );
    }
    const uploaded = files.reduce((sum, f) => sum + f.size, 0);
    if (uploaded > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        "Los adjuntos no pueden superar 10 MB en total.",
      );
    }

    this.imap.assertBreakerClosed(tenantId);
    const cfg = await this.config.getSecret(tenantId);

    let original: OriginalForReply | null = null;
    let forwarded: OriginalAttachment[] = [];
    if (dto.mode !== "new") {
      const res = await this.mailbox.getOriginalForReply(
        tenantId,
        {
          folder: dto.refFolder!,
          uid: dto.refUid!,
          uidValidity: dto.refUidValidity!,
        },
        dto.mode === "forward",
      );
      original = res.original;
      forwarded = res.attachments;
    }
    const totalAttachments =
      uploaded + forwarded.reduce((s, a) => s + a.content.length, 0);
    if (totalAttachments > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new PayloadTooLargeException(
        "El correo con sus adjuntos supera 20 MB.",
      );
    }

    const body = buildBody(dto.text, original, dto.mode);
    const compiled = new MailComposer({
      from: { name: await this.senderName(tenantId), address: cfg.user },
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: dto.subject.trim() || "(sin asunto)",
      text: body.text,
      html: body.html,
      ...threadHeaders(original, dto.mode),
      attachments: [
        ...forwarded.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        ...files.map((f) => ({
          // multer entrega el nombre en latin1; los navegadores lo envían en UTF-8
          filename: Buffer.from(f.originalname, "latin1").toString("utf8"),
          content: f.buffer,
          contentType: f.mimetype,
        })),
      ],
    }).compile();
    const messageId = compiled.messageId();
    const raw = await compiled.build();

    await this.deliver(tenantId, cfg, raw, recipients);

    let savedToSent = false;
    try {
      savedToSent = await this.mailbox.appendToSent(tenantId, raw);
    } catch (e) {
      this.logger.warn(
        `Correo ${tenantId}: enviado pero sin copia en Enviados (${(e as Error)?.message})`,
      );
    }
    return { messageId, savedToSent, recipients };
  }

  /** Envío SMTP con TLS siempre (465 SSL directo; 587 con STARTTLS obligatorio). */
  private async deliver(
    tenantId: string,
    cfg: ImapSecretConfig,
    raw: Buffer,
    recipients: string[],
  ) {
    const address = await resolvePublicImapHost(cfg.smtpHost);
    const transport = nodemailer.createTransport({
      host: address,
      port: cfg.smtpPort,
      secure: cfg.smtpPort === 465,
      requireTLS: true,
      tls: { servername: cfg.smtpHost, minVersion: "TLSv1.2" },
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    try {
      await transport.sendMail({
        envelope: { from: cfg.user, to: recipients },
        raw,
      });
    } catch (err: any) {
      throw this.mapSmtpError(tenantId, err);
    } finally {
      transport.close();
    }
  }

  private mapSmtpError(tenantId: string, err: any): HttpException {
    if (err instanceof HttpException) {
      return err;
    }
    this.logger.warn(
      `SMTP ${tenantId}: ${[err?.code, err?.responseCode, err?.response ?? err?.message].filter(Boolean).join(" | ")}`,
    );
    if (err?.code === "EAUTH") {
      this.imap.reportExternalFailure(tenantId);
      return new BadRequestException(MAILBOX_BAD_CREDENTIALS);
    }
    if (err?.code === "EENVELOPE") {
      return new BadRequestException(
        "El servidor rechazó algún destinatario: revisa las direcciones.",
      );
    }
    if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(err?.code)) {
      this.imap.reportExternalFailure(tenantId);
    }
    // Incluye cuotas de envío del proveedor (respuestas 4xx/5xx del servidor)
    return new ServiceUnavailableException(
      "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos; si sigue fallando, avisa a gerencia.",
    );
  }

  private async senderName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return tenant?.name ?? "";
  }
}
