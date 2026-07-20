# Fase 1: Docker prep (local, sin riesgo)

## Contexto
`backend/Dockerfile` y `frontend/Dockerfile` ya están production-ready (bun multi-stage, non-root, HEALTHCHECK). Solo `backend/ocr-microservice/Dockerfile` tiene un gap real.

## Archivos a modificar
- `backend/ocr-microservice/Dockerfile`

## Archivos a NO tocar
- `backend/Dockerfile`, `frontend/Dockerfile` (ya correctos)
- `docker-compose.yml` raíz (dev local, Dokploy no lo usa)
- `backend/ocr-microservice/docker-compose.yml` (dev local; el bug de `curl` ahí no bloquea Dokploy, solo local — opcional arreglarlo de paso)

## Pasos
1. Añadir `HEALTHCHECK` al `backend/ocr-microservice/Dockerfile`, igual de patrón que backend/frontend, usando `wget` (ya instalado en la imagen, no hace falta añadir `curl`):
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
     CMD wget -qO- http://localhost:8000/health || exit 1
   ```
2. (Opcional, mismo esfuerzo) En `backend/ocr-microservice/docker-compose.yml`, cambiar el `test` del healthcheck de `curl -f ...` a `wget -qO- ...` para que el compose local también funcione — o eliminar el bloque `healthcheck` de ahí ya que el `HEALTHCHECK` del Dockerfile lo cubre.
3. Validar build local de los 3 Dockerfiles (requiere Docker Desktop corriendo — estaba parado al momento de este plan):
   ```bash
   docker build -t chefchek-backend:test ./backend
   docker build -t chefchek-frontend:test ./frontend
   docker build -t chefchek-ocr:test ./backend/ocr-microservice
   ```
   Confirmar que las 3 terminan sin error antes de pasar a Fase 2.

## Validación
- Los 3 `docker build` completan.
- `docker run --rm chefchek-ocr:test` expone `/health` y el `HEALTHCHECK` interno pasa (`docker inspect --format='{{.State.Health.Status}}' <container>` → `healthy` tras el `start_period`).

## Riesgo / rollback
Ninguno — cambios locales en Dockerfile, reversible con `git checkout`.
