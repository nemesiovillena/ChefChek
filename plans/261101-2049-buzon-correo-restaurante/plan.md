---
title: "Buzón de correo del restaurante en ChefChek (leer y enviar, permiso por persona)"
description: "Ver restaurante@warynessy.com (Hostinger IMAP) dentro de la app; solo gerencia y personas autorizadas"
status: in-progress
priority: P2
branch: "feat/correo-restaurante (desde develop tras mergear feat/permiso-pedidos-por-persona; un solo PR)"
tags: [correo, imap, permisos, warynessy]
blockedBy: []
blocks: []
created: "2026-11-01T19:50:55.175Z"
createdBy: "ck:plan"
source: skill
---

# PDR — Buzón de correo del restaurante

Informe de investigación: [research-261101-2049-buzon-correo-restaurante-warynessy-report.md](../reports/research-261101-2049-buzon-correo-restaurante-warynessy-report.md)

## Problema
El buzón `restaurante@warynessy.com` (Hostinger) solo se consulta fuera de ChefChek. Gerencia quiere verlo dentro de la app y decidir quién más puede.

## Objetivo v1
- Bandeja de solo lectura en `/dashboard/correo`: todas las carpetas, lista paginada, detalle con adjuntos.
- Pestaña «Accesos» (solo gerencia): quién abrió qué correo y cuándo.
- Visible para ADMIN/OWNER siempre; SUPERADMIN nunca; para el resto solo si se marca "Puede ver el correo del restaurante" en su ficha.
- Módulo `correo` activable por tenant (apagado por defecto; solo Warynessy).

- **Enviar** (cambio de alcance 2026-11-01, ver fase 6): nuevo, responder, responder a todos y reenviar, con adjuntos ≤10 MB y copia en «Enviados». Permiso aparte «Puede enviar correo».

## Fuera de alcance v1 (YAGNI)
Borrar/mover, búsqueda, notificaciones push, sincronizar a BD, varios buzones por tenant, borradores, firma HTML.

## Decisiones
| Tema | Decisión | Por qué |
|---|---|---|
| Arquitectura | Proxy IMAP en vivo (imapflow), sin copiar correo a BD | cero duplicación de datos personales; poco código |
| Credenciales | `Configuration` categoría `MAIL_INBOX`, contraseña con `encryptSecret` (salt `chefchek-imap`); TLS obligatorio; host interno rechazado | patrón SMTP + RT#11 |
| Permiso | sección `correo` `perUserOnly`, `defaultAllowed:false` | reutiliza `userAccess` de la rama de pedidos |
| HTML | CSP dentro del `srcdoc` (barrera principal) + `sanitize-html` + `iframe sandbox` sin scripts | XSS y rastreo (RT#3) |
| Adjuntos | siempre descarga `application/octet-stream`; nunca abrir blob en pestaña; vista previa solo PDF/imagen | RT#1 |
| Robustez IMAP | `on('error')`, 2 conexiones/tenant, tope 25 s, breaker 3 fallos/3 min, `retry:false` en front | RT#2, #5, #6 |
| Auditoría | `AuditService.log(userId, tenantId, …)`, nuevo `EntityType.MAIL_MESSAGE`; asunto y remitente recortados a 80; pestaña «Accesos» solo gerencia | RT#8 modificado en validación |
| Menú | grupo de Empleados; nuevo `hiddenForRoles:['SUPERADMIN']` en nav-config | validación |
| BD | **sin migración** | todo cabe en `Configuration` y `AuditLog` |
| Leído | **No se marca leído en Hostinger**: buzón abierto en modo `readOnly` (EXAMINE) | decisión usuario 2026-11-01 |
| Gerencia | ADMIN/OWNER lo ven siempre (bypass); **SUPERADMIN nunca** (403) | decisión usuario 2026-11-01 |
| Cuentas compartidas | según su rol (sin `personalAccountOnly`) | decisión usuario 2026-11-01 |
| Alcance | ~~Solo lectura~~ → **leer y enviar** (nuevo/responder/responder a todos/reenviar) | cambio usuario 2026-11-01 23:00 |
| Envío: servidor | SMTP de Hostinger (`smtp.hostinger.com:465`, TLS) con las mismas credenciales del IMAP | decisión usuario |
| Envío: permiso | sección `correo.enviar` `perUserOnly` aparte de `correo`; gerencia siempre | decisión usuario |
| Envío: adjuntos/copia | subida ≤10 MB; copia del mismo MIME en «Enviados» vía IMAP APPEND; cada envío en «Accesos» | decisión usuario |
| CID inline | `data:` URI en el HTML saneado (solo png/jpeg/gif/webp, ≤5 MB) | la API solo acepta Bearer: un `<img>` del iframe no puede autenticarse |
| sanitize-html | fijado a 2.17.0 | 2.18 usa htmlparser2 ESM-only → rompe en Node 20 (prod) y jest |

## Fases
| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend config y conexion IMAP](./phase-01-backend-config-y-conexion-imap.md) | Done (código + tests; falta prueba real) |
| 2 | [API de lectura de correo](./phase-02-api-de-lectura-de-correo.md) | Done (código + tests; falta prueba real) |
| 3 | [Modulo y permiso por persona](./phase-03-modulo-y-permiso-por-persona.md) | Done (código + tests; falta prueba real) |
| 4 | [Frontend bandeja de correo](./phase-04-frontend-bandeja-de-correo.md) | Done (código + tests; falta prueba real) |
| 5 | [Pruebas y puesta en prod](./phase-05-pruebas-y-puesta-en-prod.md) | Pending |
| 6 | [Envío de correo](./phase-06-envio-de-correo.md) | Done (código + tests; falta prueba real) |

