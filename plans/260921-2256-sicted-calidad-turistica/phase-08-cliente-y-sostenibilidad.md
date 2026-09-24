---
phase: 8
title: "Cliente y sostenibilidad"
status: pending
priority: P2
effort: "M"
dependencies: [2]
---

# Phase 8: Cliente y sostenibilidad

## Overview

Bloque "Cliente y Sostenibilidad": módulo `CLI` (quejas/sugerencias/satisfacción — `CLI.2/3/4/5/6`), práctica `Ins-Bas.17` **objetos perdidos** (el usuario la agrupa con Clientes, aunque el manual la sitúa en Instalaciones), y `Med-Amb` (sostenibilidad ambiental: residuos, proveedores locales, eficiencia).

## Requirements

- Funcional: alta de queja/sugerencia/felicitación con canal y fecha, custodiada **mínimo 1 año** (`CLI.3`); respuesta y cierre con fechas; acción de mejora asociada; muestras de satisfacción (1–5) con resumen mensual, en varios idiomas si aplica (`CLI.4`); **objetos perdidos**: alta con fecha, características, devuelto sí/no (`Ins-Bas.17`); sostenibilidad como plantillas del motor de fase 2 (`kind: SUSTAINABILITY`).
- No funcional: datos del cliente **opcionales** y mínimos (RGPD); hitos write-once.

## Architecture

```
SictedFeedback          id, tenantId, kind(QUEJA|SUGERENCIA|FELICITACION), channel(SALA|WEB|EMAIL|TELEFONO|OTRO),
                        receivedAt, receivedByName, summary, customerContact?, status(OPEN|RESPONDED|CLOSED),
                        response?, respondedAt?, respondedByName?, closedAt?, improvementActionId?
SictedSatisfactionSample id, tenantId, sampledAt, score(1..5), channel, comment?, recordedByName   -- SOLO INSERT
SictedLostItem           id, tenantId, foundAt, itemName, description?, foundLocation?, foundByName,
                         returnedAt?, returnedTo?                                       -- SOLO INSERT (returnedAt: solo null→valor)
```

Campos confirmados 2026-09-24 contra `Registro_de_objetos_perdidos.docx` (real, con datos de ejemplo: fecha, objeto encontrado, descripción, lugar en que se ha encontrado, fecha devolución, persona a la que se devuelve): más simple que el diseño anterior — sin enum `status`, "devuelto" se deriva de `returnedAt IS NOT NULL`, y no existe la opción "descartado" en el uso real (se quitó `DISPOSED`).

`SictedFeedback` avanza por hitos con trigger "solo null→valor" (`respondedAt`, `closedAt`). Objetivo de nivel de servicio configurable (p. ej. responder en ≤72 h) → alerta si se supera.

Sostenibilidad: sin tablas nuevas; plantillas de ejemplo (residuos y reciclaje, ahorro de agua/energía, producto local) sobre el motor. **Km 0: checklist manual, confirmado** — no se toca `Supplier` ni se añade `isLocal`; queda fuera de alcance de este plan.

**Sin formulario público por QR** (confirmado): solo captura interna por el personal. No se construye `etiquetado-public.controller.ts`-style endpoint ni antispam/RGPD de formulario público en esta fase.

## Related Code Files

- Create: modelos+migración+triggers; `backend/src/modules/sicted/services/{sicted-feedback,sicted-satisfaction}.service.ts`; controladores/DTOs.
- Create (front): `frontend/src/app/dashboard/sicted/clientes/page.tsx` (pestañas Quejas y sugerencias / Satisfacción / Objetos perdidos); alta rápida desde móvil.

## Implementation Steps

1. Modelos + triggers + migración.
2. Servicios y endpoints (USER registra; ADMIN/OWNER responde/cierra).
3. UI de bandeja con filtros por estado y antigüedad; enlace a "crear acción de mejora" (fase 9; hasta entonces campo libre).
4. Resumen mensual de satisfacción (media, nº muestras, tendencia) y alerta de queja sin responder.
5. Objetos perdidos: alta rápida (foto opcional vía adjunto de fase 4), marcar devuelto; retención igual que quejas.
6. Plantillas de sostenibilidad de ejemplo en el endpoint idempotente de fase 2.
7. Incluir en pack de auditoría: libro de quejas con tiempos de respuesta, resumen de satisfacción, registro de objetos perdidos.

## Tests

- Hitos no reescribibles; tiempo de respuesta calculado; alerta al superar el umbral.
- Formulario público (si se hace): rate-limit, validación, sin fuga de datos entre tenants.
- Aislamiento tenant.

## Success Criteria

- [ ] Toda queja tiene fecha de recepción, respuesta y cierre trazables.
- [ ] Media de satisfacción mensual visible y exportable.
- [ ] Plantillas de sostenibilidad usables desde "Hoy" sin código nuevo.

## Risk Assessment

- *RGPD en quejas*: contacto opcional, cifrado en tránsito, minimizar texto libre con datos de terceros.
- *Spam en QR público*: por eso queda opcional y detrás de antispam.
- *Km 0 sin dato fiable*: no inventar porcentajes; mostrar solo lo medible.
