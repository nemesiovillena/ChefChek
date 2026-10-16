---
title: Migración de ChefChek a un servidor nuevo (Hostinger + Dokploy)
description: >-
  Mover producción (3 apps + Postgres 18 + volumen de uploads) a un VPS nuevo
  con Dokploy y repuntar app/api.chefchek.com, sin pérdida de datos.
status: in-progress
priority: P1
branch: fix/check-in-doble-entrada-pulsaciones-simultaneas
tags:
  - infra
  - dokploy
  - migracion
  - dns
blockedBy: []
blocks: []
created: '2026-10-13T12:04:44.731Z'
createdBy: 'ck:plan'
source: skill
---

# Migración de ChefChek a un servidor nuevo (Hostinger + Dokploy)

## Overview

Producción vive hoy en un VPS Hostinger (`72.62.183.215`) con Dokploy. Se levanta un VPS gemelo,
se replica la configuración, se ensaya la copia de datos y se hace un corte corto con cambio de DNS.
El servidor viejo queda intacto como vuelta atrás. No hay cambios de código de la app.

**Regla rectora:** cero pérdida de datos. Nada se borra en el servidor viejo hasta la fase 5 y con
confirmación expresa.

## Estado actual (verificado 2026-10-13 vía Dokploy MCP + DNS)

| Pieza | Detalle |
|-------|---------|
| Apps | `frontend` (Next.js :3000), `backend` (NestJS :3001), `ocr-microservice` (:8000, sin dominio) |
| Origen | GitHub `nemesiovillena/ChefChek`, rama `main`, autoDeploy en push, `watchPaths` por app |
| BD | `postgres:18`, base `chefchek`, volumen `chefchek-db-9rqhvg-data`. **Sin backups programados en Dokploy** |
| Ficheros | volumen `chefchek-uploads` montado en `/app/uploads` del backend |
| Dominios | `app.chefchek.com` → frontend, `api.chefchek.com` → backend, Let's Encrypt (Traefik) |
| DNS | Nameservers de Hostinger. `app`/`api` → `72.62.183.215`. La raíz `@` → `2.57.91.91` (otro servidor, **no se toca**) |
| Externo | Bunny.net (imágenes + backups), claves IA por tenant cifradas en BD |
| Mismo Dokploy | Proyecto **Warynessy** (web + Postgres) — se queda en el VPS viejo, fuera de este plan |

## Qué NO es igual en el servidor nuevo (lo que rompe una copia ingenua)

1. **Hostnames internos**: Dokploy genera sufijos aleatorios (`chefchek-db-xxxx`, `app-...-xxxx`).
   Hay que recalcular `DATABASE_URL`, `OCR_SERVICE_URL` y el build arg `BACKEND_URL` del frontend.
2. **`CONFIG_ENCRYPTION_KEY` y `JWT_SECRET` deben copiarse idénticos.** Si cambia la primera, las
   claves de IA de todos los tenants quedan indescifrables.
3. **GitHub App**: cada instancia de Dokploy necesita la suya instalada sobre el repo.
4. **El backend ejecuta `prisma migrate deploy` al arrancar.** Si arranca contra una BD vacía antes
   de restaurar, crea el esquema y el restore choca. Orden obligatorio: restaurar → arrancar backend.
5. **Let's Encrypt (HTTP-01) no emite hasta que el DNS apunta a la IP nueva.** Habrá unos minutos de
   certificado por defecto tras el corte; gotcha conocido: si Traefik no reintenta, borrar y recrear
   el dominio en Dokploy + reload.
6. **Dos Dokploy escuchando `main`** durante el solape: congelar merges a `main` y dejar autoDeploy
   apagado en el nuevo hasta el corte.

## Decisiones de diseño

- **BD por volcado lógico** (`pg_dump -Fc` → `pg_restore`), no copiando el volumen. Misma versión
  mayor (18), consistente en caliente, verificable por conteo de filas.
- **Uploads por `tar` sobre SSH** de volumen a volumen (repetible; segunda pasada en el corte).
- **Corte con parada breve** (backend viejo detenido → volcado final → restore → DNS). Sin
  replicación ni doble escritura: YAGNI para este tamaño. Parada estimada 15-30 min.
- **Ensayo completo antes del corte** con dominio temporal `traefik.me`, sin tocar DNS real.
- **Vuelta atrás** = repuntar DNS a la IP vieja. Válida solo hasta que entren datos nuevos en el
  servidor nuevo (punto de no retorno, definido en fase 4).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Preparación e inventario](./phase-01-preparaci-n-e-inventario.md) | Completed |
| 2 | [Servidor nuevo y servicios en Dokploy](./phase-02-servidor-nuevo-y-servicios-en-dokploy.md) | Completed |
| 3 | [Ensayo de migración de datos](./phase-03-ensayo-de-migraci-n-de-datos.md) | Completed |
| 4 | [Corte y cambio de DNS](./phase-04-corte-y-cambio-de-dns.md) | Completed |
| 5 | [Verificación y retirada del servidor viejo](./phase-05-verificaci-n-y-retirada-del-servidor-viejo.md) | In Progress |

## Qué tiene que aportar el usuario

- ~~VPS nuevo creado~~ hecho: `srv2058713.hstgr.cloud`.
- Acceso SSH `root` a **ambos** VPS: añadir la clave pública `~/.ssh/id_ed25519_claude_code.pub`
  en `authorized_keys` (no pasar contraseñas por el chat).
- En el Dokploy nuevo: usuario admin creado, **API key** generada y **GitHub App** creada e instalada
  sobre `nemesiovillena/ChefChek` (son pasos de navegador con tu cuenta).
- Ventana de corte acordada (fuera de servicio de cocina) y aviso a los clientes.

## Acceptance criteria

- [ ] `app.chefchek.com` y `api.chefchek.com` resuelven a la IP nueva con certificado Let's Encrypt válido.
- [ ] Conteo de filas por tabla idéntico entre el volcado final y la BD nueva.
- [ ] Nº de ficheros y tamaño de `/app/uploads` idénticos.
- [ ] Login, OCR de albarán, imagen subida, asistente IA (clave de tenant descifrada) y conector Cuiner funcionan.
- [ ] Push a `main` despliega solo en el servidor nuevo.
- [ ] Backups programados de Postgres activos en el Dokploy nuevo.
- [ ] `docs/deployment.md` actualizado con IP y hostnames nuevos.

## Dependencies

Ninguna con otros planes. Requiere congelar merges a `main` durante la fase 4.

## Decisiones confirmadas (2026-10-13)

- Servidor nuevo: `srv2058713.hstgr.cloud` (`72.60.89.213`), misma cuenta de Hostinger. Panel Dokploy ya responde en `:3000`.
- "Migrar el dominio" = repuntar los registros `A` `app` y `api` a `72.60.89.213`. Sin traslado de zona.
- Warynessy **no se migra**: se queda solo en el VPS viejo (`72.62.183.215`), que por tanto **no se cancela**.
- La raíz `chefchek.com` (`2.57.91.91`) no se toca.

## Preguntas abiertas

1. Ventana de corte (día/hora).
