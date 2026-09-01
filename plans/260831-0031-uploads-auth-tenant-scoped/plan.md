# Plan — Migrar `/uploads` a Bunny.net Storage (cerrar exposición pública)

**Estado:** EN PR → https://github.com/nemesiovillena/ChefChek/pull/94 (base `develop`, commit `a5f93dd`) · **Origen:** hallazgo MEDIO-1 de la auditoría (`plans/reports/security-audit-260831-0018-*.md`) + cuenta Bunny.net.

**Pendiente antes de mergear:**
1. **[BLOQUEANTE] Reapuntar el Pull Zone `chefchek`.** Probado 2026-09-01: `chefchek.b-cdn.net/<key>` devuelve el 404 de la app Next de ChefChek, no el fichero de la Storage Zone → el Origin del Pull Zone apunta a la web app, no a la Storage Zone. En Bunny: Pull Zone `chefchek` → Origin → Origin Type = **Storage Zone** → `chefchek`. (Storage API de ambas zonas PUT/GET/DELETE verificada OK; passwords válidos.)
2. Fijar en Dokploy los 5 env (`BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_CDN_URL`, `BUNNY_BACKUP_STORAGE_ZONE`, `BUNNY_BACKUP_STORAGE_PASSWORD`) — sin ellos el arranque en prod falla a propósito.
3. Correr `scripts/migrate-uploads-to-bunny.ts` en prod tras el deploy (`--dry-run` primero).
4. Rotar secretos Bunny (expuestos en chat).

## Config Bunny confirmada (2026-09-01)

- Pull Zone + Storage Zone `chefchek` · Zone ID `6455385` · hostname `https://chefchek.b-cdn.net/`. Token Authentication NO se activa en la zona (rompería `<img>` públicos).
- Storage Zone `chefchek-backups` creada, **sin Pull Zone**.

## Implementación (resumen)

- `backend/src/common/bunny/bunny-storage.service.ts` (+ módulo `@Global()` en `app.module.ts`) — cliente Storage API, dos zonas. `imagesEnabled`/`backupsEnabled` según env; en prod exige ambas (`onModuleInit` lanza).
- `backend/src/common/utils/store-uploaded-image.util.ts` — helper DRY: Bunny si configurado, si no disco local (`/uploads/...`).
- Wired: `users`, `recipes`, `products`, `compras` (foto incidencia) controllers.
- Backups: `Backup.storageKey` (migración `20260901183000_add_backup_storage_key`); `backup-export.service` sube a zona privada; `backup.service.readBackupJson()` (Bunny→disco fallback); `deleteBackup` borra de Bunny; `download` de ambos controllers hace stream del JSON (ya no `res.download`). Sin copia local si Bunny activo.
- `main.ts` — **fail-closed**: `useStaticAssets("/uploads")` solo si NINGUNA zona Bunny está configurada (dev puro). En cuanto Bunny está activo, no se sirve estático. `Dockerfile` runner fija `ENV NODE_ENV=production`.
- `frontend/next.config.ts` — `remotePatterns` += host exacto `chefchek.b-cdn.net` (rewrite `/uploads` se mantiene como fallback dev).
- Descarga de backups: streaming (`openBackupDownload` → pipe), no bufferiza el export entero. `readBackupJson` (string completo) solo para restaurar.
- `scripts/migrate-uploads-to-bunny.ts` — one-shot: sube ficheros existentes + reescribe URLs en BD (`user.avatarUrl`, `recipe.imageUrl`, `product.imageUrl`, `PurchaseOrderEvent.payload.photoUrl`) + `Backup.storageKey`. `--dry-run`. No borra local. Standalone (sin imports de `../src`) → se compila a `dist/scripts/` (`bun run build:scripts`, incluido en el `Dockerfile`). En prod: `node dist/scripts/migrate-uploads-to-bunny.js`. Type-check: `bun run typecheck:scripts`.
- Tests: `bunny-storage.service.spec.ts` + `backup.service.spec.ts` nuevos (rutas Bunny/disco de read/download/delete); specs de controllers de subida actualizados. jest **128 suites / 1883 verdes**. `nest build` + typecheck front + typecheck scripts OK. eslint OK.

## Code review (2026-09-01)

