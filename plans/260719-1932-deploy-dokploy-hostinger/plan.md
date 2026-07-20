# Deploy a Dokploy (Hostinger VPS)

## Estado
- Fase 1 (Docker prep): pendiente
- Fase 2 (Dokploy setup): pendiente — bloqueada por decisiones del usuario (ver preguntas)
- Fase 3 (primer deploy + cutover): pendiente

## Contexto ya verificado (scouting, no repetir)
- VPS Hostinger + Dokploy ya instalados y operativos (`docs/deployment-checklist.md` fase C.1-C.2 hechas).
- Project "ChefChek" ya existe en Dokploy (`projectId=4uZT3_IQ6oyjN1Oeg5vov`, environment "production" `oUlqV6gnDM06bPKtDmvhW`), vacío: 0 apps, 0 DB.
- `backend/Dockerfile` y `frontend/Dockerfile`: multi-stage bun→node, non-root, HEALTHCHECK, ya production-ready. No tocar.
- `backend/ocr-microservice/Dockerfile`: funcional pero sin `HEALTHCHECK` propio, y su `docker-compose.yml` local usa `curl` en el healthcheck sin que `curl` esté instalado en la imagen (bug local, no afecta si Dokploy no usa ese compose).
- Backend ya lee `OCR_SERVICE_URL` vía `ConfigService` (`backend/src/modules/ocr/python-ocr.service.ts:14`) — solo hace falta setear la env var en Dokploy, cero cambio de código.
- Redis en `ocr-microservice/docker-compose.yml` es dead weight: solo declarado en `app/config.py`, no importado/usado en ningún otro sitio. No se porta a producción (YAGNI).
- Dokploy MCP no tiene modelo "compose stack" para esto — modela como Project → Applications (una por Dockerfile/subdirectorio del monorepo) + Postgres gestionado. El `docker-compose.yml` raíz queda solo para dev local, no se toca.
- Dominio existente: `chefchek.com` (Hostinger). Checklist previo proponía `app.chefchek.com` (frontend) + `api.chefchek.com` (backend); OCR sin dominio público (solo red interna del project).

## Fases
1. [phase-01-docker-prep.md](phase-01-docker-prep.md) — fix healthcheck OCR Dockerfile, validar build local de los 3 Dockerfiles.
2. [phase-02-dokploy-setup.md](phase-02-dokploy-setup.md) — crear Postgres + 3 applications en el project "ChefChek" existente, env vars, dominios.
3. [phase-03-first-deploy-cutover.md](phase-03-first-deploy-cutover.md) — migraciones, primer deploy, verificación, webhook CI, actualizar docs.

## Acceptance criteria
- Los 3 servicios (`backend`, `frontend`, `ocr-microservice`) corren en Dokploy dentro del project "ChefChek", accesibles vía `https://app.chefchek.com` y `https://api.chefchek.com/api/v1/health`; OCR solo accesible internamente.
- `bunx prisma migrate deploy` aplicado contra el Postgres gestionado de Dokploy sin pérdida de datos (no hay datos previos en ese Postgres — es nuevo).
- `docs/deployment.md` creado (formato del skill `deploy`) y `docs/DEPLOYMENTSTRATEGY.md` sección "Pendiente" actualizada.
- Ningún secreto (JWT_SECRET, API keys, DB password) queda commiteado en el repo.

## Riesgos
- Acción sobre servidor/producción real (Dokploy vive en Hostinger, no es reversible con un `git revert`). Confirmar con el usuario antes de: crear el Postgres, crear cada application, y disparar el primer `application-deploy`.
- Secrets: si el usuario quiere que yo los genere, no deben aparecer en texto plano en el chat más de lo necesario para pegarlos en Dokploy.
