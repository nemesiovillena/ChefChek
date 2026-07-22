# Plan: almacenamiento persistente para uploads (avatares/imágenes) en Dokploy

## Estado
Propuesto. No iniciado. Sesión actual de ChefChek terminada al 100%; este plan es para ejecutarlo en otra sesión.

## Contexto (lee esto primero)
- El backend (NestJS, Docker en Dokploy) escribe los ficheros subidos en `process.cwd()/uploads`, i.e. **`/app/uploads`** (avatar de usuario → `/app/uploads/users/<ts>-<name>.jpg`; imagen de artículo → `/app/uploads/products/...`). Controladores: `backend/src/modules/users/users.controller.ts` (`uploadAvatar`) y `backend/src/modules/products/products.controller.ts` (`uploadImage`). Patrón idéntico: `mkdirSync({recursive})` + `writeFileSync(file.buffer)`.
- El `Dockerfile` (stage 3 `runner`, `node:20-bullseye-slim`) hace `WORKDIR /app`, copia `dist/node_modules/prisma/package.json` (NO copia `uploads/`), crea un usuario no-root `nodejs` (uid 1001), `chown -R nodejs:nodejs /app`, y `USER nodejs`.
- La app de Dokploy tiene **`mounts: []`** → `/app/uploads` vive en la capa escribible efímera del contenedor. **Cualquier fichero subido se pierde en cada redeploy del backend.**
- El frontend sirve esas imágenes vía un rewrite de `frontend/next.config.ts`: `/uploads/:path*` → `${BACKEND_URL}/uploads/:path*` (`BACKEND_URL` = URL interna del contenedor backend). Esto NO cambia; las URLs relativas `/uploads/...` siguen funcionando.
- Producción: proyecto Dokploy "ChefChek", entorno `production`. Backend appId `rwvkfGYBC2nFNu64nqwyT`, dominio `api.chefchek.com`. Deploy automático on push a `main`. Gestor del repo = **bun** (no npm).
- Memoria relevante: `avatar-upload-mimetype-allowlist-prod.md` (el `/app/uploads` efímero ya está documentado como defecto pendiente).

## Objetivo
Que los ficheros subidos (avatares, imágenes de artículo/receta) **sobrevivan a redeploys** del backend, sin perder los existentes y sin romper la subida ni el display.

## Enfoque recomendado: volumen persistente en `/app/uploads`
Mínimo impacto: **cero cambios de código** (la ruta sigue siendo `/app/uploads`), solo infra (volumen de Dokploy) + un ajuste del Dockerfile para que el volumen tenga los permisos correctos. Adecuado para un nodo único de Dokploy (el caso actual).

> Alternativa descartada por ahora: object storage (S3/Cloudflare R2/MinIO). Más robusto y multi-nodo, pero requiere subir desde el backend al bucket, devolver URLs del bucket y añadir `remotePatterns` a next/image. Solo si en el futuro se escala a varios nodos.

## Fases

### Fase 1 — Dockerfile: crear `/app/uploads` con owner correcto
**Por qué**: Docker, al montar un volumen en una ruta que **existe** en la imagen, copia su contenido y **ownership** al volumen. Si la ruta no existe (caso actual: la crea la app en runtime), Docker la crea como **root** y el proceso `nodejs` no puede escribir → uploads fallan con `EACCES`. Creándola en build y haciéndola propiedad de `nodejs`, el volumen hereda el owner correcto.

**Fichero**: `backend/Dockerfile` (stage 3 `runner`), después de `RUN chown -R nodejs:nodejs /app` y **antes** de `USER nodejs`:
```dockerfile
RUN chown -R nodejs:nodejs /app
# Pre-create the uploads dir owned by nodejs so a named volume mounted here
# inherits the right ownership (otherwise Docker creates it as root and the
# non-root app can't write → EACCES on every upload).
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads
USER nodejs
```
El `if (!fs.existsSync(...)) fs.mkdirSync(...)` de los controladores queda como redundancia inocua (no hace falta tocarlo).

**Validación**: `bun run build` (docker build) no falla; la imagen contiene `/app/uploads` propiedad de `nodejs` (`docker run --rm <img> ls -ld /app/uploads` → owner nodejs).

