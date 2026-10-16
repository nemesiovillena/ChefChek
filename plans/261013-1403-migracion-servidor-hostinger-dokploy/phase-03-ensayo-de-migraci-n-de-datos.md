---
phase: 3
title: Ensayo de migración de datos
status: completed
priority: P1
dependencies:
  - 2
effort: 2h
---

# Phase 3: Ensayo de migración de datos

## Overview

Ensayo general: copiar BD y uploads al servidor nuevo, arrancar la app y probarla con un dominio
temporal. Producción sigue sirviendo desde el viejo. Sirve para cronometrar el corte y dejar los
comandos escritos en un script repetible.

## Requirements

- Functional: app completa funcionando en el servidor nuevo con datos reales de hoy.
- Non-functional: cero escrituras en el servidor viejo; procedimiento repetible e idempotente.

## Related Code Files

- Create: `scripts/migrate-server/copy-data.sh` (volcado + restore + uploads + verificación; hosts por
  argumento, sin secretos embebidos).

## Implementation Steps

1. BD, en streaming de servidor a servidor a través del Mac:
   ```bash
   ssh old 'docker exec $(docker ps -qf name=chefchek-db) pg_dump -U chefchek -Fc chefchek' \
     | ssh new 'docker exec -i $(docker ps -qf name=chefchek-db) pg_restore -U chefchek -d chefchek --no-owner --clean --if-exists'
   ```
2. Uploads, volumen a volumen:
   ```bash
   ssh old 'docker run --rm -v chefchek-uploads:/d alpine tar -C /d -cf - .' \
     | ssh new 'docker run --rm -i -v chefchek-uploads:/d alpine tar -C /d -xpf -'
   ```
   Comprobar antes el UID/GID propietario en el viejo y que el backend nuevo puede escribir.
3. Verificar: conteo de filas por tabla (viejo vs nuevo), `_prisma_migrations` idéntica, nº de ficheros
   y `du -s` de uploads.
4. Desplegar backend (ejecuta `prisma migrate deploy` → debe ser no-op) y frontend.
5. Dominios temporales `*.traefik.me` para frontend y backend. El frontend inlinea
   `NEXT_PUBLIC_API_URL` en build → para el ensayo, build con las URL temporales y añadir el origen
   temporal a `ALLOWED_ORIGINS`. **Anotar que hay que revertir ambos en el corte.**
6. Pruebas de humo en el dominio temporal: login por tenant (`X-Tenant-Slug`), listado de recetas con
   imágenes (uploads + Bunny), subir albarán (OCR + IA), asistente IA (prueba que la clave de tenant
   se descifra → `CONFIG_ENCRYPTION_KEY` correcta), WebSocket de notificaciones, PDF de ficha técnica.
7. Cronometrar pasos 1-4: es la duración real de la parada.
8. Parar backend y frontend nuevos al terminar (evita crons y alertas duplicadas sobre datos de ensayo).

## Success Criteria

- [ ] Conteos de filas y de ficheros coinciden.
- [ ] Todas las pruebas de humo pasan en el dominio temporal.
- [ ] `copy-data.sh` ejecutado dos veces seguidas sin errores (idempotente).
- [ ] Duración de la parada medida y comunicada.

## Risk Assessment

- Trabajos programados del backend (alertas de pedidos estancados, etc.) corriendo sobre la copia:
  no envían nada externo, pero se para el backend tras el ensayo.
- El ensayo no usa datos de prueba inventados: son datos reales de producción en un servidor privado.
