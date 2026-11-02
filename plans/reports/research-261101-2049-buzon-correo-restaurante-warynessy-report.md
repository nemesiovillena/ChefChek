# Informe: ver el buzón restaurante@warynessy.com dentro de ChefChek

Fecha: 2026-11-01 20:49 (Europe/Madrid) · Rama base: `feat/permiso-pedidos-por-persona`

> **Actualizado 2026-11-01 tras revisión crítica:** el PDR (`plans/261101-2049-buzon-correo-restaurante/plan.md`) manda sobre este informe. Cambios: SUPERADMIN nunca ve el correo, no se marca leído, adjuntos solo descarga, CSP en el visor, paginación por cursor, endpoint de adjuntos por parte MIME.

## Resumen ejecutivo

- **Es viable y no es grande.** El buzón está alojado en **Hostinger** (MX `mx1/mx2.hostinger.com`, SPF `_spf.mail.hostinger.com`). Hostinger ofrece IMAP estándar: `imap.hostinger.com:993` SSL/TLS, usuario = dirección completa, contraseña del buzón.
- **Recomendación:** que el backend haga de **cliente IMAP de solo lectura** (proxy en vivo, sin copiar el correo a nuestra BD). El correo sigue viviendo en Hostinger; ChefChek solo lo muestra. Librería: `imapflow` + `mailparser` (mismo autor que `nodemailer`, que ya usamos).
- **Permisos: ya casi lo tenemos.** La rama actual añade permisos **por persona** (`userAccess.{userId}.{sección}`, `perUserOnly`). Una sección nueva `correo` con `perUserOnly: true, defaultAllowed: false` da exactamente "solo admin + a quien yo dé permiso": ADMIN/OWNER/SUPERADMIN lo ven siempre (`SECTION_BYPASS_ROLES`), el resto solo si se le marca en su ficha.
- **Riesgos principales:** (1) HTML de correos = vector XSS → sanear en servidor + iframe `sandbox` sin scripts; (2) píxeles de rastreo → imágenes remotas bloqueadas por defecto; (3) datos personales de clientes (reservas, facturas) → RGPD, registro de accesos; (4) dependencia de que la rama de permisos por persona se mergee antes.
- **Esfuerzo estimado:** v1 de solo lectura ≈ 3–4 días. Responder/enviar desde la app = fase 2 opcional (+1–2 días, reutiliza `MailService`/SMTP).

## Metodología

- Código revisado: `backend/src/modules/mail/mail.service.ts`, `common/utils/encryption.util.ts`, `role-access/*` (diff de la rama), `modules/constants/registry.ts`, `users/components/user-modal.tsx`.
- DNS: `dig MX/TXT warynessy.com`.
- Web: 2 búsquedas (config IMAP Hostinger, imapflow).

## Hallazgos

### 1. Dónde está el correo

| Dato | Valor |
|---|---|
| Proveedor | Hostinger Email |
| IMAP | `imap.hostinger.com` · 993 · SSL/TLS |
| SMTP | `smtp.hostinger.com` · 465 SSL (o 587 STARTTLS) |
| Login | `restaurante@warynessy.com` + contraseña del buzón |

Sin OAuth: Hostinger solo da usuario/contraseña. Si se cambia la contraseña en hPanel, hay que actualizarla en ChefChek (la app debe mostrar "credenciales incorrectas" claro, no un 500).

### 2. Lo que ya existe en ChefChek y se reutiliza

| Pieza | Dónde | Uso para el correo |
|---|---|---|
| Config por tenant cifrada AES-256-GCM | `Configuration` + `encryption.util.ts` (`CONFIG_ENCRYPTION_KEY`, salt por dominio) | guardar host/usuario/contraseña IMAP con salt `chefchek-imap` |
| Patrón de config SMTP (público vs secreto, `hasPassword`) | `mail.service.ts` | copiar el patrón para IMAP |
| Módulos por tenant | `MODULE_REGISTRY` + `@RequireModule` | módulo `correo`, `defaultEnabled: false` (solo Warynessy lo activa) |
| Secciones + permiso por persona | `section-registry.ts`, `role-access.service.ts` (rama actual) | sección `correo`, `perUserOnly` |
| Casilla por persona en ficha de usuario | `user-modal.tsx` (rama actual, "Puede hacer pedidos…") | segunda casilla "Puede ver el correo del restaurante" |
| nodemailer (SMTP) | `MailService` | fase 2: responder |

### 3. Opciones de arquitectura

| Opción | Cómo | Pros | Contras | Veredicto |
|---|---|---|---|---|
| **A. Proxy IMAP en vivo** | backend abre IMAP al pedir lista/mensaje | sin copia de datos, siempre actualizado, poco código, borrar en Hostinger = borrado aquí | cada vista = conexión IMAP (≈0,3–1 s); sin búsqueda propia potente | **Recomendada** |
| B. Sincronizar a nuestra BD | cron/IDLE copia mensajes a Postgres | rápido, búsqueda SQL, notificaciones | duplica datos personales (RGPD, backups, papelera), sincronización de flags/borrados, mucho más código | Descartada (YAGNI) |
| C. Webmail embebido (iframe de Hostinger) | iframe a webmail | cero código | Hostinger bloquea iframes (X-Frame-Options), login aparte, sin control de permisos real | No viable |
| D. Reenvío a otra dirección | regla en Hostinger | cero código | no está "en la app" | No cumple |