### Fase 2 — Añadir el volumen persistente en Dokploy (backend)
En Dokploy → app **backend** → pestaña **Volumes / Mounts** → añadir un mount:
- **Container path**: `/app/uploads`
- **Type**: named volume (recomendado, Dokploy lo gestaja) o bind mount a un path del host (ej. `/var/lib/chefchek/uploads`).
- Guardar → esto dispara un redeploy.

> No hay herramienta MCP de Dokploy para crear mounts; va por la UI. Confirmar en `application-one` que `mounts` ya no es `[]` tras guardar.

**Validación**: tras el redeploy, `mounts` del backend contiene la entrada a `/app/uploads`.

### Fase 3 — Verificar extremo a extremo en producción
1. Subir un avatar (Editar usuario → foto) → **201**, `avatarUrl: /uploads/users/...`.
2. Confirmar que se **muestra** (el rewrite `/uploads` ya funciona).
3. **Forzar un redeploy** del backend (push trivial a `main`, o redeploy manual en Dokploy).
4. Tras el redeploy: el avatar **sigue mostrándose** (el fichero persistió). Antes del fix, aquí desaparecería.
5. Revisar logs del backend: **sin `EACCES`** ni errores de escritura en `/app/uploads`.

## Criterios de aceptación
- [ ] Subir avatar → 201 y se muestra.
- [ ] Redeploy del backend → el avatar persiste y sigue mostrándose.
- [ ] Sin `EACCES`/errores de escritura en logs del backend.
- [ ] `mounts` del backend en Dokploy incluye `/app/uploads`.

## Riesgos y rollback
- **Owner incorrecto del volumen** → `EACCES` al subir. Rollback: corregir la Fase 1 (chown) o quitar el mount. La Fase 1 previene esto.
- **Ficheros existentes**: ya se perdieron en redeploys previos (no hay nada que migrar). Si hubiera ficheros valiosos en el contenedor antes de montar el volumen, copiarlos al volumen antes del redeploy (no aplica ahora).
- **Single-node**: el volumen es de un nodo. Si se migra a multi-nodo, pasar a object storage (enfoque alternativo).
- **Backup**: ~~el módulo Backup (JSON app-level) **no** incluye ficheros de `/uploads`~~ **ACTUALIZADO (ver Hallazgos de ejecución)**: `BACKUP_DIR = uploads/backups`, así que los backups JSON caen dentro del volumen y persistirán. Aun así, respaldar el volumen a nivel Dokploy/host sigue siendo recomendable.

## Notas
- No tocar el frontend: el rewrite `/uploads/:path*` y las URLs relativas siguen válidas.
- No tocar los controladores: la ruta `process.cwd()/uploads` = `/app/uploads` no cambia.
- El OCR microservicio y el frontend no usan `/app/uploads`; el volumen va solo en el backend.

## Hallazgos de ejecución (2026-07-22, tras code-review)
- **Riesgo operacional descartado**: `application-one` confirma `mounts: []` hoy → no hay volumen pre-existente root-owned. Un **named volume nuevo** en `/app/uploads` hereda el ownership `nodejs` desde la imagen en el primer montaje (sembrado por la Fase 1). No hace falta volumen fresco ni `chown` del host. (Un **bind mount** sí requeriría owner uid 1001 en el host — por eso se recomienda named volume.)
- **Side-effect positivo (fuera del plan)**: el volumen `/app/uploads` también persiste:
  - Backups JSON (`backend/src/modules/backup/backup.constants.ts`: `BACKUP_DIR = "uploads/backups"`).
  - Imágenes de receta (`backend/src/modules/recipes/recipes.controller.ts:233` → `/app/uploads/recipes`).
- **Gap pre-existente (seguimiento aparte, fuera de alcance)**: los QR de cartas digitales se escriben en `/app/public/qrcodes/digital-menu` (`backend/src/modules/digital-menu/digital-menu.service.ts:243`), **fuera** de `/app/uploads` → no cubiertos por este volumen, seguirán efímeros. Follow-up: volumen propio en `/app/public` o reubicar QR bajo `/app/uploads/qrcodes`.
