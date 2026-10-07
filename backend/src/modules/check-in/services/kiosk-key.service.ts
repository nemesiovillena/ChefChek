import { Injectable } from "@nestjs/common";
import {
  constants,
  createPrivateKey,
  generateKeyPairSync,
  privateDecrypt,
} from "crypto";
import { PrismaService } from "../../../common/services/prisma.service";

/**
 * Clave del kiosco para fichar sin conexión. El dispositivo cifra
 * "<id del fichaje>:<PIN>" con la clave pública (RSA-OAEP, SHA-256) y lo
 * guarda en su cola; solo el servidor puede descifrarlo al sincronizar.
 *
 * Incluir el id del fichaje en el texto cifrado impide reutilizar un PIN
 * cifrado capturado para otro fichaje.
 */
@Injectable()
export class KioskKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Clave pública del tenant (SPKI DER en base64); la crea la primera vez. */
  async getPublicKey(tenantId: string): Promise<string> {
    const existing = await this.prisma.checkInKioskKey.findUnique({
      where: { tenantId },
      select: { publicKeySpki: true },
    });
    if (existing) {
      return existing.publicKeySpki;
    }

    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    // upsert: dos kioscos abriéndose a la vez no deben crear dos claves.
    const saved = await this.prisma.checkInKioskKey.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        publicKeySpki: publicKey.toString("base64"),
        privateKeyPkcs8: privateKey.toString("base64"),
      },
      select: { publicKeySpki: true },
    });
    return saved.publicKeySpki;
  }

  /**
   * Descifra el PIN de un fichaje sin conexión. Devuelve null si no se puede
   * descifrar o si el texto no corresponde a ese fichaje.
   */
  async decryptPin(
    tenantId: string,
    punchId: string,
    encryptedPin: string,
  ): Promise<string | null> {
    const key = await this.prisma.checkInKioskKey.findUnique({
      where: { tenantId },
      select: { privateKeyPkcs8: true },
    });
    if (!key) {
      return null;
    }
    try {
      const plain = privateDecrypt(
        {
          key: createPrivateKey({
            key: Buffer.from(key.privateKeyPkcs8, "base64"),
            format: "der",
            type: "pkcs8",
          }),
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        Buffer.from(encryptedPin, "base64"),
      ).toString("utf8");
      const separator = plain.lastIndexOf(":");
      if (separator < 0 || plain.slice(0, separator) !== punchId) {
        return null;
      }
      const pin = plain.slice(separator + 1);
      return /^\d{4,6}$/.test(pin) ? pin : null;
    } catch {
      return null;
    }
  }
}
