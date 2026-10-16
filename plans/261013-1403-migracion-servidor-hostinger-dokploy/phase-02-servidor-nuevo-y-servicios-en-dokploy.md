---
phase: 2
title: Servidor nuevo y servicios en Dokploy
status: completed
priority: P1
dependencies:
  - 1
effort: 2h
---

# Phase 2: Servidor nuevo y servicios en Dokploy

## Overview

Recrear en el VPS nuevo el proyecto ChefChek (Postgres + 3 apps) con la misma configuración,
sin dominios reales y con autoDeploy apagado. Producción no se ve afectada.

## Requirements

- Functional: mismos servicios, mismas env (con hostnames internos nuevos), mismo commit que producción.
- Non-functional: el backend **no arranca** hasta que la BD esté restaurada (fase 3).

## Architecture

```
GitHub main ──(GitHub App nueva)──▶ Dokploy nuevo
                                     ├─ chefchek-db (postgres:18, volumen propio)
                                     ├─ backend  ── volumen chefchek-uploads → /app/uploads
                                     ├─ ocr-microservice (solo red interna)
                                     └─ frontend (build arg BACKEND_URL → hostname interno del backend)
```

## Implementation Steps

Usuario (navegador):
1. Crear el VPS en Hostinger con plantilla Dokploy; añadir la clave SSH pública.
2. Entrar en `http://IP:3000`, crear el admin, generar API key.
3. Settings → Git → crear GitHub App e instalarla sobre `nemesiovillena/ChefChek`.

Claude:
4. Añadir una segunda entrada del MCP de Dokploy apuntando al servidor nuevo (la actual sigue en el viejo).
5. Endurecer el host: `ufw` (22, 80, 443; el 3000 del panel solo hasta ponerle dominio), actualizaciones.
6. Crear proyecto `ChefChek` / entorno `production`.
7. Crear Postgres `postgres:18`, base/usuario `chefchek`, misma contraseña (o nueva y ajustar `DATABASE_URL`).
   Sin puerto externo.
8. Crear las 3 apps: repo `nemesiovillena/ChefChek`, rama `main`, `buildPath=/`, `buildType=dockerfile`,
   `dockerfile` y `dockerContextPath` como en el viejo, `watchPaths` por app. **autoDeploy = false.**
9. Mount de volumen `chefchek-uploads` → `/app/uploads` en backend.
10. Env del backend copiadas tal cual **salvo** `DATABASE_URL` y `OCR_SERVICE_URL`, que usan los
    hostnames internos nuevos. `JWT_SECRET` y `CONFIG_ENCRYPTION_KEY` idénticos, byte a byte.
11. Frontend: `NEXT_PUBLIC_*` como **build args** (no env) + `BACKEND_URL=http://<appName backend nuevo>:3001`.
12. Desplegar solo `ocr-microservice` y Postgres. Backend y frontend se despliegan en la fase 3, tras el restore.

## Success Criteria

- [ ] Postgres y OCR en estado `done`; `/health` del OCR responde en la red interna.
- [ ] Diff de env viejo ↔ nuevo: solo cambian los hostnames internos.
- [ ] autoDeploy apagado en las 3 apps del servidor nuevo.
- [ ] Backend aún sin desplegar.

## Risk Assessment

- Arrancar el backend antes del restore deja un esquema vacío migrado → se evita por orden; si ocurre,
  recrear la base (`DROP DATABASE` solo en el servidor **nuevo**) y repetir.
- Versión de Dokploy distinta a la vieja: aceptable; anotar la diferencia.
