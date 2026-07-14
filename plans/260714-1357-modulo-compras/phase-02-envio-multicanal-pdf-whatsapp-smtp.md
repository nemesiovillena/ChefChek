---
phase: 2
title: "Envío multicanal: PDF de pedido, wa.me, SMTP por tenant, tel: y eventos de auditoría"
status: pending
---

## Context

- Canales ya modelados: `Supplier.orderMethods` (EMAIL/PHONE/WEB/WHATSAPP), `Supplier.whatsapp/email/phone` ([schema.prisma](../../backend/prisma/schema.prisma) ~L1069)
- Email actual = stub que solo loguea: [email.service.ts](../../backend/src/modules/core/email.service.ts) — NO reutilizable
- Generación PDF de referencia: módulo technical-sheets (botón "Ficha" de recetas)
- Config por tenant: tabla `Configuration` (key/value + category), patrón `costing-config`
- Decisión de producto: wa.me deep-link (sin API Meta), SMTP propio por tenant, tel: manual
- PDR §F3

## Requirements

1. PDF del pedido (`GET /v1/compras/pedidos/:id/pdf`): cabecera proveedor/local, líneas, totales, notas.
2. Nuevo módulo `mail` con nodemailer y config SMTP por tenant en `Configuration` (category `SMTP`: host, port, secure, user, pass **cifrado**, from). UI de configuración en settings.
3. `POST /v1/compras/pedidos/:id/enviar` con body `{ channel }`:
   - EMAIL: envía al `Supplier.email` con PDF adjunto; si SMTP acepta → estado ENVIADO; error → mensaje visible (nunca catch silencioso).
   - WHATSAPP: backend devuelve el texto del pedido formateado; frontend abre `wa.me/<E.164>?text=...`; usuario confirma "Marcar como enviado".
   - PHONE/WEB: registro manual → marcar ENVIADO con nota.
4. Todo envío/cambio de estado escribe `PurchaseOrderEvent` (userId, channel, timestamp, resultado); timeline visible en el detalle.

## Files to modify

- `backend/src/modules/mail/` (nuevo): `mail.module.ts`, `mail.service.ts` (+ spec), config cifrada (decidir aquí el mecanismo: AES con secret de entorno; documentar en el report)
- `backend/src/modules/compras/services/order-sending.service.ts` (+ spec): formateo mensaje WhatsApp/email, orquestación, eventos
- `backend/src/modules/compras/services/purchase-order-pdf.service.ts` (+ spec, patrón technical-sheets)
- `backend/src/modules/compras/compras.controller.ts` — endpoints enviar/pdf/eventos
- `backend/package.json` — `nodemailer`
- `frontend/src/app/dashboard/compras/components/send-order-dialog.tsx` — canales según `orderMethods`, preview del mensaje, flujo confirmación wa.me
- `frontend/src/app/dashboard/settings/page.tsx` — sección SMTP del tenant (test de conexión)
- `frontend/src/app/dashboard/compras/pedidos/[id]/` — timeline de eventos

## Steps

1. MailModule + cifrado del password en `Configuration`; endpoint `POST /v1/compras/smtp/test` (envía email de prueba); GET de config NUNCA devuelve el password.
2. PDF service reutilizando la infraestructura de PDF existente.
3. `order-sending.service`: plantilla de texto (nº pedido, líneas producto×cantidad, notas), normalización del teléfono a E.164 para wa.me, transición a ENVIADO + `PurchaseOrderEvent`.
4. Frontend: diálogo de envío (canales dinámicos), confirmación manual post-wa.me, timeline; errores SMTP en toast vía `useNotifications()`.
5. Build + relanzar dist; prueba real con un SMTP de test (Mailtrap o cuenta propia) y un número WhatsApp propio.

## Checking (criterios de aceptación)

- [ ] PDF abre en pestaña nueva con datos correctos del pedido
- [ ] Email real recibido con PDF adjunto (SMTP de prueba); fallo SMTP (credenciales malas) → toast con error y pedido NO pasa a ENVIADO
- [ ] wa.me abre WhatsApp con el mensaje pre-redactado y el número correcto del proveedor; confirmar → ENVIADO
- [ ] tel:/manual marca ENVIADO con nota
- [ ] Cada envío genera `PurchaseOrderEvent` visible en timeline (usuario, canal, fecha)
- [ ] Password SMTP cifrado en BD (verificar fila `Configuration`) y ausente en respuestas GET
- [ ] Solo se ofrecen los canales presentes en `Supplier.orderMethods`
- [ ] Specs de mail/sending/pdf pasan; sin errores TS
- [ ] Informe en `reports/sprint-2-checking-report.md`
