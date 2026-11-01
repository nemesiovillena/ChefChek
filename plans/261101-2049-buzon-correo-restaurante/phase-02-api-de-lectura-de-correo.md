---
phase: 2
title: "API de lectura de correo"
status: done
priority: P1
dependencies: [1]
effort: "1-1.5 días"
---

# Phase 2: API de lectura de correo

## Overview
Endpoints de solo lectura: carpetas, lista por cursor, detalle saneado y adjuntos por parte MIME. Todo por **UID + UIDVALIDITY**. Ningún endpoint modifica flags (no marca leído — decisión usuario); todos los locks `readOnly:true` (EXAMINE).

## Requirements
- Lista: 50 por página, más nuevos primero, **cursor `beforeUid`** (no número de página). Campos: uid, from, to, subject, date, seen, hasAttachments, size. Respuesta incluye `uidValidity`. [RT#15]
- Detalle y adjuntos exigen `uidValidity`; si no coincide con el actual → 409 "El buzón ha cambiado, recarga". [RT#15]
- Detalle: primero `fetchOne(uid,{size,bodyStructure,envelope})`; si `size > 15 MB` → solo cabeceras + aviso, sin descargar el cuerpo. [RT#7]
- Adjuntos identificados por **número de parte** de `bodyStructure` (p. ej. `2.1`), servidos con `client.download(uid, part, {uid:true})` en streaming, sin re-parsear el mensaje. [RT#7]
- Imágenes inline `cid:` → URL al endpoint de adjunto (no data URI dentro del JSON). [RT#7]
- Cabeceras de adjunto: `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<encodeURIComponent>`, `Content-Type: application/octet-stream` siempre, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`. [RT#1, RT#14]
- Auditoría: cada apertura de detalle y cada descarga de adjunto. [RT#8]
- Se muestran **todas** las carpetas del buzón (decisión validación).
- Registro de accesos consultable por gerencia: `GET /correo/access-log?cursor=` (pestaña «Accesos», fase 4). <!-- Updated: Validation Session 1 - pestaña Accesos -->
- Caché en memoria 30 s para carpetas (también se usa para validar `folder`) y para la primera página; `?fresh=1` (botón "Actualizar") la salta. [RT#5]

## Architecture
| Método | Ruta | Guardas |
|---|---|---|
| GET | `/api/v1/correo/folders` | CorreoAccessGuard + Section `correo` |
| GET | `/api/v1/correo/messages?folder=INBOX&beforeUid=&fresh=` | idem |
| GET | `/api/v1/correo/messages/:uid?folder=&uidValidity=` | idem + audit |
| GET | `/api/v1/correo/messages/:uid/parts/:part?folder=&uidValidity=` | idem + audit |
| GET | `/api/v1/correo/access-log?cursor=` | CorreoAccessGuard + `@Roles('ADMIN')` — lee `audit_logs` (`entityType=MailMessage`, tenant actual), 50 por página, con nombre del usuario |
| GET/PUT/POST | `/api/v1/correo/config[/test]` | CorreoAccessGuard + `@Roles('ADMIN')` (jerárquico: OWNER también) |

Paginación: `search({all:true},{uid:true})` → ordenar desc → filtrar `< beforeUid` → 50 → `fetch(uids,{uid,envelope,flags,bodyStructure,size},{uid:true})`.

Saneado (`sanitize-html`) — segunda barrera; la primera es la CSP del visor (fase 4): [RT#3]
- permitir formato y tablas; `style` inline con lista blanca de propiedades **y** eliminando cualquier valor que contenga `url(`, `expression(`, `@import`.
- eliminar `script`, `style` (bloques), `link`, `meta`, `iframe`, `object`, `embed`, `form`, `input`, `video`, `audio`, `picture`, `source`, `base`.
- eliminar atributos `on*`, `background`, `srcset`, `poster`, `formaction`; esquemas permitidos `http`, `https`, `mailto`, `cid`.
- `img[src]` remoto (`http:`, `https:`, `//`) → `data-blocked-src`; `cid:` → URL de parte.
- `a` → `target="_blank" rel="noopener noreferrer"`.

Auditoría (firma real `audit.service.ts:43`): [RT#8]
```ts
await this.audit.log(req.user.id, req.tenantId, {
  action: AuditAction.VIEW,            // comprobar que existe; si no, añadir
  entityType: EntityType.MAIL_MESSAGE, // añadir MAIL_MESSAGE = "MailMessage" al enum
  entityId: `${folder}:${uidValidity}:${uid}`,
  details: { messageId, part, subject: subject?.slice(0, 80), from: fromAddress?.slice(0, 80) }, // recortados; solo los ve gerencia (decisión validación)
  ipAddress: req.ip, userAgent: req.headers['user-agent'],
});
```
`log()` silencia errores (`audit.service.ts:57-60`): el test verifica la fila en BD.

## Related Code Files
- Create: `backend/src/modules/correo/correo.controller.ts`
- Create: `backend/src/modules/correo/correo-mailbox.service.ts`
- Create: `backend/src/modules/correo/mail-html-sanitizer.ts`
- Create: `backend/src/modules/correo/correo-mailbox.service.spec.ts`, `mail-html-sanitizer.spec.ts`
- Modify: `backend/src/common/services/audit.service.ts` (añadir `MAIL_MESSAGE` a `EntityType`; `VIEW` a `AuditAction` si falta)
- Modify: `backend/src/modules/correo/correo.module.ts` (importar `AuditModule`, `ModulesModule`)
- Reference: `backend/src/modules/rrhh/documents.controller.ts:50` (cabecera `filename*`), `backend/src/modules/compras/compras.controller.ts:101-102` (`@RequireSection`)

## Implementation Steps
1. `listFolders` (cacheado): `client.list()` → nombre, ruta, `specialUse` → etiquetas en español.
2. `listMessages(folder, beforeUid, fresh)` con lock `readOnly:true`; validar `folder` contra la caché de carpetas.
3. `getMessage(uid, uidValidity)`: comprobar `uidValidity` → `size` → si ≤15 MB `fetchOne(source)` → `simpleParser` → sanear → lista de adjuntos con `part`, `filename`, `contentType`, `size`, `inline`. Sin `messageFlagsAdd`.
4. `streamPart(uid, part, uidValidity)`: `client.download` → `StreamableFile` con las cabeceras de arriba.
5. Validar `uid` entero positivo y `part` con `/^\d+(\.\d+)*$/`.
6. Auditoría como arriba.
7. `getAccessLog(tenantId, cursor)`: `prisma.auditLog.findMany({ where:{ tenantId, entityType:'MailMessage' }, orderBy:{createdAt:'desc'}, take:50, include:{ user:{select:{name:true}} } })`.
8. Tests: sanitizer (script, onerror, javascript:, `<td background>`, `style=url()`, `srcset`, `<style>@import`, `<link>`, `img //host`, cid); paginación por cursor sin duplicados con UIDs nuevos entre páginas; 409 por uidValidity; >15 MB solo cabeceras; nombre "Albarán_peña.pdf" sin error; fila de `audit_logs` creada; no se envía ningún STORE.

## Success Criteria
- [ ] Buzón con >500 mensajes: primera página < 2 s (conexión ya resuelta) y "Cargar más" sin duplicados.
- [ ] Sanitizer pasa toda la batería.
- [ ] Adjunto con ñ/tildes se descarga con su nombre; HTML/SVG adjunto nunca se sirve con su tipo.
- [ ] Mensaje de 40 MB: no supera ~20 MB de memoria extra.
- [ ] `audit_logs` registra cada apertura (asunto y remitente recortados a 80).
- [ ] `GET /correo/access-log` devuelve 403 a quien no sea ADMIN/OWNER y solo filas del tenant actual.

## Risk Assessment
- Negrita "no leído" refleja solo lo leído en Outlook/móvil (decisión aceptada).
- Correos con codificaciones raras → `mailparser`; fallback a `text`.
- `audit_logs` cae en cascada si se borra el usuario (`schema.prisma:2755`) → aceptado (soft-delete de usuarios es lo habitual).
