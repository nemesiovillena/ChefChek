/**
 * Migración one-shot: sube los ficheros de `uploads/` a Bunny.net Storage y
 * reescribe las URLs guardadas en BD.
 *
 *   - `uploads/{users,recipes,products,pedidos-compra}/*`  → Storage Zone pública
 *     (`BUNNY_STORAGE_ZONE`). URLs `/uploads/x/y` → `${BUNNY_CDN_URL}/uploads/x/y`.
 *   - `uploads/backups/**`                                 → Storage Zone privada
 *     (`BUNNY_BACKUP_STORAGE_ZONE`). Rellena `Backup.storageKey`.
 *
 * Idempotente: re-subir sobrescribe; las URLs ya migradas se ignoran.
 * NO borra los ficheros locales — hazlo a mano tras verificar en producción.
 *
 * Standalone (sin imports de `../src`) para poder compilarse a `dist/scripts/` y
 * ejecutarse dentro del contenedor de producción:
 *   node dist/scripts/migrate-uploads-to-bunny.js [--dry-run]
 * En local: `bunx ts-node scripts/migrate-uploads-to-bunny.ts --dry-run`.
 */
import { PrismaClient } from "@prisma/client";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const IMAGE_CATEGORIES = ["users", "recipes", "products", "pedidos-compra"];
const BACKUP_STORAGE_PREFIX = "backups";
const STORAGE_HOST =
  process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const CDN_URL = (process.env.BUNNY_CDN_URL || "").replace(/\/+$/, "");
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const prisma = new PrismaClient();

function log(...args: unknown[]): void {
  console.log(DRY_RUN ? "[dry-run]" : "[migrate]", ...args);
}

function cleanKey(key: string): string {
  return key
    .split(/[/\\]+/)
    .filter((seg) => seg !== "" && seg !== "." && seg !== "..")
    .join("/");
}

/** PUT a una Storage Zone de Bunny (mismo contrato que BunnyStorageService). */
async function bunnyPut(
  zone: string,
  password: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const url = `https://${STORAGE_HOST}/${zone}/${cleanKey(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { AccessKey: password, "Content-Type": contentType },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`Bunny PUT ${key} → ${res.status} ${await res.text()}`);
  }
}

/** `/uploads/users/x.jpg` (o `uploads/users/x.jpg`) → `${CDN}/uploads/users/x.jpg`. */
function toCdnUrl(stored: string): string | null {
  const m = stored.match(
    /^\/?(uploads\/(?:users|recipes|products|pedidos-compra)\/[^/]+)$/,
  );
  if (!m) return null;
  return `${CDN_URL}/${m[1]}`;
}

async function uploadImagesFromDisk(
  zone: string,
  password: string,
): Promise<void> {
  const root = join(process.cwd(), "uploads");
  for (const cat of IMAGE_CATEGORIES) {
    const dir = join(root, cat);
    if (!existsSync(dir)) continue;
    for (const name of await readdir(dir)) {
      const full = join(dir, name);
      if (!(await stat(full)).isFile()) continue;
      const key = `uploads/${cat}/${name}`;
      const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
      const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
      if (DRY_RUN) {
        log("PUT", key);
        continue;
      }
      await bunnyPut(zone, password, key, await readFile(full), contentType);
      log("subida", key);
    }
  }
}

async function rewriteImageColumn(
  model: "user" | "recipe" | "product",
  column: "avatarUrl" | "imageUrl",
): Promise<void> {
  const delegate = prisma[model] as unknown as {
    findMany: (a: unknown) => Promise<Array<Record<string, string>>>;
    update: (a: unknown) => Promise<unknown>;
  };
  const rows = await delegate.findMany({
    where: { [column]: { startsWith: "/uploads/" } },
    select: { id: true, [column]: true },
  });
  for (const row of rows) {
    const next = toCdnUrl(row[column]);
    if (!next) continue;
    log(`${model}.${column}`, row.id, "→", next);
    if (!DRY_RUN) {
      await delegate.update({
        where: { id: row.id },
        data: { [column]: next },
      });
    }
  }
}

async function rewriteIncidentPhotos(): Promise<void> {
  const events = await prisma.purchaseOrderEvent.findMany({
    where: { type: "INCIDENT_REPORTED" },
    select: { id: true, payload: true },
  });
  for (const ev of events) {
    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    const photoUrl = payload.photoUrl;
    if (typeof photoUrl !== "string" || !photoUrl.startsWith("/uploads/"))
      continue;
    const next = toCdnUrl(photoUrl);
    if (!next) continue;
    log("purchaseOrderEvent.payload.photoUrl", ev.id, "→", next);
    if (!DRY_RUN) {
      await prisma.purchaseOrderEvent.update({
        where: { id: ev.id },
        data: { payload: { ...payload, photoUrl: next } },
      });
    }
  }
}

async function migrateBackups(zone: string, password: string): Promise<void> {
  const localRoot = join(process.cwd(), "uploads", "backups");
  const rows = await prisma.backup.findMany({
    where: { filename: { not: null }, storageKey: null },
    select: { id: true, scope: true, tenantId: true, filename: true },
  });
  for (const row of rows) {
    const dir = row.scope === "GLOBAL" ? "global" : (row.tenantId ?? "unknown");
    const localPath = join(localRoot, dir, row.filename as string);
    if (!existsSync(localPath)) {
      log("backup SIN fichero local, se omite:", row.id, localPath);
      continue;
    }
    const key = `${BACKUP_STORAGE_PREFIX}/${dir}/${row.filename}`;
    log("backup", row.id, "→", key);
    if (!DRY_RUN) {
      await bunnyPut(
        zone,
        password,
        key,
        await readFile(localPath),
        "application/json",
      );
      await prisma.backup.update({
        where: { id: row.id },
        data: { storageKey: key },
      });
    }
  }
}

async function main(): Promise<void> {
  const imgZone = process.env.BUNNY_STORAGE_ZONE;
  const imgPass = process.env.BUNNY_STORAGE_PASSWORD;
  const bkZone = process.env.BUNNY_BACKUP_STORAGE_ZONE;
  const bkPass = process.env.BUNNY_BACKUP_STORAGE_PASSWORD;
  if (!imgZone || !imgPass || !CDN_URL || !bkZone || !bkPass) {
    throw new Error(
      "Faltan variables: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, " +
        "BUNNY_CDN_URL, BUNNY_BACKUP_STORAGE_ZONE, BUNNY_BACKUP_STORAGE_PASSWORD.",
    );
  }

  log("subiendo imágenes de disco a Bunny…");
  await uploadImagesFromDisk(imgZone, imgPass);
  log("reescribiendo URLs en BD…");
  await rewriteImageColumn("user", "avatarUrl");
  await rewriteImageColumn("recipe", "imageUrl");
  await rewriteImageColumn("product", "imageUrl");
  await rewriteIncidentPhotos();
  log("migrando backups…");
  await migrateBackups(bkZone, bkPass);
  log("hecho.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
