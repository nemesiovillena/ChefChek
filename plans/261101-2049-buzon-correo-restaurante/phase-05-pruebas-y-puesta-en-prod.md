---
phase: 5
title: "Pruebas y puesta en prod"
status: pending
priority: P2
dependencies: [4]
effort: "0.5 día"
---

# Phase 5: Pruebas y puesta en producción

## Overview
Verificación end-to-end en local con el **buzón real** restaurante@warynessy.com (decisión validación; solo lectura, no cambia flags) y despliegue vía PR release `develop → main`.

## Requirements
- Matriz de permisos:

| Caso | Esperado |
|---|---|
| ADMIN / OWNER | ve |
| USER, VIEWER, USER_CUINER sin casilla | no ve, API 403 |
| USER, VIEWER, USER_CUINER con casilla | ve |
| Cuenta compartida ADMIN | ve (decisión usuario) |
| SUPERADMIN (con o sin tenant) | no ve, API 403 |
| Módulo off (cualquier rol) | no ve, API 403 |
| Pestaña Accesos: USER con casilla | no la ve, API access-log 403 |

- Batería de correos: `<script>`, `onerror`, `javascript:`, `<form>`, `<iframe>`, `<td background>`, `style=url()`, `srcset`, `<style>@import`, píxel de rastreo, adjunto `factura.html` con script, adjunto SVG, adjunto "Albarán_peña.pdf", mensaje >15 MB.
- Resiliencia: cortar la red durante una carga → el backend sigue vivo; contraseña errónea 3 veces → breaker y mensaje claro, sin ráfagas de LOGIN.

## Implementation Steps
1. `cd backend && bunx jest correo role-access audit` → verde. `bun run build` en backend y frontend.
2. Levantar con `dev-up.sh` (no `start:prod`); backend en dist no hace watch → rebuild tras cambios.
3. Recorrer la matriz con agent-browser; capturas escritorio y móvil.
4. Enviar la batería de correos **al buzón real** con asunto `[PRUEBA CHEFCHEK]`, comprobar lector (pestaña Red vacía) y adjuntos, y **borrarlos después desde el webmail de Hostinger** (avisar antes a gerencia: aparecerán en Outlook/móviles). <!-- Updated: Validation Session 1 - buzón real -->
5. Comprobar en Hostinger webmail que los mensajes abiertos en ChefChek siguen sin leer.
6. Comprobar `audit_logs` y la pestaña «Accesos» (asunto y remitente recortados).
7. PR feature → `develop`; luego PR release `develop → main`.
8. En prod: activar módulo `correo` solo en Warynessy, guardar credenciales en Ajustes → "Probar conexión" **una vez**, marcar casillas.
9. Docs: `docs/USERGUIDE.md` (dar permiso) y `docs/project-changelog.md`.

## Success Criteria
- [ ] Criterios de aceptación de `plan.md` verificados.
- [ ] Sin 500 en logs de Dokploy al navegar el buzón ni al cortar la red.
- [ ] Gerencia confirma acceso; un empleado sin permiso no.

## Risk Assessment
- `CONFIG_ENCRYPTION_KEY` existe en prod (SMTP/OCR) → verificar.
- IP de prod bloqueada por Hostinger → breaker + `retry:false`; probar conexión una sola vez.
- Rollback: desactivar módulo `correo` (corta a todos, SUPERADMIN incluido); sin migración que revertir.
