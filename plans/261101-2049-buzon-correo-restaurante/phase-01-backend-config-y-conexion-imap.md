---
phase: 1
title: "Backend config y conexion IMAP"
status: done
priority: P1
dependencies: []
effort: "1 día"
---

# Phase 1: Backend config y conexión IMAP

## Overview
Módulo NestJS `correo`: credenciales IMAP cifradas por tenant y un cliente IMAP robusto (nunca tumba el proceso, nunca se queda colgado, no provoca bloqueos de Hostinger).

## Requirements
- Guardar host, puerto, usuario, contraseña (cifrada). Defaults: `imap.hostinger.com`, 993.
- **TLS siempre** (`secure: true`); nunca texto plano ni STARTTLS opcional. [RT#11]
- Host: rechazar `localhost`, IPs privadas/loopback/link-local y nombres que resuelvan a ellas (comprobar con `dns.lookup` antes de conectar). [RT#11]
- Nunca devolver la contraseña; solo `hasPassword`.
- "Probar conexión": al cliente solo `ok` o un mensaje genérico ("No se pudo conectar con el buzón: revisa usuario y contraseña"); el detalle (código imapflow) va al log. [RT#11]
- Concurrencia: máx. **2 conexiones simultáneas por tenant** (semáforo); cola máx. 6 → si se excede, 503 "Buzón ocupado, reinténtalo". [RT#5]
- Tope total por operación **25 s** (`Promise.race`); al vencer `client.close()` sin `logout`. `connectionTimeout`/`greetingTimeout` 10 s, `socketTimeout` 60 s. [RT#5]
- `client.on('error', …)` registrado **antes** de `connect()`: un error del socket nunca llega a `uncaughtException`. [RT#2]
- Circuit breaker por tenant: 3 fallos seguidos de conexión/autenticación → durante 3 min responder 503 sin tocar Hostinger. [RT#6]
- Todos los errores mapeados a 4xx/503 en español, nunca 500 genérico; incluido `decryptSecret` fallido (clave distinta tras clonar prod) → 400 "Vuelve a guardar la contraseña del buzón". [RT#6]
- Sin `tenantId` en la petición → 403. **SUPERADMIN → 403 siempre** (decisión usuario: nunca lee correo de clientes). [RT#4]

## Architecture
```
CorreoController ─► CorreoAccessGuard (tenantId obligatorio, rechaza SUPERADMIN,
                 │                     módulo 'correo' activo sin bypass)
                 ├► CorreoConfigService  (Configuration category MAIL_INBOX;
                 │                        encryptSecret/decryptSecret de encryption.util, salt "chefchek-imap")
                 └► ImapClientService.withClient(tenantId, fn)
                       semáforo(2) + cola(6) → breaker → connect(TLS) → race(fn, 25s) → logout | close
```
Claves `Configuration`: `imap.host`, `imap.port`, `imap.user`, `imap.pass` (cifrada).

```ts
const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false,
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 60_000 });
client.on('error', (e) => this.logger.warn(`IMAP ${tenantId}: ${e.code ?? e.message}`));
```

## Related Code Files
- Create: `backend/src/modules/correo/correo.module.ts`
- Create: `backend/src/modules/correo/correo-config.service.ts`
- Create: `backend/src/modules/correo/imap-client.service.ts` (semáforo, cola, tope, breaker)
- Create: `backend/src/modules/correo/correo-access.guard.ts`
- Create: `backend/src/modules/correo/imap-error-mapper.ts`
- Create: `backend/src/modules/correo/dto/imap-config.dto.ts`
- Create: `backend/src/modules/correo/imap-client.service.spec.ts`
- Modify: `backend/src/app.module.ts` (importar `CorreoModule`; no registrar controllers dos veces)
- Modify: `backend/package.json` (`bun add imapflow mailparser sanitize-html`, `bun add -d @types/mailparser @types/sanitize-html`)
- Reference: `backend/src/common/utils/encryption.util.ts:25,37` (usar estos helpers, **no** el cifrado privado de `mail.service.ts`), `backend/src/guards/module.guard.ts:51-54` y `tenant.guard.ts:15` (bypass de SUPERADMIN que el guard propio **no** debe heredar), `backend/src/modules/modules/modules.service.ts` (`isModuleEnabled`)

## Implementation Steps
1. `bun add` dependencias en `backend/`.
2. DTO: host `@IsString @IsFQDN`, port `@IsInt @Min(1) @Max(65535)`, user `@IsEmail`, pass `@IsOptional @IsString` (vacío = mantener).
3. `CorreoConfigService.getPublic/save/getSecret`; `getSecret` captura el fallo de descifrado → 400 claro.
4. `CorreoAccessGuard`: `if (!req.tenantId || req.user.role === 'SUPERADMIN') throw Forbidden`; `isModuleEnabled(tenantId,'correo')` sin bypass. Va **antes** de `SectionAccessGuard`.
5. `ImapClientService.withClient`: semáforo por tenant (contador + cola de resolvers, `finally` libera y borra entrada si vacía), breaker (`Map<tenantId,{fails,until}>`), validación de host (DNS → rango privado), `Promise.race` con tope.
6. `imap-error-mapper`: `authenticationFailed`→400, `ENOTFOUND/ECONNREFUSED/ETIMEOUT/ECONNRESET`/TLS→503, `NO`/"Too many connections"→503, resto→503 genérico.
7. Tests: (a) dos `withClient` simultáneos + tercero espera; (b) cola llena → 503; (c) `fn` que no resuelve → corta a 25 s y llama `close`; (d) el cliente mock emite `'error'` y el proceso sigue vivo; (e) 3 fallos → breaker abre; (f) host `127.0.0.1`/`10.x` rechazado; (g) SUPERADMIN y falta de tenant → 403.

## Success Criteria
- [ ] Guardar + probar con credenciales reales → ok.
- [ ] Contraseña errónea → 400 genérico; detalle solo en log.
- [ ] `GET /correo/config` no incluye `pass`.
- [ ] Los 7 tests en verde (`jest`, no `bun test`).
- [ ] Un corte de red durante una operación no reinicia el contenedor.

## Risk Assessment
- Clon de prod en local: la contraseña no descifra → mensaje claro, re-guardar.
- Dokploy con solapamiento de contenedores en deploy → semáforo en memoria no cubre ambos; aceptable (2+2 conexiones durante segundos).
- Límite real de conexiones de Hostinger desconocido (Outlook + móviles también conectan) → el breaker evita escaladas.
