import * as fs from "fs";
import * as path from "path";
import { BunnyStorageService } from "../bunny/bunny-storage.service";
import { generateUploadFilename } from "./upload-filename.util";

/**
 * Guarda una imagen subida y devuelve su URL pública.
 *
 *  - Con Bunny configurado: sube a la Storage Zone pública en
 *    `uploads/<category>/<uuid>.<ext>` y devuelve la URL CDN absoluta
 *    (`https://…b-cdn.net/uploads/<category>/<uuid>.<ext>`).
 *  - Sin Bunny (dev sin credenciales): escribe en `uploads/<category>/` y
 *    devuelve la ruta relativa `/uploads/<category>/<uuid>.<ext>` — el mismo
 *    comportamiento que antes de la migración.
 *
 * La validación de tipo/tamaño la hace cada controller antes de llamar aquí.
 */
export async function storeUploadedImage(
  bunny: BunnyStorageService,
  category: string,
  file: Express.Multer.File,
): Promise<string> {
  const fileName = generateUploadFilename(file.originalname);
  const key = `uploads/${category}/${fileName}`;

  if (bunny.imagesEnabled) {
    return bunny.uploadImage(
      key,
      file.buffer,
      file.mimetype || "application/octet-stream",
    );
  }

  const dir = path.join(process.cwd(), "uploads", category);
  /* istanbul ignore next */
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, fileName), file.buffer);
  return `/${key}`;
}
