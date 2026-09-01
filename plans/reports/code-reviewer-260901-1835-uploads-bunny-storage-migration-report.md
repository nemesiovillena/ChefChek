# Code Review — Migración `/uploads` → Bunny.net Storage

Rama: `feat/uploads-bunny-storage` (worktree develop). Cambios sin commitear.
Fecha: 2026-09-01. Revisor: code-reviewer.

## Alcance

- Nuevos: `backend/src/common/bunny/{bunny-storage.module,bunny-storage.service,bunny-storage.service.spec}.ts`,
  `backend/src/common/utils/store-uploaded-image.util.ts`, `backend/scripts/migrate-uploads-to-bunny.ts`,
  `backend/prisma/migrations/20260901183000_add_backup_storage_key/migration.sql`.
- Modificados: `main.ts`, `app.module.ts`, `schema.prisma`, módulo backup (5 ficheros),
  4 controllers de subida (users/recipes/products/compras) + 3 specs, `.env.example`, `.eslintrc.json`,
  `frontend/next.config.ts`.
- LOC neto: ~+430 / -110. Foco: seguridad (cierra MEDIO-1 + exposición backups).

## Evaluación general

Cambio sólido y bien acotado. Cierra una exposición real: `/uploads/backups/**` servido estático
sin auth (exports JSON completos de BD por tenant) y escaneos/imágenes con URL adivinable.
Aislamiento por tenant en `download` preservado vía `getOne`. Fallback a disco coherente para dev.
Migración Prisma trivial y limpia. No quedan rutas de prod que dependan de `/uploads` estático
(QR/digital-menu usan `public/` + endpoints API; catálogo/OCR mantienen el buffer en memoria).

Sin CRÍTICOS nuevos. Un HIGH de configuración que condiciona TODA la efectividad del arreglo.

## Critical

Ninguno. (El cambio elimina la exposición crítica descrita en el contexto.)

## High

### H1 — El arreglo de seguridad depende por completo de `NODE_ENV === "production"` en runtime, y nada lo garantiza
`main.ts` solo desactiva `useStaticAssets("/uploads")` si `process.env.NODE_ENV !== "production"`.
`BunnyStorageService.onModuleInit` solo lanza si `NODE_ENV === "production"`.
- `backend/Dockerfile` (runner stage) NO hace `ENV NODE_ENV=production`.
- `docker-compose.yml` fija explícitamente `NODE_ENV: development` para el backend.
Si el deploy real no exporta `NODE_ENV=production`:
  1. `/uploads/**` se sigue sirviendo estático y anónimo (backups + escaneos expuestos otra vez).
  2. `onModuleInit` NO lanza; se cae en silencio a disco local y los backups vuelven a `uploads/backups`.
El resultado es un fallo *abierto* (fail-open) en la peor dirección.
**Recomendación:** fail-closed. Opciones:
  - Servir estático SOLO cuando Bunny no está configurado: `if (!bunny.imagesEnabled || !bunny.backupsEnabled)` en vez de `NODE_ENV`; y mantener el throw de `onModuleInit` atado a "Bunny no configurado Y hay indicios de prod".
  - O añadir `ENV NODE_ENV=production` al runner stage del Dockerfile y verificar que la plataforma de deploy lo fija.
  - Como mínimo, un log de arranque WARN muy visible cuando el estático de `/uploads` queda activo.

## Medium

### M1 — `download` de backups pasó de streaming a buffer completo en memoria
Antes: `res.download(path)` (stream desde disco). Ahora: `readBackupJson` devuelve el string completo
y `res.send(json)`; en Bunny además `downloadBackup` hace `Buffer.from(await res.arrayBuffer())`.
Backups GLOBAL pueden ser grandes (límite de restore 500 MB). Cada descarga concurrente carga el
export entero en heap (y duplicado: arrayBuffer + Buffer). Riesgo OOM/GC en el backend.
**Recomendación:** en `downloadBackup` devolver el `ReadableStream`/`res.body` de Bunny y hacer pipe a
la respuesta Express; para el fallback disco usar `createReadStream`.

### M2 — Cero cobertura de test en las rutas sensibles de backup
`npx jest` verde NO ejercita nada de esto: selección de rama en `readBackupJson` (Bunny vs disco),
persistencia de `storageKey`, el nuevo `download` (`res.send` JSON + 404 sin filename/storageKey),
ni la rama Bunny de `deleteBackup`. No existe `backup.service.spec.ts` ni `backup-export.service.spec.ts`.
**Recomendación:** unit test de `readBackupJson` (ambas ramas, con `bunny.backupsEnabled` true/false) +
test de controller para `download` (cuerpo JSON, headers, 404).

### M3 — `migrate-uploads-to-bunny.ts` no lo type-checkea ni lo linta CI
`tsconfig.json` `include: ["src/**/*"]` excluye `scripts/`; `.eslintrc.json` añade `"scripts/"` a ignore.
Es una migración one-shot de datos de PROD con casts de delegate Prisma (`prisma[model] as unknown as …`)
y merge de JSON en `PurchaseOrderEvent.payload`. Un fallo se descubre durante la migración real.
**Recomendación:** correr `--dry-run` contra un clon de prod y revisar cada reescritura antes del run
real; idealmente un `tsc --noEmit` puntual sobre el script.

## Low / informational

### L1 — Código muerto: `keyFromCdnUrl()` y `deleteImage()` sin llamadas
Solo los usa el spec. El reemplazo de imagen (avatar/receta/artículo) sigue dejando huérfano el
fichero anterior (igual que antes en disco). O se cablea la limpieza del fichero previo al
reemplazar, o se eliminan los métodos (YAGNI).

