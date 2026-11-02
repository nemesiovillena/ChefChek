---
phase: 6
title: "Envío de correo"
status: done
priority: P1
dependencies: [1, 2, 3]
effort: "1-1.5 días"
---

# Phase 6: Envío de correo

Cambio de alcance pedido por el usuario el 2026-11-01: «ChefChek tiene que ser una herramienta de trabajo», el buzón también envía.

## Requirements
- Modos: nuevo, responder, responder a todos, reenviar (con los adjuntos del original).
- SMTP Hostinger `smtp.hostinger.com:465` TLS, mismas credenciales que el IMAP (servidor/puerto editables en Ajustes; host público validado igual que IMAP).
- Permiso `correo.enviar` (`perUserOnly`, `defaultAllowed:false`, `moduleId:'correo'`): gerencia siempre; resto con casilla «Puede enviar correo del restaurante» en su ficha. El endpoint exige `correo` **y** `correo.enviar`.
- Adjuntos subidos ≤10 MB en total; mensaje final ≤20 MB.
- Respuesta: `In-Reply-To` + `References`, asunto `Re:`/`RV:` sin duplicar, texto citado.
- El mismo MIME que se envía se guarda en la carpeta `\Sent` (IMAP APPEND, flag `\Seen`). Si falla la copia, el envío cuenta como hecho y se avisa (nunca reintentar el envío → duplicados).
- SMTP fuera del tope de 25 s del IMAP (timeouts propios); fallo de login SMTP cuenta para el breaker.
- Auditoría `CREATE`/`MailMessage` con destinatarios y asunto recortados a 80; «Accesos» distingue «Abrió»/«Envió».

## Files
- Create: `backend/src/modules/correo/correo-send.service.ts`, `dto/send-mail.dto.ts`, `mail-reply-headers.ts` (+ spec)
- Modify: `correo-config.service.ts` (smtp host/port), `correo.controller.ts` (`POST /correo/send`, multipart), `section-registry.ts`, `correo-access-log.service.ts`
- Frontend: `features/correo/components/mail-compose-dialog.tsx`, botones en el lector, casilla en `user-modal.tsx`, campos SMTP en Ajustes.

## Risks
- Hostinger limita envíos/día por buzón → mensaje claro si responde 5xx de cuota.
- Doble clic en Enviar → botón deshabilitado mientras envía.
