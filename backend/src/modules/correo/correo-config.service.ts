import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  decryptSecret,
  encryptSecret,
} from "../../common/utils/encryption.util";
import { ImapConfigDto } from "./dto/imap-config.dto";

/**
 * Credenciales IMAP del buzón del restaurante, por tenant, en la tabla
 * Configuration (categoría MAIL_INBOX). La contraseña va cifrada con su propio
 * salt para no compartir clave derivada con SMTP ni OCR.
 */
const CATEGORY = "MAIL_INBOX";
const SALT = "chefchek-imap";
const KEYS = {
  host: "imap.host",
  port: "imap.port",
  user: "imap.user",
  pass: "imap.pass",
  smtpHost: "imap.smtpHost",
  smtpPort: "imap.smtpPort",
} as const;

export const IMAP_DEFAULT_HOST = "imap.hostinger.com";
export const IMAP_DEFAULT_PORT = 993;
export const SMTP_DEFAULT_HOST = "smtp.hostinger.com";
export const SMTP_DEFAULT_PORT = 465;

export interface ImapPublicConfig {
  configured: boolean;
  host: string;
  port: number;
  user?: string;
  hasPassword: boolean;
  /** Servidor de salida: mismo usuario y contraseña que el IMAP. */
  smtpHost: string;
  smtpPort: number;
}

export interface ImapSecretConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  smtpHost: string;
  smtpPort: number;
}

@Injectable()
export class CorreoConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que ve gerencia en Ajustes: nunca incluye la contraseña. */
  async getPublic(tenantId: string): Promise<ImapPublicConfig> {
    const v = await this.readValues(tenantId);
    return {
      configured: Boolean(v[KEYS.host] && v[KEYS.user] && v[KEYS.pass]),
      host: v[KEYS.host] || IMAP_DEFAULT_HOST,
      port: Number(v[KEYS.port] || IMAP_DEFAULT_PORT),
      user: v[KEYS.user] || undefined,
      hasPassword: Boolean(v[KEYS.pass]),
      smtpHost: v[KEYS.smtpHost] || SMTP_DEFAULT_HOST,
      smtpPort: Number(v[KEYS.smtpPort] || SMTP_DEFAULT_PORT),
    };
  }

  async save(
    tenantId: string,
    dto: ImapConfigDto,
    userId: string,
  ): Promise<ImapPublicConfig> {
    const entries: [string, string][] = [
      [KEYS.host, dto.host.trim().toLowerCase()],
      [KEYS.port, String(dto.port)],
      [KEYS.user, dto.user.trim()],
      [KEYS.smtpHost, (dto.smtpHost || SMTP_DEFAULT_HOST).trim().toLowerCase()],
      [KEYS.smtpPort, String(dto.smtpPort || SMTP_DEFAULT_PORT)],
    ];
    // Contraseña vacía → conservar la guardada (editar host sin re-teclearla)
    if (dto.pass) {
      entries.push([KEYS.pass, encryptSecret(dto.pass, SALT)]);
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.configuration.upsert({
          where: { tenantId_key: { tenantId, key } },
          create: {
            tenantId,
            key,
            value,
            category: CATEGORY,
            updatedBy: userId,
          },
          update: { value, updatedBy: userId },
        }),
      ),
    );
    return this.getPublic(tenantId);
  }

  /** Credenciales en claro para conectar. Lanza 400 si faltan o no descifran. */
  async getSecret(tenantId: string): Promise<ImapSecretConfig> {
    const v = await this.readValues(tenantId);
    if (!v[KEYS.host] || !v[KEYS.user] || !v[KEYS.pass]) {
      throw new BadRequestException(
        "El buzón del restaurante no está configurado: gerencia debe guardarlo en Ajustes.",
      );
    }
    let pass: string;
    try {
      pass = decryptSecret(v[KEYS.pass], SALT);
    } catch (e) {
      // Falta la clave del entorno: el mensaje original ya es claro
      if (
        e instanceof BadRequestException &&
        /CONFIG_ENCRYPTION_KEY/.test(e.message)
      ) {
        throw e;
      }
      // Clave distinta (p. ej. BD clonada de prod) o payload corrupto
      throw new BadRequestException(
        "Vuelve a guardar la contraseña del buzón en Ajustes.",
      );
    }
    return {
      host: v[KEYS.host],
      port: Number(v[KEYS.port] || IMAP_DEFAULT_PORT),
      user: v[KEYS.user],
      pass,
      smtpHost: v[KEYS.smtpHost] || SMTP_DEFAULT_HOST,
      smtpPort: Number(v[KEYS.smtpPort] || SMTP_DEFAULT_PORT),
    };
  }

  private async readValues(tenantId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, category: CATEGORY },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
