# Fase 3 — Contraseña de Equipo en el kiosco

## Contexto
- `backend/src/modules/check-in/services/employee-pin.service.ts` (`verifyPin`, bloqueo hoy 5 intentos / 15 min ⇒ pasa a 3)
- `backend/src/modules/check-in/services/punch.service.ts` (L164-175 online, `verifyOfflinePin` L348)
- `backend/src/modules/check-in/services/kiosk-key.service.ts` (RSA-2048 OAEP-SHA256: máx. 190 bytes de texto)
- `backend/src/modules/check-in/dto/punch*.ts` (`pin` con `^\d{4,6}$`, `encryptedPin` ≤1024)
- `frontend/src/app/fichar/page.tsx` (teclado numérico con autoenvío)

## Requisitos
- Ficha con cuenta ⇒ el kiosco valida contra `User.passwordHash`. Ficha sin cuenta ⇒ PIN como hoy.
- Bloqueo por intentos igual para ambos, usando los contadores de la ficha (`pinFailedAttempts`, `pinLockedUntil`). No afecta al login.
- El listado del kiosco indica por persona `credentialType: "PASSWORD" | "PIN"`; con cuenta siempre puede fichar (ya no depende de `hasPin`).
- Offline: se cifra `<id fichaje>:<contraseña>`. Si no cabe en 190 bytes, el kiosco pide conexión para esa persona.
- Verificación reutilizable por otros módulos: un único punto `verifySignerCredential(tenantId, employeeId, secret)`.
- Nunca registrar ni devolver la contraseña; no guardarla en claro en el dispositivo.

## Ficheros
- Modificar: `employee-pin.service.ts` → renombrar a `signer-credential.service.ts` (verifica contraseña o PIN según la ficha; conserva `setPin/clearPin` para fichas sin cuenta) y exportarlo en `CheckInModule`.
- Modificar: `punch.service.ts`, DTO de fichaje (el campo sigue llamándose `pin`/`encryptedPin` para no romper la cola offline ya guardada en dispositivos; se relaja la validación a texto ≤128), listado de kiosco, `employees.service.ts` (rechazar `setPin` en fichas con cuenta).
- Modificar: `fichar/page.tsx` (con contraseña: teclado numérico por defecto + conmutador a teclado completo (`type="password"`, `autoComplete="off"`), sin autoenvío, botón Fichar; con PIN: como hoy), cifrado offline.
- Tests: `signer-credential.service.spec.ts`, `punch.service` (online/offline, bloqueo, ficha sin cuenta).

## Pasos
1. Servicio de credencial con las dos ramas y bloqueo común; tests primero.
2. DTO y `punch.service` online y offline.
3. Listado de kiosco con `credentialType`.
4. UI del kiosco por tipo de credencial; límite de bytes offline.
5. Quitar la sección «PIN de kiosco» de las fichas con cuenta; texto: «Ficha con su contraseña de Equipo».
6. Ayuda/Docs: actualizar el texto de Fichar que habla de PIN.

## Validación
- `bunx jest src/modules/check-in`
- Manual en local: `restaurante@warynessy.com` (compartida) abre kiosco; persona con cuenta ficha con su contraseña; persona sin cuenta con PIN; 3 fallos bloquean 15 min y el login sigue funcionando; modo avión ⇒ fichaje en cola y validado al sincronizar.

## Riesgos / rollback
- Fichajes offline en cola con PIN de fichas con cuenta, creados antes del despliegue: quedarán `PENDING_REVIEW` (revisión manual de gerencia, flujo ya existente). Avisar antes de desplegar.
- Exposición de la contraseña en dispositivo compartido: riesgo asumido (ver plan).
- Rollback: revertir el PR; los PIN antiguos siguen en BD y vuelven a valer.
