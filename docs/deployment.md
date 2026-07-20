# Deployment

## Platform: Dokploy (self-hosted, VPS Hostinger)

- Dokploy project: **ChefChek** (`projectId=4uZT3_IQ6oyjN1Oeg5vov`), environment `production`.
- VPS: Hostinger, IP `72.62.183.215` (verificada vía `domain-validateDomain`; el registro `@` raíz de `chefchek.com` apunta a otro servidor, `2.57.91.91` — no confundir), dominio `chefchek.com`.

## Servicios

| App | Repo path | Dockerfile | Puerto | Dominio |
|---|---|---|---|---|
| `backend` | `backend/` | `backend/Dockerfile` | 3001 | `api.chefchek.com` |
| `frontend` | `frontend/` | `frontend/Dockerfile` | 3000 | `app.chefchek.com` |
| `ocr-microservice` | `backend/ocr-microservice/` | `backend/ocr-microservice/Dockerfile` | 8000 | ninguno (solo red interna del project) |
| `chefchek-db` | — | Postgres 18 gestionado | 5432 | interno |

Las 3 apps apuntan al repo `nemesiovillena/ChefChek`, branch `main`, con `buildPath=/` y el `dockerfile`/`dockerContextPath` apuntando al subdirectorio real (Dokploy resuelve `dockerfile` relativo a la raíz del repo, no al `buildPath`). Auto-deploy activo en push a `main`, `watchPaths` scoped por servicio para no reconstruir los 3 en cada push.

`OCR_SERVICE_URL` en `backend` apunta al hostname interno de `ocr-microservice` dentro de la red Docker del project (Dokploy resuelve apps del mismo project por su `appName`). El microservicio OCR no tiene ninguna API key propia: el backend le pasa la key de IA del tenant por request.

## Deploy Command

Vía Dokploy MCP/dashboard: `application-deploy` por app, o push a `main` (auto-deploy). No hay un `docker-compose` único de producción — cada app se construye desde su propio Dockerfile/contexto.

## Environment Variables

Definidas en Dokploy (no en el repo): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `APP_URL`, `APP_NAME`, `OCR_SERVICE_URL`, `OCR_PROVIDER`, `OCR_MIN_CONFIDENCE`, `OCR_ENABLE_FALLBACK`, `CONFIG_ENCRYPTION_KEY` (backend); `NODE_ENV`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BACKEND_URL` + build arg `BACKEND_URL` (frontend); `OCR_LANGUAGE`, `OCR_USE_GPU`, `OCR_CONFIDENCE_THRESHOLD` (ocr-microservice).

## Custom Domain

DNS en Hostinger: registros `A` para `api` y `app` → `72.62.183.215` (IP real del servidor Dokploy). SSL: Let's Encrypt vía Traefik (gestionado por Dokploy).

**Estado (2026-07-20): primer deploy completo y funcionando.**

Historial de lo que hizo falta resolver (por si se repite):
1. DNS apuntaba a la IP equivocada (`2.57.91.91`, otro servidor Hostinger) — corregido a `72.62.183.215`. Causaba `TLS alert internal error`.
2. Tras el DNS correcto, Traefik seguía sirviendo `TRAEFIK DEFAULT CERT` (no reintentaba ACME solo) — se resolvió borrando y recreando el `domain` en Dokploy + `application-reload`.
3. Con HTTPS ya real, el backend daba `502 Bad Gateway`: `PrismaClientInitializationError` en runtime — `binaryTargets` en `schema.prisma` apuntaba a `linux-arm64-openssl-1.1.x` (para Mac Apple Silicon) pero el VPS de Hostinger es **amd64**. Fix: añadir `debian-openssl-1.1.x` a `binaryTargets`.
4. `main` estaba ~110 commits por detrás de `develop` (Dokploy se activó antes de que hubiera un merge real a producción) — se hizo merge completo `develop → main` tras arreglar el fix de Prisma, un lockfile desincronizado y 2 tests preexistentes rotos (no relacionados) en CI.

Verificado: `https://api.chefchek.com/health` → `{"status":"ok"}`, `https://app.chefchek.com` → 200, ambos con certificado Let's Encrypt real.

## Pendiente

- [ ] `bunx prisma migrate deploy` contra el Postgres de Dokploy (desde la terminal del contenedor `backend` en el dashboard — sin acceso SSH/exec vía MCP no se pudo automatizar).
- [ ] Crear usuario admin inicial (upsert quirúrgico, no seed con reset).

## Rollback

Desde el dashboard de Dokploy: cada app mantiene historial de deployments (`applicationId` → pestaña Deployments), rollback a un build anterior con un clic. Postgres es un servicio separado, no se ve afectado por rollback de una app.
