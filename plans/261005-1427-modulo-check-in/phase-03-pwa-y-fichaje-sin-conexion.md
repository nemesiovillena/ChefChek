---
phase: 3
title: PWA y fichaje sin conexion
status: completed
priority: P1
effort: 20-24h
dependencies:
  - 2
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

- [x] Fichar sin red desde la cuenta personal: queda en el dispositivo como "por enviar" (probado en navegador con el build de producción)
- [x] Al reconectar se envía una sola vez, con su hora original (`occurredAt` = hora del dispositivo, `receivedAt` posterior) — navegador + e2e
- [x] Kiosco sin red: el PIN viaja cifrado y el servidor lo valida al sincronizar (navegador + e2e)
- [x] En el dispositivo no queda el PIN ni un hash (comprobado inspeccionando localStorage)
- [x] PIN incorrecto, ausente o reutilizado sin conexión → fichaje conservado y marcado "a revisar" (e2e)
- [x] Secuencia imposible, reloj adelantado o fuera de zona con bloqueo → guardado y marcado, no perdido (e2e)
- [x] `/fichar` abre sin red tras una visita con conexión; la sesión no se cierra por falta de red (navegador)
- [x] Red "colgada": a los 8 s sin respuesta el fichaje pasa a la cola local (navegador)
- [ ] Instalación y uso en iPhone y Android reales (pendiente: solo probado en Chromium de escritorio)
- [ ] Actualización de versión con la app instalada (el service worker toma el control solo; sin probar en dispositivo)

## Risk Assessment

- iOS sin Background Sync y con purga de almacenamiento → sincronizar al abrir, aviso persistente de pendientes.
- Service worker sirviendo build antiguo (problema ya sufrido con `next start`) → ámbito mínimo, versión en el SW, flujo de actualización probado.
- Reloj manipulado → doble marca temporal y revisión.
- Clave pública caducada offline → aceptar ventana de rotación solapada.

## Desviaciones (2026-10-05)

- **Cola en localStorage, no IndexedDB**: la cola es diminuta, la escritura es síncrona y no hay sincronización en segundo plano que obligue a leerla desde el service worker. Sin dependencias nuevas (`idb`, `serwist`).
- **Sin Background Sync**: iOS no lo tiene. Se envía al abrir la pantalla, al volver la red y al volver a primer plano.
- **Solo `/fichar` funciona sin red**. Es la pantalla de fichaje única (personal o kiosco según la cuenta) y el `start_url` de la app instalada. El panel bajo `/dashboard` sigue necesitando red.
- **Service worker solo en producción**: en desarrollo los ficheros de Next no llevan huella y una caché los dejaría viejos.
- **Clave RSA por tenant en BD** (`check_in_kiosk_keys`), sin rotación: quien accede a la BD ya tiene los hashes de PIN, así que la clave privada no añade exposición relevante.
- **Cada fichaje pendiente lleva la cuenta que lo creó**: si otra persona inicia sesión en el mismo móvil, no envía fichajes ajenos como propios.
- **Validación de secuencia por orden temporal**, mirando el fichaje anterior y el siguiente (también dentro del mismo lote).
- **PIN incorrecto responde 403** (antes 401): el cliente HTTP reintenta los 401 y contaba dos fallos por intento.
- **Cambio fuera del módulo**: `auth.service.ts` ya no cierra la sesión cuando el servidor no responde; solo ante un rechazo real. Afecta a toda la app (antes un reinicio del backend desconectaba a todos).
- **Sin resolver**: la sesión dura 24 h y se renueva con el uso; un kiosco parado más de un día hay que volver a abrirlo. Alargar la sesión de las cuentas compartidas es una decisión de seguridad pendiente.
- La pantalla de "fichajes a revisar" solo lista; resolverlos llega con las correcciones de la Fase 4.