### 4. Seguridad (modelo de amenazas)

Lo que protegemos: contraseña del buzón + contenido de correos (clientes, proveedores, facturas, posibles datos bancarios).

1. **Contraseña**: cifrada en BD, nunca vuelve al frontend (solo `hasPassword`). Solo ADMIN/OWNER la editan.
2. **XSS por HTML de correo**: sanear en servidor (`sanitize-html`, quitar `script`, `on*`, `javascript:`, `form`, `iframe`) **y** pintar dentro de `<iframe sandbox srcdoc>` sin `allow-scripts` ni `allow-same-origin`. Doble barrera.
3. **Rastreo/privacidad**: sustituir `src` remotos de `<img>` por marcador; botón "Mostrar imágenes" por mensaje. Imágenes inline (`cid:`) se sirven como data URI.
4. **Adjuntos**: descarga por endpoint autenticado con `Content-Disposition: attachment` y tipo forzado; nunca abrir HTML/SVG adjunto inline.
5. **Autorización**: cada endpoint con `@RequireModule('correo')` + `@RequireSection('correo')`. El check va en backend, el front solo oculta.
6. **Auditoría**: registrar `quién abrió qué mensaje (uid, asunto) y cuándo`. Recomendado por RGPD y porque es un buzón compartido.
7. **Abuso de conexión**: Hostinger limita conexiones simultáneas por buzón; mutex por tenant + timeout 15 s + caché corta de la lista (30 s).

### 5. Rendimiento

- Lista: `fetch` de sobres (`envelope`, `flags`, `bodyStructure` mínimo) por rango de UID descendente, 50 por página → una ida y vuelta IMAP.
- Detalle: `fetchOne(uid, { source: true })` + `mailparser.simpleParser`. Límite de tamaño (p. ej. 15 MB) para no tumbar memoria.
- Sin IDLE ni conexión permanente en v1 (KISS). Botón "Actualizar" + refresco al volver a la pestaña.

## Recomendación de implementación (resumen)

```
Front /dashboard/correo ──► GET /api/v1/correo/*  (JWT + @RequireModule + @RequireSection('correo'))
                                  │
                         CorreoService (mutex por tenant)
                                  │ imapflow (TLS 993)
                                  ▼
                         imap.hostinger.com  ── buzón restaurante@warynessy.com
```

Endpoints v1:

| Método | Ruta | Qué hace |
|---|---|---|
| GET/PUT | `/correo/config` | ver (sin contraseña) / guardar credenciales — solo ADMIN/OWNER |
| POST | `/correo/config/test` | probar login IMAP |
| GET | `/correo/folders` | carpetas (Bandeja, Enviados, Spam…) |
| GET | `/correo/messages?folder=&page=` | lista paginada |
| GET | `/correo/messages/:uid?folder=` | detalle saneado (marca leído) |
| GET | `/correo/messages/:uid/attachments/:idx` | descarga adjunto |

```ts
// Esqueleto del acceso IMAP (orientativo)
const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });
await client.connect();
const lock = await client.getMailboxLock(folder);
try {
  for await (const m of client.fetch(`${from}:${to}`, { uid: true, envelope: true, flags: true }, { uid: true })) { /* … */ }
} finally { lock.release(); await client.logout(); }
```

Errores típicos a evitar:
- Usar números de secuencia en vez de **UID** (cambian al borrar).
- Pintar `html` con `dangerouslySetInnerHTML` directo.
- Olvidar `lock.release()` → conexión colgada.
- `CONFIG_ENCRYPTION_KEY` distinta entre clon prod y local: las credenciales no descifran en local (ya nos pasó con Captura de recetas) → re-guardar en local.

## Próximos pasos

1. Mergear `feat/permiso-pedidos-por-persona` (bloqueante: aporta `userAccess`/`perUserOnly`).
2. Ejecutar el PDR `plans/261101-2049-buzon-correo-restaurante/`.
3. Probar en local con una cuenta de prueba de Hostinger o con el buzón real en modo lectura.
4. Activar módulo `correo` solo en el tenant Warynessy en prod y meter credenciales desde Ajustes.

## Fuentes

- Hostinger – datos de configuración del correo: https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/
- Hostinger – configurar dispositivos: https://docs.hostinger.com/emails/setup-devices
- Hostinger – configurar en aplicaciones: https://www.hostinger.com/support/4305847-how-to-set-up-hostinger-email-on-your-applications-and-devices/
- ImapFlow (paquete): https://socket.dev/npm/package/imapflow/overview/2.5.8 · repo: https://github.com/postalsys/imapflow

## Preguntas sin resolver

1. ¿Solo **leer**, o también **responder/enviar** desde la app? (PDR deja enviar como fase 2.)
2. Al abrir un mensaje en la app, ¿se marca como **leído** también en Hostinger (Outlook/móvil lo verán leído)? Propuesta: sí, como cualquier cliente.
3. ¿Cuántos ADMIN/OWNER hay en Warynessy? Todos verán el correo automáticamente. Si alguno no debe, hay que cambiar la regla (que el correo no lo salten los ADMIN).
4. ¿Hace falta **borrar/mover/archivar** desde la app? Propuesta v1: no.
5. ¿Avisar de correos nuevos (badge en menú)? Propuesta v1: solo contador de no leídos al entrar.