### L2 — `cleanKey()` no neutraliza todos los residuos de traversal
`"....//x"` → tras quitar `..` → `"..//x"` → colapso de barras → `"../x"`. `fetch()` normalizaría
el `..` en el path de la URL y podría salir del prefijo de la zona. Hoy NO explotable (todas las keys
son generadas en servidor: filenames UUID, dirs cuid, slugs saneados), pero el saneador es la defensa
declarada. Mejor: `split("/")`, descartar segmentos `.`/`..`/vacíos, `join`; y/o `encodeURIComponent`
por segmento.

### L3 — `next.config.ts`: `*.b-cdn.net` es demasiado amplio
Permite al optimizador de imágenes de Next hacer proxy de CUALQUIER pull zone de Bunny (cualquier
cliente de Bunny). Fijar al host CDN exacto (`chefchek.b-cdn.net`).

### L4 — `store-uploaded-image.util.ts` usa `fs` síncrono en handler async
`existsSync`/`mkdirSync`/`writeFileSync` bloquean el event loop. Solo dev, y hereda el patrón previo.
`fs/promises` sería más limpio.

### L5 — `superadmin-backup.controller` sin comprobación de scope en `getOne(id,"GLOBAL",null)`
Un SUPERADMIN puede descargar/restaurar/borrar un backup de tenant vía el controller global.
Pre-existente, cubierto por `SuperadminGuard`; se anota, no se pide cambio.

## Compat / correctitud de migración (verificado OK)

- Migración `20260901183000_add_backup_storage_key`: `ALTER TABLE "backups" ADD COLUMN "storageKey" TEXT`
  nullable, sin default. `prisma migrate deploy` aplica limpio en BD fresca. `schema.prisma` concuerda.
- Rows legacy (`storageKey = null`, `filename` set): siguen funcionando desde disco cuando Bunny off.
  Con Bunny on pero row no migrada → lee de disco; si el fichero no está → ENOENT → 500 (aceptable, sin
  pérdida ni corrupción, no hay dato que exponer).
- `restoreFromExisting` y el auto-backup pre-restore pasan ambos por las rutas conscientes de `storageKey`.
  No se rompen.
- Script: `dir`/`filename` coinciden con `backup-export.service` y con `filepathOf` (dir = `tenantId`,
  NO el slug). Idempotente: filtros `storageKey: null` e `imageColumn startsWith "/uploads/"`.
  `rewriteIncidentPhotos` preserva `description`, y `type: "INCIDENT_REPORTED"` + `payload.photoUrl`
  coinciden con `purchase-order.service.ts:281-283`.
- Aislamiento por tenant en `download` preservado (`getOne` valida `row.tenantId !== tenantId`).
- `BunnyStorageService` es `@Global`; los 4 controllers y el módulo backup resuelven la dependencia.
- Specs de los 3 controllers de imagen inyectan `{ imagesEnabled: false }` → cubren solo la rama disco;
  la rama Bunny la cubre `bunny-storage.service.spec.ts` con `fetch` mockeado.
- 4ª subida (compras `catalogos`, 10 MB): pasa buffer al servicio de IA, no persiste a `uploads/`. Sin impacto.

## Acciones recomendadas (prioridad)

1. H1: hacer fail-closed el gate de estático `/uploads` (no depender solo de `NODE_ENV`) o fijar
   `ENV NODE_ENV=production` en el Dockerfile + verificar plataforma de deploy.
2. M1: streamear la descarga de backups en vez de bufferizar el export completo.
3. M2: añadir tests de `readBackupJson` (ambas ramas) y del controller `download`.
4. M3: `--dry-run` del script de migración contra clon de prod antes del run real.
5. L1–L3: limpiar código muerto, endurecer `cleanKey`, fijar host CDN en `next.config.ts`.

## Métricas

- Type coverage: backend `strictNullChecks:false`/`noImplicitAny:false` (config del repo, sin cambio).
  Script de migración fuera de `tsc`.
- Test coverage: rutas de subida (rama disco) y `BunnyStorageService` (fetch mock) cubiertas.
  Rutas de backup (download/read/delete con `storageKey`) SIN cobertura.
- Lint: ficheros tocados OK (según verificación previa); `scripts/` ahora ignorado por eslint.
- Build: `nest build` OK, `tsc --noEmit` frontend OK (verificación previa).

## Preguntas sin resolver

1. ¿El runtime de producción fija `NODE_ENV=production`? Bloqueante para H1. El único compose del repo
   pone `development` y el Dockerfile no lo fija.
2. Bunny Storage API: ¿`AccessKey` = password de la Storage Zone es correcto para zonas regionales, y
   `storage.bunnycdn.com` es el host adecuado o hace falta `BUNNY_STORAGE_HOSTNAME` regional en prod?
3. Fotos de incidencia e imágenes de artículo world-readable por CDN (URL UUID, sin firmar): el plan lo
   acepta — confirmar clasificación del dato (una foto de incidencia puede mostrar albarán/factura).
4. ¿El script `migrate-uploads-to-bunny.ts` está programado como paso del deploy, antes de retirar el
   volumen `uploads/`? ¿Hay backups en disco de prod que migrar sí o sí?
5. ¿Existe algún visor en el frontend de escaneos de albarán/OCR que cargue desde `/uploads`? No encontré
   persistencia a disco de esos ficheros, pero conviene confirmar que no se rompe ninguna vista en prod.

Status: DONE_WITH_CONCERNS
Summary: Migración correcta y bien acotada que cierra la exposición de backups; la efectividad del
arreglo depende de `NODE_ENV=production` sin garantía en Docker/compose (H1), la descarga de backups
pasó a bufferizar en memoria (M1) y las rutas sensibles de backup no tienen tests (M2).
Concerns: H1 fail-open de seguridad; M1 riesgo OOM; M2/M3 gaps de verificación.
