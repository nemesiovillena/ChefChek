# Fase 3: Primer deploy + cutover (toca servidor real)

## Contexto
Con Postgres + 3 applications configuradas (Fase 2), falta: migrar el schema, crear el usuario admin inicial, disparar el build/deploy real, verificar, y cablear CI para deploys automáticos futuros.

## Pasos
1. `application-deploy` de `backend` primero (necesita estar `running` para que `ocr-microservice` y `frontend` puedan validarse contra él).
2. Correr `bunx prisma migrate deploy` contra el Postgres de Dokploy — vía consola/terminal de la app en el dashboard de Dokploy (Dokploy expone terminal por app), no hay MCP tool dedicado para exec.
3. Crear usuario admin inicial (upsert quirúrgico con id fijo, **no seed con reset** — ver memoria `superadmin-missing-from-active-db`; aquí es DB nueva así que un seed normal es seguro, pero evitar scripts que hagan `TRUNCATE`).
4. `application-deploy` de `ocr-microservice` y `frontend`.
5. Verificar:
   - `https://api.chefchek.com/api/v1/health` → 200
   - `https://<frontend-domain>` carga y el login funciona contra el backend real
   - Desde dentro del container `backend` (o vía logs), confirmar que `OCR_SERVICE_URL` resuelve y un albarán de prueba no cae en FALLBACK
6. Configurar el webhook de Dokploy en GitHub (o usar `application-refreshToken` + `application-saveGithubProvider` con auto-deploy) para que push a `main` dispare rebuild — esto es lo que `.github/workflows/deploy.yml` deja pendiente ("cuando se active Dokploy, añadir job deploy o webhook").
7. Actualizar docs:
   - Crear `docs/deployment.md` (formato del skill `deploy`: plataforma, URLs, comando de deploy, env vars por app sin valores, dominio, rollback).
   - Actualizar `docs/DEPLOYMENTSTRATEGY.md` sección "Pendiente" (líneas ~405-410): tachar "Añadir job deploy... cuando se active Dokploy" y anotar que ya está activo.

## Validación
- Health checks de los 3 servicios en verde en el dashboard de Dokploy.
- Login real desde `https://<frontend-domain>` funciona end-to-end.
- `docs/deployment.md` y `docs/DEPLOYMENTSTRATEGY.md` reflejan el estado real post-deploy.

## Riesgos / rollback
- Primer deploy real a producción: si algo falla, `application` en Dokploy permite rollback a build anterior desde el dashboard — pero al ser el *primer* deploy no hay build anterior al que volver, así que el rollback real es: dejar la app en el estado "creada pero no expuesta" (sin `domain`) hasta que el health check esté en verde, y solo entonces confirmar dominio con el usuario.
- No ejecutar `prisma migrate deploy` ni crear el admin sin haber confirmado que el `DATABASE_URL` apunta al Postgres de Dokploy (no al de desarrollo local) — doble check antes de correr.
