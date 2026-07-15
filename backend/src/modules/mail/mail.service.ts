import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../common/services/prisma.service";
import { SmtpConfigDto } from "./dto/smtp-config.dto";

/**
 * Envío real de email vía SMTP configurable por tenant.
 * La configuración vive en la tabla Configuration (category SMTP) y el
 * password se guarda cifrado con AES-256-GCM usando la clave de entorno
 * CONFIG_ENCRYPTION_KEY (sin ella no se puede guardar ni enviar).
 * Sustituye, para Compras, al stub core/email.service.ts que solo loguea.
 */
const SMTP_CATEGORY = "SMTP";
const KEYS = {
  host: "smtp.host",
  port: "smtp.port",
  secure: "smtp.secure",
  user: "smtp.user",
  pass: "smtp.pass",
  from: "smtp.from",
} as const;

export interface SmtpPublicConfig {
  configured: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from?: string;
  hasPassword?: boolean;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(tenantId: string): Promise<SmtpPublicConfig> {
    const values = await this.readValues(tenantId);
    if (!values[KEYS.host]) {
      return { configured: false };
    }
    return {
      configured: true,
      host: values[KEYS.host],
      port: Number(values[KEYS.port] ?? 587),
      secure: values[KEYS.secure] === "true",
      user: values[KEYS.user] || undefined,
      from: values[KEYS.from] || undefined,
      hasPassword: Boolean(values[KEYS.pass]),
    };
  }

  async saveConfig(tenantId: string, dto: SmtpConfigDto, userId: string) {
    const entries: [string, string][] = [
      [KEYS.host, dto.host],
      [KEYS.port, String(dto.port)],
      [KEYS.secure, String(dto.secure ?? false)],
      [KEYS.user, dto.user ?? ""],
      [KEYS.from, dto.from ?? ""],
    ];
    // pass omitido → conservar el existente (permite editar host sin re-teclear)
    if (dto.pass !== undefined && dto.pass !== "") {
      entries.push([KEYS.pass, this.encrypt(dto.pass)]);
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.configuration.upsert({
          where: { tenantId_key: { tenantId, key } },
          create: {
            tenantId,
            key,
            value,
            category: SMTP_CATEGORY,
            updatedBy: userId,
          },
          update: { value, updatedBy: userId },
        }),
      ),
    );
    return this.getPublicConfig(tenantId);
  }

  async sendMail(
    tenantId: string,
    options: {
      to: string;
      subject: string;
      text: string;
      attachments?: MailAttachment[];
    },
  ) {
    const values = await this.readValues(tenantId);
    if (!values[KEYS.host]) {
      throw new BadRequestException(
        "SMTP no configurado: define el servidor de correo en Configuración.",
      );
    }

    const transporter = nodemailer.createTransport({
      host: values[KEYS.host],
      port: Number(values[KEYS.port] ?? 587),
      secure: values[KEYS.secure] === "true",
      ...(values[KEYS.user]
        ? {
            auth: {
              user: values[KEYS.user],
              pass: values[KEYS.pass] ? this.decrypt(values[KEYS.pass]) : "",
            },
          }
        : {}),
      // Timeouts cortos: un SMTP caído no debe colgar la petición HTTP
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    try {
      const info = await transporter.sendMail({
        from: values[KEYS.from] || values[KEYS.user],
        to: options.to,
        subject: options.subject,
        text: options.text,
        attachments: options.attachments,
      });
      this.logger.log(
        `Email enviado a ${options.to} (tenant ${tenantId}): ${info.messageId}`,
      );
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo SMTP (tenant ${tenantId}): ${message}`);
      throw new BadRequestException(`No se pudo enviar el email: ${message}`);
    }
  }

  async sendTest(tenantId: string, to?: string) {
    const config = await this.getPublicConfig(tenantId);
    const recipient = to || config.user;
    if (!recipient) {
      throw new BadRequestException(
        "Indica un destinatario para el email de prueba.",
      );
    }
    await this.sendMail(tenantId, {
      to: recipient,
      subject: "ChefChek: prueba de configuración SMTP",
      text: "Si lees esto, el envío de pedidos por email está listo.",
    });
    return { sentTo: recipient };
  }

  private async readValues(tenantId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { in: Object.values(KEYS) } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // ── Cifrado AES-256-GCM del password (formato iv:tag:cipher en hex) ──

  private deriveKey(): Buffer {
    const secret = process.env.CONFIG_ENCRYPTION_KEY;
    if (!secret) {
      throw new BadRequestException(
        "Falta CONFIG_ENCRYPTION_KEY en el entorno del backend: necesaria para guardar credenciales SMTP cifradas.",
      );
    }
    return crypto.scryptSync(secret, "chefchek-smtp", 32);
  }

  private encrypt(plain: string): string {
    const key = this.deriveKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
  }

  private decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    if (!ivHex || !tagHex || !dataHex) {
      throw new BadRequestException(
        "Credencial SMTP corrupta: vuelve a guardar el password.",
      );
    }
    const key = this.deriveKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
}
