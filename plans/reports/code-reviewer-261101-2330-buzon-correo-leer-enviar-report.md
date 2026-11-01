# Code review — Buzón correo restaurante (leer + enviar)

Rama `feat/correo-restaurante`, cambios sin commit. Fecha 2026-11-01.

## Verificación ejecutada
- Backend `npx tsc --noEmit` OK · Frontend `npx tsc --noEmit` OK
- `npx jest src/modules/correo src/modules/role-access` → 7 suites, 108 tests OK
- ESLint: 0 errores (backend 42 warnings `no-explicit-any`, en línea con el repo); frontend limpio
- Node 20 real (`docker node:20-alpine`): `require` de imapflow, mailparser, sanitize-html, mail-composer OK + `simpleParser`→`sanitizeHtml` OK. (Local es Node 24 con require(esm): pasar en local no lo probaba.)
- `sanitize-html@2.17.0` usa `htmlparser2@8` anidado (bun.lock:2206); el `htmlparser2@12` ESM de nivel superior solo lo trae `@types/sanitize-html` (dev). OK.

## HIGH

### H1 — Envío: timeout de 30 s en el front → riesgo de correo duplicado (criterio f)
`frontend/src/lib/api-client.ts:8` (`timeout: 30000`) aplica a `frontend/src/features/correo/hooks/use-correo.ts:224`.
El backend encadena: leer original (cola ≤25 s + op ≤25 s) → SMTP (connect 10 + greeting 10 + socket 30 s) → copia en Enviados (cola + 25 s). Y el timeout de axios incluye la subida: 10 MB por 4G a ~3 Mbps ≈ 27 s.
Escenario: reenvío con adjuntos, la subida acaba a los 25 s, SMTP tarda 8 s → axios aborta a los 30 s («timeout of 30000ms exceeded»), el backend sigue y ENVÍA. El usuario ve «No se envió» y pulsa Enviar otra vez → duplicado al proveedor/cliente.
Fix: en `useSendMail` pasar `timeout: 180_000` (con `noRetry`), y si `error.code === 'ECONNABORTED'` o no hay `response`, mostrar «Puede que se haya enviado: revisa Enviados antes de repetir» en vez de «No se envió». Para las lecturas: o bien `timeout` ≥ 60 s en `get()` de correo, o bajar la espera en cola para que cola+operación < 30 s (ahora el cliente puede abandonar mientras el backend sigue haciendo login).

### H2 — Adjuntos subidos con ñ/tildes llegan con el nombre roto (mojibake)
`backend/src/modules/correo/correo-send.service.ts:150` usa `f.originalname` tal cual. multer 2.x decodifica el nombre como latin1 por defecto (`node_modules/multer/index.js:22`, `defParamCharset || 'latin1'`) y los navegadores lo envían en UTF-8.
Escenario: adjuntar «Menú otoño.pdf» → el destinatario recibe «MenÃº otoÃ±o.pdf» (y así queda en Enviados).
Precedente en el repo: `backend/src/modules/recipe-capture/recipe-capture.controller.ts:100-101`.
Fix: `filename: Buffer.from(f.originalname, "latin1").toString("utf8")` (o `FilesInterceptor("files", 10, { limits, defParamCharset: "utf8" })`). Añadir test.

## MEDIUM

### M1 — El breaker no frena a los que ya están en cola → hasta 8 logins fallidos seguidos (criterio c)
`backend/src/modules/correo/imap-client.service.ts:55-56`: `assertBreakerClosed` se mira ANTES de `acquire`. Con contraseña mala y 2 activos + 6 en cola, los 3 primeros fallos abren el breaker pero los waiters ya encolados siguen haciendo login al recibir hueco → 8 logins con credenciales malas en segundos (varios usuarios/pestañas, o «Actualizar» + abrir correos). Además, al expirar los 3 min `fails` vuelve a 0 y se permiten otros 3+ intentos concurrentes (no hay half-open de 1 sonda).
Fix: volver a llamar `assertBreakerClosed(tenantId)` tras `acquire` (dentro del `try`, para liberar el hueco), y en `recordFailure` mantener un estado half-open: tras expirar, el primer fallo reabre directamente.

### M2 — Un timeout con la sesión ya abierta cuenta para el breaker
`imap-error-mapper.ts:45` + `imap-client.service.ts:128`: `ImapOperationTimeoutError` siempre es `isConnectionFailure`, aunque `connected === true` (login OK, solo fue lenta la búsqueda/descarga). Tres operaciones lentas (INBOX enorme con `search all`, adjunto grande) bloquean el buzón 3 min a todo el tenant sin que haya riesgo de bloqueo de IP.
Fix: en el `catch` de `run`, contar timeout como fallo solo si `!connected`.

### M3 — Alta de usuario: si falla guardar el permiso, el usuario ya está creado pero se muestra error
`frontend/src/app/dashboard/users/components/user-modal.tsx` (rama crear, ~l.220-229): `createMutation` OK → `updateUserAccess` falla → cae al `catch` general («Error al guardar usuario»), el modal sigue abierto; al reintentar, el alta falla por email duplicado y el permiso nunca se guarda.
Fix: envolver el `updateUserAccess` del alta en su propio try/catch: notificar «Usuario creado, pero no se pudieron guardar los permisos: edítalo» y cerrar (`onSaved`).

