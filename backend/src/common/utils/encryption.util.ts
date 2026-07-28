import * as crypto from "crypto";
import { BadRequestException } from "@nestjs/common";

/**
 * Cifrado simétrico AES-256-GCM para secretos por tenant (API keys, passwords
 * SMTP, etc.). La clave se deriva de CONFIG_ENCRYPTION_KEY vía scrypt; el
 * parámetro `salt` separa dominios (p. ej. "chefchek-smtp", "chefchek-ocr")
 * para que un secreto comprometido no facilite descifrar el otro.
 *
 * Formato del payload: iv(12 bytes):authTag(16 bytes):cipher, todo en hex.
 */

/** Deriva la clave de 32 bytes; lanza si falta CONFIG_ENCRYPTION_KEY. */
export function assertEncryptionKey(salt: string): Buffer {
  const secret = process.env.CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    throw new BadRequestException(
      `Falta CONFIG_ENCRYPTION_KEY en el entorno del backend: necesaria para guardar secretos cifrados (${salt}).`,
    );
  }
  return crypto.scryptSync(secret, salt, 32);
}

/** Cifra un texto plano y devuelve el payload iv:tag:cipher en hex. */
export function encryptSecret(plain: string, salt: string): string {
  const key = assertEncryptionKey(salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

/** Descifra un payload iv:tag:cipher; lanza si está corrupto o falta la clave. */
export function decryptSecret(payload: string, salt: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new BadRequestException(
      `Secreto corrupto (${salt}): vuelve a guardarlo.`,
    );
  }
  const key = assertEncryptionKey(salt);
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