Orden: 1 → 2 → 3 → 4 → 6 → 5 (3 puede ir en paralelo a 2). Estimación: 4–4,5 días (incluye pestaña Accesos). Un solo PR desde `feat/correo-restaurante`.

## Dependencias
- **Bloqueante:** rama `feat/permiso-pedidos-por-persona` (PR #496, **ya mergeada en develop** como `9524e91`) aporta `perUserOnly`, `userAccess.*`, `getUserAccess/updateUserAccess` y la casilla en `user-modal.tsx`. Resuelto.
- Nuevas deps backend: `imapflow`, `mailparser`, `sanitize-html` (+ `@types/*`). Instalar con **bun**.

## Criterios de aceptación
- [ ] ADMIN configura credenciales en Ajustes y "Probar conexión" da OK/error claro.
- [ ] ADMIN ve carpetas, lista y detalle de restaurante@warynessy.com.
- [ ] USER sin permiso: no ve el menú y la API devuelve 403.
- [ ] USER con la casilla marcada: lo ve; al desmarcarla deja de verlo.
- [ ] Módulo desactivado → nadie lo ve (ni ADMIN), API 403.
- [ ] SUPERADMIN → API 403 siempre.
- [ ] Adjuntos HTML/SVG nunca se ejecutan; nombres con ñ/tildes se descargan bien.
- [ ] Un corte de red con Hostinger no reinicia el backend.
- [ ] Ningún script de un correo se ejecuta; ningún recurso remoto (img, fondos CSS, `background=`) carga hasta pulsar "Mostrar imágenes".
- [ ] La contraseña nunca aparece en respuestas de la API ni en logs.
- [ ] Cada apertura de mensaje queda en `audit_logs` y se ve en la pestaña «Accesos» (solo gerencia).
- [ ] Quien tiene «Puede enviar correo» (o gerencia) redacta, responde, responde a todos y reenvía; quien solo lee no ve los botones y la API da 403.
- [ ] La respuesta llega en el mismo hilo en Outlook (In-Reply-To/References) y la copia aparece en «Enviados» de Hostinger.
- [ ] Adjuntos >10 MB rechazados con mensaje claro; cada envío queda en «Accesos».

## Preguntas abiertas
1. ¿Borrar/archivar desde la app? (v1: no)
2. ¿Contador de no leídos en el menú? (v1: solo dentro de la página)

Resueltas 2026-11-01: solo lectura · no marcar leído · todos los ADMIN/OWNER lo ven · SUPERADMIN nunca · cuentas compartidas según rol.

## Red Team Review

### Session — 2026-11-01
**Findings:** 15 (14 aceptados, 1 rechazado) · revisados uno a uno con el usuario
**Severity breakdown:** 2 Critical, 7 High, 6 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Adjunto HTML/SVG ejecuta script en el origen de la app (blob) | Critical | Accept | Fase 2, 4, 5 |
| 2 | Sin `client.on('error')` → crash del backend | Critical | Accept | Fase 1 |
| 3 | Rastreo vía CSS/`background`/`srcset`; falta CSP en `srcdoc` | High | Accept | Fase 2, 4 |
| 4 | SUPERADMIN sin tenant → config de cualquier tenant; salta módulo off | High | Accept (modificado: SUPERADMIN nunca) | Fase 1, 3, 5 |
| 5 | Mutex estricto sin tope ni cancelación | High | Accept | Fase 1, 2 |
| 6 | Reintentos multiplican LOGIN → bloqueo IP Hostinger | High | Accept | Fase 1, 4 |
| 7 | Límite 15 MB no aplicado; adjunto re-parsea todo | High | Accept | Fase 2 |
| 8 | Firma/enum de AuditService erróneos; asunto en auditoría | High | Accept (asunto recortado reintroducido en validación) | Fase 2 |
| 9 | Menú/ruta en `nav-config.ts`; `useSectionAccess` sin args | High | Accept | Fase 3, 4 |
| 10 | Cuentas compartidas ven el buzón | Medium | Reject (decisión usuario: según rol) | — |
| 11 | Host/puerto libres: texto plano + sondeo interno | Medium | Accept | Fase 1 |
| 12 | Ancla `#correo` de Ajustes ya usada por SMTP | Medium | Accept | Fase 4 |
| 13 | Casilla solo USER y no se guarda al crear | Medium | Accept | Fase 3 |
| 14 | Nombres de adjunto no ASCII → 500 | Medium | Accept | Fase 2 |
| 15 | Paginación por página duplica/salta; sin UIDVALIDITY | Medium | Accept | Fase 2, 4 |

### Whole-Plan Consistency Sweep
- Barrido de términos antiguos: `messageFlagsAdd`, `page=`, `SUPERADMIN siempre`, `layout.tsx` como sitio del menú, `useSectionAccess('correo')`, `details:{subject}`, `mutex` estricto, `attachments/:idx` → sustituidos en todas las fases.
- Ruta de adjuntos unificada: `/correo/messages/:uid/parts/:part` (fase 2) usada en fase 4.
- Matriz de permisos de fase 5 alineada con decisiones (SUPERADMIN 403, compartidas según rol).
- Contradicciones sin resolver: ninguna.

## Validation Log

### Session 1 — 2026-11-01
Verificación: Red Team ya verificó con evidencia; comprobados además `AuditAction.VIEW` (audit.service.ts:13), `ModulesService.isModuleEnabled` (modules.service.ts:126, exportado), `smtp-config-section.tsx`, `nav-config.ts`, cabecera `filename*` (documents.controller.ts:50). Claims: 6 · Verified: 6 · Failed: 0. Gap: no existía forma de ocultar un item de menú por rol → pregunta.

| # | Pregunta | Respuesta | Propagado a |
|---|---|---|---|
| 1 | Carpetas visibles | Todas | Fase 2 |
| 2 | Ubicación en menú | Grupo de Empleados/gestión | Fase 3 |
| 3 | SUPERADMIN en el menú | Nuevo `hiddenForRoles` en nav-config | Fase 3 |
| 4 | Registro de accesos visible | Sí, pestaña «Accesos» solo gerencia | Fases 2, 4, 5 |
| 5 | Qué guardar en el registro | Asunto y remitente recortados a 80 (modifica RT#8) | Fase 2, plan.md |
| 6 | Buzón de pruebas | El real; correos `[PRUEBA CHEFCHEK]` borrados después | Fase 5 |
| 7 | Ramas y PR | `feat/correo-restaurante`, un solo PR | plan.md |

### Whole-Plan Consistency Sweep
- Barrido de «sin asunto», «buzón de pruebas», «ocultar para SUPERADMIN», estimación 3–4 días → actualizados.
- Contradicciones sin resolver: ninguna.

## Progreso — 2026-11-01
- Fases 1-4 y 6 implementadas en `feat/correo-restaurante` (sin commit). Backend 2797 tests verdes, tsc/lint/next build OK.
- Revisión de código: [code-reviewer-261101-2330-buzon-correo-leer-enviar-report.md](../reports/code-reviewer-261101-2330-buzon-correo-leer-enviar-report.md). Aplicados H1 (timeout de envío 180 s + aviso «puede que se haya enviado»), H2 (nombres UTF-8 de multer), M1 (breaker re-comprobado tras la cola), M2 (tope tras login no abre el breaker), M3 (alta con permisos fallidos avisa sin dar el alta por fallida).
- Pendiente (LOW, aceptados por ahora): cancelar petición de detalle al cambiar de correo; índice `audit_logs(tenantId, entityType, createdAt)` (requiere migración); rangos IP reservados extra; CCO no visible en copia de Enviados; imágenes inline al reenviar.
- Fase 5 pendiente: prueba con buzón real, matriz de permisos en navegador, PR.
