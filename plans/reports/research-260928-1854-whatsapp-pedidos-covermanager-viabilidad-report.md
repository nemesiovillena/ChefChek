# Viabilidad WhatsApp (pedidos + atención cliente + CoverManager) — 2026-09-28

## Veredicto
Viable, pero en 3 bloques de dificultad muy distinta. whatsapp-agentkit NO es la pieza a integrar: sirve como referencia de diseño, no como código.

## Estado actual ChefChek
- Envío de pedido WHATSAPP ya existe = deep-link wa.me/whatsapp:// (manual): `backend/src/modules/compras/services/order-sending.service.ts:33-70`. Comentario explícito "sin API WhatsApp Business".
- Programación ya existe: `PurchaseSchedule` + cron cada 5 min `purchase-schedule.service.ts:378` → genera pedido + notificación, NO envía.
- Auditoría por canal ya prevista: `PurchaseOrderEvent.channel` (EMAIL/WHATSAPP/PHONE/WEB).
- `Supplier.whatsapp` ya guardado (supplier.dto, supplier-form).
- Asistente IA con tool-calling ya existe (`modules/ai-assistant`, Gemini, config por tenant) → reutilizable para bot de clientes.
- No hay modelo de reservas ni integración CoverManager.

## whatsapp-agentkit
- Python/FastAPI, Claude, Meta Cloud API oficial o Zernio (wrapper). SQLite/Postgres, Railway. MIT, 11 commits, ~500★.
- Plantilla para generar un bot conversacional "de FAQ". Acciones reales (reservas) hay que escribirlas en `agent/tools.py`.
- Otro stack (Python) y otro despliegue; duplicaría lo que ya tenemos en NestJS (asistente, multitenant, cron). Aporta: patrón adapter de proveedor, dedup por event id, verificación HMAC del webhook.

## Bloque 1 — Envío automático de pedidos a proveedores (fácil-medio)
- Meta Cloud API directa desde NestJS: POST /messages con plantilla "utility" aprobada (pedido fuera de ventana 24h ⇒ obligatorio plantilla). PDF como documento adjunto (header document).
- Enganche: en el cron de schedule, tras crear pedido → OrderSendingService.send(WHATSAPP) si el schedule tiene autoSend. Webhook de estados (sent/delivered/read) → PurchaseOrderEvent.
- Coste ES ≈ 0,017 €/plantilla utility. Irrelevante.
- Requisitos: Meta Business verificado, número dedicado (no puede estar a la vez en la app WhatsApp normal salvo coexistencia), plantilla aprobada.
- Riesgo: proveedor responde por WhatsApp → llega a nuestro webhook, no al móvil del cocinero. Hay que reenviar/mostrar respuestas o usar coexistencia (app Business + API en mismo número).

## Bloque 2 — Autorespuesta a clientes (medio)
- Webhook entrante + reutilizar asistente IA con tools propias (carta, alérgenos, horarios ya están en BD: digital-menu, allergens).
- Desde 1-oct-2026 Meta cobra también mensajes de servicio (1.000 gratis/mes/número, luego tarifa utility). Coste bajo.
- Política Meta: prohibidos bots IA "de propósito general" desde 15-ene-2026; bot centrado en el negocio está permitido. Necesario handoff a humano.
- RGPD: teléfono + conversación = datos personales; aviso, retención, borrado.

## Bloque 3 — Reserva automática en CoverManager (el cuello de botella)
- API existe (doc-api.covermanager.com, apikey), pero documentación confidencial y acceso vía acuerdo/partner con CoverManager. Hay terceros que ya lo hacen (mesaking, integradores) ⇒ técnicamente posible.
- Flujo: tool `check_availability` + `create_reservation` en el bot; confirmación explícita del cliente antes de reservar.
- Bloqueante: conseguir credenciales API del restaurante + permiso de CoverManager (posible coste). Sin eso, no hay nada que construir.
- Alternativa comercial: CoverManager ya ofrece/integra canales WhatsApp con partners — comparar coste vs construir.

## Recomendación
1. Bloque 1 primero (más ROI, pieza ya 80% hecha). 2. Pedir API a CoverManager en paralelo (trámite lento). 3. Bloque 2+3 juntos después, dentro de NestJS reutilizando ai-assistant. No adoptar agentkit como servicio.

## Preguntas abiertas
- ¿Número WhatsApp dedicado nuevo o el actual del restaurante (coexistencia)?
- ¿Pedidos programados se envían solos o requieren "aprobar" antes?
- ¿Contrato CoverManager actual incluye API? ¿Coste?
- ¿Proveedor intermedio (Zernio/360dialog/Twilio) o Meta directo?

Fuentes: github.com/Hainrixz/whatsapp-agentkit · doc-api.covermanager.com · developers.facebook.com/documentation/business-messaging/whatsapp/pricing · whautomate.com/whatsapp-business-api-pricing-spain · mesaking.com/integraciones/covermanager