## LOW

- **L1** Cada clic en un correo = 1 login IMAP y no se cancela al cambiar (queryFn no usa `signal`): recorrer 10 correos rápido da 503 «Buzón ocupado» y deja entradas «Abrió» en Accesos de correos que solo se saltaron. `use-correo.ts:142-149`. Fix opcional: pasar `signal` a axios (el backend igual termina, pero libera el front) o debounce de selección ~300 ms.
- **L2** 403 de módulo apagado (`correo-access.guard.ts:37`) no empieza por `"Module '"`, así que `api-client.ts` no emite `chefchek:module-disabled` → el menú no se refresca hasta recargar. Fix: mensaje con el prefijo o emitir `SECTION_HIDDEN`.
- **L3** Textos obsoletos tras añadir el envío: «solo lectura» en `modules/constants/registry.ts:269`, `section-registry.ts` (comentario de `correo`), `nav-config.ts:127`.
- **L4** multer bufferiza hasta 10 ficheros × 10 MB = 100 MB en RAM antes de que el servicio rechace >10 MB total (`correo.controller.ts:245`, `correo-send.service.ts:100`). Solo usuarios con `correo.enviar`; aceptable, o limitar `files`/`fileSize` más bajo.
- **L5** SSRF: faltan rangos reservados (198.18.0.0/15, 192.0.0.0/24, 64:ff9b::/96, 2002::/16) y el puerto IMAP es libre 1-65535 (`imap-host-validator.ts:13-25`, `dto/imap-config.dto.ts:28-32`). Solo lo configura ADMIN y se conecta por TLS verificado al nombre → riesgo bajo; sugerido `@IsIn([993])` para IMAP.
- **L6** La copia en Enviados no lleva la cabecera Bcc (MimeNode la quita por defecto, `nodemailer/lib/mime-node/index.js:582`): en Enviados no se ve a quién se puso en CCO. Informativo; si importa, compilar la copia con `keepBcc: true`.
- **L7** Reenvío: imágenes inline con `cid` se excluyen de los adjuntos (`correo-mailbox.service.ts:487-489`) y el saneado quita su `src` → se pierden en el HTML reenviado. Cosmético.
- **L8** `audit_logs` sin índice `(tenantId, entityType, createdAt)` para Accesos; hoy usa `tenantId`. Vigilar cuando crezca.

## No-issues verificados
- (a) `correo.enviar`: `SectionAccessGuard` combina clase AND handler → enviar exige `correo` + `correo.enviar` (`guards/section-access.guard.ts:19-26`). SUPERADMIN → 403 en `CorreoAccessGuard` antes de Roles/Section; módulo apagado → 403 para todos (incl. ADMIN). Per-user grant se aplica tras puesto y respeta módulo (`role-access.service.ts:120-135`). USER_CUINER pasa `@Roles("VIEWER")` (nivel 2). Menú: `hiddenForRoles` + redirect por ruta; sección por fallback de módulo en `sectionForPath`.
- (b) Saneado (sin script/style/svg/iframe, style filtrado, remotas → `data-blocked-src`), iframe `sandbox` sin `allow-scripts`/`allow-same-origin`, CSP `default-src 'none'`. `revealImages` usa DOMParser (documento inerte) y solo https. Adjuntos: `application/octet-stream` + `nosniff` + `CSP: sandbox` + `Content-Disposition` RFC 5987; front descarga por blob octet-stream con `<a download>`; vista previa solo raster.
- (c) `on('error')` antes de connect, `work.catch`, timeout corta socket, `logoutQuietly` con gracia; react-query `retry:false` y `noRetry` en todas las llamadas de correo. `noRetry` solo añade una condición al interceptor: sin regresión.
- (d) `getPublic` sin contraseña; cifrado con salt propio; `GlobalExceptionFilter` no registra body; imapflow `logger:false`; logs SMTP/IMAP solo código/respuesta del servidor.
- (e) `AuditService.log` traga errores → un fallo de auditoría nunca convierte un envío hecho en error; fallo de copia en Enviados capturado → `savedToSent:false` + aviso «No lo vuelvas a enviar». Accesos solo `@Roles("ADMIN")` (OWNER pasa, SUPERADMIN bloqueado).
- (f) In-Reply-To/References deduplicadas; reenvío incluye adjuntos originales; ≤10 MB front y back; orden leer→enviar→copiar sin reintentos.
- (g) `compras-pedidos`: mismo gating (módulo `compras`, rol USER, gerencia); `getUserAccess` deriva de `PER_USER_SECTION_KEYS`; tests de role-access en verde.
- DTO multipart: `ValidationPipe({ transform: true })` → `@Type(() => Number)` en `refUid` funciona.

## Resumen
Diseño sólido y defensivo en seguridad (XSS, SSRF, contraseña, SUPERADMIN). Dos defectos reales antes de producción: timeout de 30 s del front en el envío (duplicados) y nombres de adjuntos UTF-8 rotos por multer. El breaker deja pasar la cola ya encolada.

## Preguntas abiertas
- ¿Producción corre una sola réplica del backend? Semáforo y breaker son en memoria por proceso; con N réplicas el tope real es N×.
