import * as fs from "fs";
import * as path from "path";
import { BunnyStorageService } from "../bunny/bunny-storage.service";
import { generateUploadFilename } from "./upload-filename.util";

/**
 * Directorio local para adjuntos privados (certificados de mantenimiento
 * SICTED) — deliberadamente FUERA de `uploads/`: `main.ts` sirve `uploads/`
 * entero como estático sin auth cuando Bunny no está configurado (fallback
 * de dev, ver plan `260831-0031-uploads-auth-tenant-scoped`). Un adjunto
 * privado nunca debe quedar alcanzable así; se lee solo a través del
 * endpoint de descarga autenticado (`sicted-maintenance.controller.ts`).
 */
const PRIVATE_ATTACHMENTS_DIR = "private-uploads";

export interface StoredAttachment {
  storageKey: string;
  name: string;
  mime: string;
  size: number;
}

/**
 * Guarda un adjunto privado tenant-scoped: en la zona Bunny sin Pull Zone si
 * está configurada, o en disco local fuera de `uploads/` si no (dev).
 */
export async function storePrivateAttachment(
  bunny: BunnyStorageService,
  category: string,
  tenantId: string,
  file: Express.Multer.File,
): Promise<StoredAttachment> {
  const fileName = generateUploadFilename(file.originalname);
  const key = `${category}/${tenantId}/${fileName}`;

  if (bunny.backupsEnabled) {
    await bunny.uploadPrivateFile(
      key,
      file.buffer,
      file.mimetype || "application/octet-stream",
    );
  } else {
    const dir = path.join(
      process.cwd(),
      PRIVATE_ATTACHMENTS_DIR,
      category,
      tenantId,
    );
    /* istanbul ignore next */
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(process.cwd(), PRIVATE_ATTACHMENTS_DIR, key),
      file.buffer,
    );
  }

  return {
    storageKey: key,
    name: file.originalname,
    mime: file.mimetype || "application/octet-stream",
    size: file.size,
  };
}

/** Lee un adjunto privado por su `storageKey` — el llamador ya comprobó que pertenece al tenant correcto. */
export async function readPrivateAttachment(
  bunny: BunnyStorageService,
  storageKey: string,
): Promise<Buffer> {
  if (bunny.backupsEnabled) {
    return bunny.downloadBackup(storageKey);
  }
  const { readFile } = await import("node:fs/promises");
  return readFile(
    path.join(process.cwd(), PRIVATE_ATTACHMENTS_DIR, storageKey),
  );
}