`plans/reports/code-reviewer-260901-1835-uploads-bunny-storage-migration-report.md` — DONE_WITH_CONCERNS. Aplicado:
- **H1** (fail-open por `NODE_ENV`) → gate de estático ahora fail-closed sobre `bunny.*Enabled`; `Dockerfile` fija `NODE_ENV=production`.
- **M1** (OOM en descarga) → streaming.
- **M2** (sin tests de rutas de backup) → `backup.service.spec.ts`.
- **M3** (script fuera de tsc) → `tsconfig.scripts.json` + `typecheck:scripts` + `build:scripts` (compila el script standalone a `dist/scripts/` para ejecutarlo en el contenedor de prod).
- **L1** código muerto → `keyFromCdnUrl`/`deleteImage` eliminados (limpieza de imagen huérfana al reemplazar: pendiente, YAGNI).
- **L2** `cleanKey` → split/filter/join.
- **L3** → host CDN exacto.
- L4 (`fs` sync en dev fallback) y L5 (`superadmin getOne` sin scope, pre-existente) → aceptados sin cambio.

## Problema

`backend/src/main.ts:51` — `app.useStaticAssets(join(cwd, "uploads"), { prefix: "/uploads/" })` sirve **todo** `uploads/` sin sesión ni control de tenant:

| Ruta servida | Contenido | Riesgo |
|---|---|---|
| `/uploads/users/*` | avatares | bajo |
| `/uploads/recipes/*` | imágenes receta | bajo |
| `/uploads/products/*` | imágenes artículo | bajo |
| `/uploads/pedidos-compra/*` | fotos de incidencia de pedido | bajo (nombres UUID no enumerables) |
| `/uploads/backups/*` | **exports JSON de BD completos por tenant** | **CRÍTICO** — nombre `<slug>_<timestamp>.json` semi-adivinable; el `res.download` con auth de `backup.controller.ts` queda puenteado |

Nota: los escaneos de albarán **no** se guardan en disco (`albaranes.service.ts` procesa el buffer en memoria → OCR), pese a lo que decía la auditoría.

## Enfoque (decidido)

Migrar a **Bunny.net Storage** siguiendo el patrón ya probado en el proyecto WN26 (`apps/web/lib/bunny-storage.ts`). Descarta el proxy autenticado / cookie same-site del plan anterior: las URLs CDN son públicas, no hay problema de credencial en `<img>`.

**Dos Storage Zones separadas** (la separación público/privado es por zona, no por carpeta — todo lo que cuelgue de una zona con Pull Zone es descargable por CDN):

| Zona | Pull Zone | Contenido |
|---|---|---|
| `chefchek` | Sí → `chefchek.b-cdn.net` | imágenes. Carpetas `uploads/users/`, `uploads/recipes/`, `uploads/products/`, `uploads/pedidos-compra/` |
| `chefchekbackups` | **NO** (sin Pull Zone) | `backups/global/…`, `backups/<tenantSlug>/…` — acceso solo vía Storage API con AccessKey desde el backend |

**Decisiones del usuario (2026-09-01):**
- Fotos de incidencia → zona pública `chefchek` (nombres UUID; riesgo bajo; sin URLs firmadas).
- Backups → **solo Bunny**, sin copia local en disco. El restore descarga de Bunny.

## Cliente Bunny (patrón WN26)

`BunnyStorageClient`: Storage API `https://storage.bunnycdn.com/<zone>/<path>`, header `AccessKey: <storage password>`. Métodos `uploadFile(buffer, path)`, `deleteFile(path)`, `getPublicUrl(path)`, `listFiles(folder)`. Sanea path (sin `../`, sin slashes dobles). Dos factorías singleton: pública y backups.

## Fases

### 1. Cliente + config
- `backend/src/common/bunny/bunny-storage.client.ts` — port de WN26, solo `Buffer` (sin `File`). `getBunnyClient()` (pública) + `getBackupBunnyClient()` (backups).
- Env nuevas en `backend/.env.example` + Dokploy: `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_CDN_URL` (`https://chefchek.b-cdn.net`), `BUNNY_BACKUP_STORAGE_ZONE`, `BUNNY_BACKUP_STORAGE_PASSWORD`.
- Fallar en arranque si faltan (mismo criterio que WN26).

### 2. Subida de imágenes → zona pública
Helper compartido `uploadImageToBunny(file, category)` (DRY: hoy 4 copias de `fs.writeFileSync` + `mkdir`):
- `users.controller.ts` (`uploadAvatar`), `recipes.controller.ts` (`uploadImage`), `products.controller.ts` (`uploadImage`), `compras.controller.ts` (`reportOrderIncident`).
- Mantener `assertAllowedImageType` + límites de tamaño actuales.
- `generateUploadFilename(originalname)` → `uploads/<category>/<uuid>.<ext>`.
- Subir buffer a zona `chefchek`; guardar la URL CDN absoluta (`https://chefchek.b-cdn.net/uploads/<category>/<uuid>.<ext>`) en `avatarUrl` / `imageUrl` / `PurchaseOrderEvent.payload.photoUrl`.
- Al reemplazar imagen: `deleteFile` del anterior si la URL previa apunta a Bunny (best-effort).

