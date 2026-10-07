---
phase: 3
title: "PWA y fichaje sin conexion"
status: pending
priority: P1
effort: "20-24h"
dependencies: [2]
---

# Phase 3: PWA y fichaje sin conexión

## Overview

Convierte el frontend en PWA instalable y permite fichar sin red: cola local, sincronización idempotente y validación diferida del PIN en kiosco (la sesión personal no usa PIN). Es la parte con más incertidumbre técnica del plan; empezar con una prueba corta en iPhone y Android reales.

## Requirements

- Funcional: instalar la app; abrir `/fichar` y "Mi espacio → Fichar" sin red; fichar y ver "pendiente de enviar"; sincronizar al volver la red o abrir la app.
- No funcional: ningún fichaje se pierde ni se duplica; ni PIN ni hashes almacenados en el dispositivo; el service worker no cachea respuestas de API con datos de otros módulos.

## Architecture

- `manifest.webmanifest` + iconos; `display: standalone`.
- Service worker propio y pequeño: precache del shell de las rutas de fichaje; el resto de la app sigue network-first sin cache. Estrategia de actualización explícita (aviso "nueva versión").
- Cola en IndexedDB (`idb`): `{id, employeeId, type, occurredAt, coords, encryptedPin, attempts}`.
- PIN offline (solo kiosco): cifrado con clave pública del tenant/servidor (WebCrypto RSA-OAEP), descargada y cacheada estando online. El servidor descifra y verifica al sincronizar; incorrecto → `pinStatus = PENDING_REVIEW`.
- `POST /check-in/punches/sync`: lote ordenado por `occurredAt`; respuesta por elemento (`ACCEPTED|DUPLICATE|FLAGGED|REJECTED`); la validación de secuencia en lote marca incidencia en lugar de rechazar.
- Desfase de reloj: `receivedAt - occurredAt`; si el desfase no cuadra con el tiempo offline declarado → revisión.
- Sesión offline: la pantalla usa los datos mínimos cacheados (empleado propio o lista del kiosco); si la sesión caducó, los fichajes se guardan y se envían tras volver a iniciar sesión.
- Sincronización: evento `online`, apertura de la app y Background Sync donde exista. `navigator.storage.persist()`.

## Related Code Files

- Create: `frontend/public/manifest.webmanifest`, iconos, `frontend/public/sw.js` (o generado)
- Create: `frontend/src/features/check-in/offline/` (`punch-queue.ts`, `sync-engine.ts`, `pin-encryption.ts`, `use-online-status.ts`, `register-service-worker.ts`)
- Modify: `frontend/src/app/layout.tsx` (manifest, registro del SW), componentes de fichaje de la Fase 2
- Create: `backend/src/modules/check-in/services/punch-sync.service.ts`, `services/pin-key.service.ts`, `dto/sync-punches.dto.ts` + specs
- Modify: `backend/src/modules/check-in/punches.controller.ts`

## Implementation Steps

1. Prueba de concepto (≤3 h): SW + IndexedDB + geolocalización offline en iOS Safari instalado y Android Chrome. Si falla algo esencial, parar y replantear antes de seguir.
2. Manifest, iconos y registro del SW con ámbito acotado.
3. `punch-queue` y `sync-engine` con reintentos y backoff; tests unitarios.
4. `PinKeyService` (par de claves, rotación) + cifrado en cliente.
5. Endpoint de sync por lotes con resultados por elemento; tests de idempotencia y de orden.
6. UI: indicador de conexión, contador de pendientes, estado por fichaje, aviso si hay pendientes al cerrar sesión.
7. Lista de revisión para el encargado: fichajes `PENDING_REVIEW` y con desfase de reloj.
8. e2e con Playwright en modo offline: fichar, reconectar, verificar un único registro.
9. Prueba manual en dispositivos reales; documentar instalación en iOS/Android.

## Success Criteria

- [ ] App instalable en iOS, Android y escritorio
- [ ] Fichar en modo avión y ver el fichaje como pendiente
- [ ] Al reconectar se sincroniza una sola vez, con su hora original
- [ ] PIN incorrecto offline en kiosco → fichaje conservado y marcado para revisión
- [ ] Inspeccionando IndexedDB no aparece PIN ni hash en claro
- [ ] Una versión nueva del frontend se activa sin dejar a usuarios con build viejo

## Risk Assessment

- iOS sin Background Sync y con purga de almacenamiento → sincronizar al abrir, aviso persistente de pendientes.
- Service worker sirviendo build antiguo (problema ya sufrido con `next start`) → ámbito mínimo, versión en el SW, flujo de actualización probado.
- Reloj manipulado → doble marca temporal y revisión.
- Clave pública caducada offline → aceptar ventana de rotación solapada.
