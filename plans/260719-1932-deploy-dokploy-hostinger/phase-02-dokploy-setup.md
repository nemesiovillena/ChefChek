# Fase 2: Dokploy setup (toca servidor real — confirmar antes de ejecutar)

## Contexto
Project "ChefChek" ya existe en Dokploy (`projectId=4uZT3_IQ6oyjN1Oeg5vov`, environment "production" `oUlqV6gnDM06bPKtDmvhW`), vacío. Se crean dentro: 1 Postgres gestionado + 3 applications (una por Dockerfile). Herramientas: `mcp__dokploy-mcp__postgres-create`, `application-create`, `application-saveGithubProvider` (o `saveDockerProvider`/git provider que corresponda), `application-saveBuildType`, `application-saveEnvironment`, `domain-create`.

## Bloqueado por decisiones del usuario (ver preguntas en el chat)
- Esquema de dominios (frontend/backend).
- Origen de secrets (JWT_SECRET, CONFIG_ENCRYPTION_KEY, password Postgres, API keys de OCR).
- Si se dispara el primer build automáticamente o se deja preparado para que el usuario lo lance desde el dashboard.

## Pasos

### 2.1 Postgres
1. `postgres-create` en el environment de "ChefChek" — nombre `chefchek-db`, password generado (no reusar el de dev `chefchek_password_change_in_prod`).
2. Guardar el connection string interno que devuelva Dokploy (host = nombre del servicio Postgres dentro de la red del project, puerto 5432, db `chefchek`).

### 2.2 Application `backend`
1. `application-create`: nombre `backend`, environment "ChefChek"/production.
2. Provider: git (GitHub) apuntando al repo, branch `main`, build path `backend/` (Dockerfile ahí). Usar `application-saveGithubProvider` (o el provider que Dokploy detecte para este repo) + `application-saveBuildType` (dockerfile).
3. `application-saveEnvironment` con:
   - `DATABASE_URL` = connection string del paso 2.1
   - `NODE_ENV=production`
   - `PORT=3001`
   - `JWT_SECRET` (nuevo, fuerte)
   - `JWT_EXPIRES_IN=1d`
   - `FRONTEND_URL=https://<dominio-frontend>`
   - `APP_URL=https://<dominio-frontend>`
   - `APP_NAME=ChefChek`
   - `OCR_SERVICE_URL=http://<nombre-servicio-ocr-interno>:8000` (confirmar el hostname real que asigna Dokploy tras crear la app `ocr-microservice` — vía `application-one` o el dashboard, antes de fijarlo aquí)
   - `OCR_PROVIDER=google`, `OCR_MIN_CONFIDENCE=70`, `OCR_ENABLE_FALLBACK=true`
   - `CONFIG_ENCRYPTION_KEY` (nuevo, `openssl rand -hex 32`)
   - `GOOGLE_CLOUD_VISION_API_KEY` si se usa
4. `domain-create`: `api.chefchek.com` (o el dominio decidido) → puerto 3001, SSL Let's Encrypt.

### 2.3 Application `ocr-microservice`
1. `application-create`: nombre `ocr-microservice`, mismo repo, build path `backend/ocr-microservice/`.
2. `application-saveEnvironment`:
   - `OCR_LANGUAGE=es`, `OCR_USE_GPU=False`, `OCR_CONFIDENCE_THRESHOLD=0.7`
   - Sin `REDIS_URL` — no se porta Redis (no usado en código, ver plan.md)
   - **Corrección tras verificar código** (`app/main.py` + `python-ocr.service.ts`): el microservicio OCR no lee ninguna API key de IA de su propio entorno — el backend NestJS la pasa por request (`ai_api_key` en el FormData), sourced desde la config del tenant en BD (cifrada con `CONFIG_ENCRYPTION_KEY`). El `.env` local de `ocr-microservice` solo trae un `OPENAI_API_KEY=your_openai_api_key_here` placeholder que nunca se usa. **No hace falta ninguna env var de API key aquí.**
3. **Sin domain-create** — queda solo en la red interna del project, sin exposición pública. Confirmar reachability interna desde `backend` vía el healthcheck antes de dar la fase por cerrada.

### 2.4 Application `frontend`
1. `application-create`: nombre `frontend`, mismo repo, build path `frontend/`.
2. Build arg `BACKEND_URL=http://backend:3001` (o el hostname interno real del backend) — se hornea en build time para los rewrites de Next.
3. `application-saveEnvironment`:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_API_URL=https://api.chefchek.com/api`
   - `NEXT_PUBLIC_APP_URL=https://<dominio-frontend>`
   - `NEXT_PUBLIC_BACKEND_URL=https://api.chefchek.com`
4. `domain-create`: dominio frontend decidido (p.ej. `app.chefchek.com`), puerto 3000, SSL.

## Validación
- `application-one` de las 3 apps devuelve estado configurado (sin desplegar aún, o `done` si Fase 3 ya corrió).
- Ningún secret quedó en un archivo del repo — todo vive en las env vars de Dokploy.

## Riesgo / rollback
- Crear recursos en Dokploy es reversible (`application-delete`, `postgres-remove`) pero son acciones sobre el servidor real de producción del usuario — **pedir confirmación explícita antes de cada creación**, no asumir autorización general.