### 3. Backups → zona privada, solo Bunny
- `Backup.storageKey String?` (path remoto completo) — migración Prisma (`migrate diff` + `migration.sql` manual + `migrate deploy`, sin TTY).
- `backup-export.service.ts`: en vez de `writeFile` local, `getBackupBunnyClient().uploadFile(buffer, "backups/<dir>/<filename>")`; persistir `storageKey`. Retirar `BACKUP_DIR` como dir de disco (queda como prefijo remoto).
- `backup.service.ts`:
  - `filepathOf` → `fetchBackupJson(row)`: descarga de Bunny (Storage API GET) → string. Usado en restore (:272) y download.
  - purge/retención (:374 `unlink`) → `deleteFile(row.storageKey)`.
- `backup.controller.ts` `download`: descargar de Bunny y responder con `res.set({ 'Content-Type': 'application/json', 'Content-Disposition': attachment })` + `res.send(buffer)` (ya no `res.download`).
- Auto-backup previo obligatorio al restore: mismo flujo, sube a Bunny.
- Restore desde `.json` subido por el usuario: sin cambio (llega por body, no toca disco).

### 4. Quitar el estático + frontend
- Borrar `app.useStaticAssets(...uploads...)` de `main.ts` → cierra MEDIO-1 y la exposición de backups.
- `frontend/next.config.ts`: `remotePatterns` += `{ protocol: "https", hostname: "**.b-cdn.net" }`; quitar el rewrite `/uploads/:path*` (ya no hay backend que lo sirva).
- CSP backend (`main.ts` helmet): `imgSrc` ya incluye `https:` — sin cambio (opcional: acotar a `https://chefchek.b-cdn.net`).
- Verificar en front que ninguna vista construye rutas `/uploads/...` manualmente (deben usar la URL guardada tal cual).

### 5. Migración de datos existentes (script one-shot)
`backend/scripts/migrate-uploads-to-bunny.ts`:
- Subir `uploads/{users,recipes,products,pedidos-compra}/*` → zona `chefchek` en la misma carpeta.
- Reescribir en BD: `avatarUrl` / `Recipe.imageUrl` / `Product.imageUrl` / `PurchaseOrderEvent.payload.photoUrl` de `/uploads/x/y.ext` → `https://chefchek.b-cdn.net/uploads/x/y.ext`.
- Subir `uploads/backups/**` → zona `chefchekbackups`; rellenar `Backup.storageKey`.
- Idempotente (comprobar existencia en Bunny antes de subir). Log de huérfanos (fichero sin URL en BD → se ignora).
- Tras verificar en prod: borrar el árbol `uploads/` local.

### 6. Verificación
- E2E: subir avatar + imagen de receta/artículo → cargan desde `*.b-cdn.net`.
- `GET /uploads/cualquier-cosa` → 404 (ya no servido).
- Backup: crear → existe en zona `chefchekbackups`, no accesible por URL pública; descargar por la app (con auth) → OK; restore desde esa copia → OK.
- Incidencia de pedido con foto → visible en el detalle.
- Migración: correr en staging con copia de datos reales, contar URLs reescritas vs ficheros.

## Riesgos

- **Regresión visual en prod** (imágenes rotas). Desplegar tras E2E; mantener el rewrite `/uploads` y el estático hasta confirmar que la migración reescribió todas las URLs, luego quitar en un 2º deploy.
- **Dependencia de Bunny para restaurar** (backups sin copia local, decisión aceptada). Mitigación: `download` de cada backup sigue disponible por la app; documentar en runbook que una copia crítica debe descargarse aparte.
- Subida a Bunny añade latencia de red al endpoint de upload (antes escritura local). Aceptable (uploads son acción de usuario puntual).
- `deleteFile` best-effort al reemplazar imagen → posibles huérfanos en Bunny. Aceptable; limpieza periódica opcional vía `listFiles`.

## Preguntas abiertas

- Password real de la Storage Zone `chefchek` (el pasado, `04744284-3619-4204-b57acae1be6b-4940-4e1b`, no es GUID válido).
- Nombre + password de la Storage Zone `chefchek-backups` una vez creada.
- ¿Se activa Token Authentication (fotos de incidencia) más adelante, o público indefinidamente?
