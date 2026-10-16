---
phase: 5
title: Verificación y retirada del servidor viejo
status: in-progress
priority: P2
dependencies:
  - 4
effort: 1h + 7 días de observación
---

# Phase 5: Verificación y retirada del servidor viejo

## Overview

Cerrar lo que la migración deja pendiente: backups programados, panel de Dokploy con dominio,
documentación, y retirar el servidor viejo tras un periodo de observación.

## Related Code Files

- Modify: `docs/deployment.md` (IP, hostnames internos, nota de migración).
- Modify: `.github/workflows/deploy.yml` solo si su comentario queda obsoleto (no despliega; Dokploy lo hace).

## Implementation Steps

1. **Backups de Postgres programados** en el Dokploy nuevo (hoy no existe ninguno): destino S3-compatible,
   diario, con retención. Hacer una restauración de prueba.
2. Poner dominio + HTTPS al panel de Dokploy nuevo y cerrar el puerto 3000 en `ufw`.
3. Subir de nuevo el TTL de `app`/`api` (3600 s).
4. Actualizar `docs/deployment.md` y la memoria del proyecto (IP nueva, MCP apuntando al nuevo).
5. Observación 7 días: logs del backend, uso de disco/RAM, certificados, sincronizaciones Cuiner.
6. Retirada del viejo — **solo con confirmación expresa**:
   - Volcado final de la BD vieja archivado fuera del servidor.
   - Desinstalar la GitHub App del Dokploy viejo del repo.
   - El VPS viejo **no se cancela** (Warynessy sigue ahí): solo se borran los servicios y volúmenes de
     ChefChek, comprobando antes por nombre que ninguno pertenece a Warynessy.
7. Quitar la entrada antigua del MCP de Dokploy.

## Success Criteria

- [ ] Backup programado ejecutado y restaurado en prueba.
- [ ] Panel de Dokploy por HTTPS; puerto 3000 cerrado.
- [ ] `docs/deployment.md` refleja el servidor nuevo.
- [ ] 7 días sin incidencias atribuibles a la migración.
- [ ] Servicios de ChefChek retirados del VPS viejo con confirmación del usuario; Warynessy sigue funcionando.

## Risk Assessment

- Warynessy comparte Dokploy y Traefik con el ChefChek viejo: al retirar, no tocar Traefik ni la red `dokploy-network`.
- Borrar el servidor viejo es irreversible: se hace al final y nunca sin confirmación.
