import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

/** Host por defecto de la Storage API de Bunny (zona "principal"/global). */
const DEFAULT_STORAGE_HOST = "storage.bunnycdn.com";

interface ZoneConfig {
  host: string;
  /** Nombre de la Storage Zone. */
  zone: string;
  /** Password/AccessKey de la Storage Zone (Storage API). */
  password: string;
}

/**
 * Cliente de Bunny.net Storage. Dos zonas independientes:
 *
 *  - **imágenes** (`BUNNY_STORAGE_ZONE`): Storage Zone con Pull Zone conectada
 *    (`BUNNY_CDN_URL`). Contenido público servido por CDN. Avatares, imágenes de
 *    receta/artículo y fotos de incidencia de pedido.
 *  - **backups** (`BUNNY_BACKUP_STORAGE_ZONE`): Storage Zone SIN Pull Zone. Los
 *    exports JSON de BD solo se leen de vuelta por la app con sesión.
 *
 * Si las variables de una zona faltan, esa zona queda deshabilitada y el código
 * llamante cae a disco local (comportamiento previo). En producción exigimos
 * ambas configuradas: ver {@link onModuleInit}.
 *
 * @see https://docs.bunny.net/reference/storage-api
 */
@Injectable()
export class BunnyStorageService implements OnModuleInit {
  private readonly logger = new Logger(BunnyStorageService.name);
  private readonly imageZone: ZoneConfig | null;
  private readonly backupZone: ZoneConfig | null;
  /** URL base del CDN sin barra final, p.ej. `https://chefchek.b-cdn.net`. */
  private readonly cdnUrl: string;

  constructor(config: ConfigService) {
    const host =
      config.get<string>("BUNNY_STORAGE_HOSTNAME") || DEFAULT_STORAGE_HOST;

    const imgZone = config.get<string>("BUNNY_STORAGE_ZONE");
    const imgPass = config.get<string>("BUNNY_STORAGE_PASSWORD");
    this.imageZone =
      imgZone && imgPass ? { host, zone: imgZone, password: imgPass } : null;
    this.cdnUrl = (config.get<string>("BUNNY_CDN_URL") || "").replace(
      /\/+$/,
      "",
    );

    const bkZone = config.get<string>("BUNNY_BACKUP_STORAGE_ZONE");
    const bkPass = config.get<string>("BUNNY_BACKUP_STORAGE_PASSWORD");
    this.backupZone =
      bkZone && bkPass ? { host, zone: bkZone, password: bkPass } : null;
  }

  onModuleInit(): void {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd && (!this.imagesEnabled || !this.backupsEnabled)) {
      throw new Error(
        "Bunny.net no configurado en producción. Requeridas: BUNNY_STORAGE_ZONE, " +
          "BUNNY_STORAGE_PASSWORD, BUNNY_CDN_URL, BUNNY_BACKUP_STORAGE_ZONE, " +
          "BUNNY_BACKUP_STORAGE_PASSWORD.",
      );
    }
    this.logger.log(
      `Bunny storage — imágenes: ${
        this.imagesEnabled ? "ON" : "OFF (disco local)"
      }, backups: ${this.backupsEnabled ? "ON" : "OFF (disco local)"}`,
    );
  }

  get imagesEnabled(): boolean {
    return this.imageZone !== null && this.cdnUrl !== "";
  }

  get backupsEnabled(): boolean {
    return this.backupZone !== null;
  }

  // ─────────────────────────────────────────────── Imágenes (zona pública)

  /**
   * Sube una imagen a la zona pública y devuelve su URL CDN absoluta.
   * @param key ruta destino, p.ej. `uploads/users/<uuid>.jpg`
   */
  async uploadImage(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const zone = this.requireZone(this.imageZone, "imágenes");
    await this.put(zone, key, body, contentType || "application/octet-stream");
    return `${this.cdnUrl}/${cleanKey(key)}`;
  }

  // ─────────────────────────────────────────────── Backups (zona privada)

  async uploadBackup(key: string, body: Buffer): Promise<void> {
    const zone = this.requireZone(this.backupZone, "backups");
    await this.put(zone, key, body, "application/json");
  }

  async downloadBackup(key: string): Promise<Buffer> {
    const zone = this.requireZone(this.backupZone, "backups");
    return this.get(zone, key);
  }

  /** Stream de lectura del backup, para pipe directo a la respuesta HTTP. */
  async openBackupStream(key: string): Promise<Readable> {
    const zone = this.requireZone(this.backupZone, "backups");
    const res = await fetch(this.url(zone, key), {
      headers: { AccessKey: zone.password },
    });
    if (!res.ok || !res.body) {
      throw new Error(`Bunny GET ${key} → ${res.status}`);
    }
    return Readable.fromWeb(res.body as WebReadableStream);
  }

  async deleteBackup(key: string): Promise<void> {
    if (!this.backupZone) {
      return;
    }
    await this.delete(this.backupZone, key);
  }

  // ─────────────────────────────────────────────── HTTP a la Storage API

  private async put(
    zone: ZoneConfig,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const res = await fetch(this.url(zone, key), {
      method: "PUT",
      headers: { AccessKey: zone.password, "Content-Type": contentType },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      throw new Error(
        `Bunny PUT ${key} → ${res.status} ${await safeText(res)}`.trim(),
      );
    }
  }

  private async get(zone: ZoneConfig, key: string): Promise<Buffer> {
    const res = await fetch(this.url(zone, key), {
      headers: { AccessKey: zone.password },
    });
    if (!res.ok) {
      throw new Error(`Bunny GET ${key} → ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  private async delete(zone: ZoneConfig, key: string): Promise<void> {
    const res = await fetch(this.url(zone, key), {
      method: "DELETE",
      headers: { AccessKey: zone.password },
    });
    // 404 = ya no existe: no es un error para nuestro caso de uso.
    if (!res.ok && res.status !== 404) {
      throw new Error(`Bunny DELETE ${key} → ${res.status}`);
    }
  }

  private url(zone: ZoneConfig, key: string): string {
    return `https://${zone.host}/${zone.zone}/${cleanKey(key)}`;
  }

  private requireZone(zone: ZoneConfig | null, label: string): ZoneConfig {
    if (!zone) {
      throw new Error(`Bunny.net (${label}) no configurado.`);
    }
    return zone;
  }
}

/**
 * Normaliza una key de storage: descarta segmentos vacíos, `.` y `..`, de forma
 * que nunca pueda escapar del prefijo de la zona. Las keys se generan siempre en
 * servidor (UUID/cuid/slug saneado); esto es defensa en profundidad.
 */
function cleanKey(key: string): string {
  return key
    .split(/[/\\]+/)
    .filter((seg) => seg !== "" && seg !== "." && seg !== "..")
    .join("/");
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
