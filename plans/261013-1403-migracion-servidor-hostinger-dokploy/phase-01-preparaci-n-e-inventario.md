---
phase: 1
title: Preparación e inventario
status: completed
priority: P1
dependencies: []
effort: 1h
---

# Phase 1: Preparación e inventario

## Overview

Dejar el servidor viejo medido y respaldado antes de tocar nada, y bajar el TTL del DNS con
antelación para que el corte propague en minutos. Todo es solo lectura sobre producción.

## Requirements

- Functional: inventario completo de configuración y tamaños; copia de seguridad fuera del servidor.
- Non-functional: ningún cambio en producción salvo el TTL del DNS.

## Related Code Files

- Modify: ninguno (solo lectura). Los secretos se guardan fuera del repo.

## Implementation Steps

1. Acceso SSH `root` al VPS viejo (`72.62.183.215`) con la clave `id_ed25519_claude_code`.
2. Inventario por SSH:
   - `docker --version`, versión de Dokploy, Ubuntu, RAM, disco libre.
   - Tamaño de la BD (`pg_database_size`) y de los volúmenes `chefchek-uploads` y `chefchek-db-9rqhvg-data`.
   - `docker volume ls` y `docker service ls`: confirmar que no hay volúmenes/servicios fuera de lo inventariado.
   - Crons del host (`crontab -l`, `/etc/cron.d`) y reglas de firewall (`ufw status`).
3. Exportar env y build args de las 3 apps (Dokploy MCP `application-one`) a un fichero **local fuera
   del repo** (scratchpad, permisos 600). Incluye `ocr-microservice` (pendiente de leer).
4. Copia de seguridad previa: `pg_dump -Fc` descargado al Mac + backup JSON por tenant desde el
   módulo Backup de la app (queda en Bunny `chefchek-backups`).
5. Anotar conteo de filas por tabla (línea base para comparar después).
6. Bajar el TTL de los registros `A` `app` y `api` a 300 s en el DNS de Hostinger, **≥24 h antes del corte**.
7. Comprobar que nada externo usa la IP en vez del dominio: conector Cuiner (SRVCUINER), KDS, Zebra,
   webhooks de terceros.

## Success Criteria

- [ ] Volcado `-Fc` verificado con `pg_restore --list` y guardado fuera del servidor.
- [ ] Env/build args de las 3 apps guardados fuera del repo.
- [ ] Tamaños de BD y uploads anotados (dimensionan disco y duración del corte).
- [ ] TTL de `app`/`api` a 300 s.
- [ ] Lista de integraciones que apuntan por IP (se espera vacía).

## Risk Assessment

- Secretos en claro: no escribirlos en el plan, en commits ni en el chat.
- `pg_dump` en caliente es consistente (snapshot MVCC) y no bloquea escrituras.
