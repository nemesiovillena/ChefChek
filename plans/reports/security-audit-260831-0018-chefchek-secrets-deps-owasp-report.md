# Auditoría de seguridad — ChefChek

**Fecha:** 2026-08-31 · **Rama:** develop · **Alcance:** secretos, dependencias, patrones OWASP, aislamiento multi-tenant, config. Read-only, sin cambios de código.

## Resumen

| Área | CRÍTICO | ALTO | MEDIO | BAJO |
|---|---|---|---|---|
| Secretos en código/git | 0 | 0 | 0 | 0 |
| Exposición de secretos (infra) | 0 | 1 | 0 | 0 |
| Dependencias | 0 | 1 | 2 | varias (dev) |
| Patrones de código | 0 | 0 | 1 | 2 |

Base sólida: sin secretos hardcodeados, Lucia para sesiones, helmet+CSP, CORS con allowlist, ValidationPipe estricto, Throttler global, Swagger off en prod, sin `child_process`/`eval`, uploads con validación de MIME y tamaño.

## Hallazgos

### ALTO-1 · Secretos de producción expuestos por el MCP de Dokploy *(infra, no código)*
`application-one` del MCP `dokploy-mcp` devuelve en claro: `JWT_SECRET`, password de `DATABASE_URL`, `CONFIG_ENCRYPTION_KEY`, clave privada RSA de la GitHub App, `PEXELS_API_KEY`. Cualquier sesión/máquina con ese MCP configurado los ve.
- **Acción:** (a) limitar qué entornos tienen `dokploy-mcp`; (b) evaluar rotación si el acceso ha sido amplio. `CONFIG_ENCRYPTION_KEY` cifra las API keys de IA por tenant → su rotación exige re-cifrado (plan aparte). `JWT_SECRET`/DB/GitHub App key se rotan con ventana de downtime.

### ALTO-2 · `socket.io-parser` < 4.2.7 — agotamiento de memoria (GHSA-2m8v-j782-fhvr)
Runtime-facing (notificaciones por WebSocket). `socket.io@4.8.3` ya es la última 4.x; hay copia transitiva antigua del parser.
- **Acción:** `bun update` y verificar que `socket.io-parser` sube a ≥4.2.7. Bajo riesgo (socket.io se mantiene).

### MEDIO-1 · `/uploads/` servido público sin autenticación
`main.ts:51` — `useStaticAssets(.../uploads, { prefix: "/uploads/" })`. Todos los ficheros subidos (escaneos de albarán, fotos de incidencia, avatares, imágenes de artículo/receta) son accesibles por URL sin sesión ni control de tenant. Nombres con prefijo `Date.now()` → parcialmente adivinables. Los escaneos de albarán pueden revelar precios de proveedor de otro tenant (IDOR cross-tenant).
- **Acción:** servir `/uploads` desde un controlador autenticado que valide propiedad por tenant, o migrar a almacenamiento privado con URLs firmadas (ya previsto Bunny.net). Ojo: el frontend referencia `/uploads/...` directo en `<img>`, el cambio toca front+back → plan.

### MEDIO-2 · `qs` DoS (GHSA-q8mj-m7cp-5q26) + `lodash` code-injection (GHSA-r5fr-rjxr-66jc)
Transitivas vía `@nestjs/platform-express` y `@nestjs/config`/`@nestjs/swagger`/`bull`. `lodash` solo explotable con `_.template` sobre input de usuario (no ocurre). `qs` sí es alcanzable (parseo de querystring).
- **Acción:** `overrides` en `package.json` para `qs` ≥6.15.2; `lodash` vigilar upstream de NestJS. Riesgo medio (probar bien).

### BAJO-1 · SSRF latente en `python-ocr.service.ts:76`
Rama "URL remota" → `fetch(fileUrl)` sin validación. **No alcanzable hoy** (todos los llamadores pasan `Buffer`), pero si se cablea a input de usuario permite golpear servicios internos / metadata cloud (169.254.169.254).
- **Acción:** eliminar la rama muerta, o si se va a usar, validar contra allowlist y bloquear IPs privadas/link-local.

### BAJO-2 · `$queryRawUnsafe` con nombre de tabla interpolado (módulo backup)
`backup-export.service.ts:72`, `backup-restore.service.ts:99,169`. **No inyectable hoy**: los identificadores vienen de `information_schema` filtrados por `EXCLUDED_TABLES` y de un allowlist de orden de inserción; los valores van parametrizados.
- **Acción (defensa en profundidad):** `assert(/^[a-z_][a-z0-9_]*$/.test(name))` sobre cada tabla/columna antes de interpolar.

## Comprobaciones OK

- Sin secretos en árbol de trabajo ni en historial (~400 commits, patrones AWS/RSA/Stripe/GitHub/Google/Slack).
- `.env` correctamente en `.gitignore`; solo `*.env.example` trackeados; `backup/.env` ignorado (verificado con `git check-ignore`).
- Sesiones vía Lucia (no JWT casero); `tenantId` derivado del usuario autenticado, no de cabecera manipulable (salvo `X-Tenant-Slug` solo en login).
- CORS `origin` = `ALLOWED_ORIGINS` (prod: `https://app.chefchek.com`), no wildcard; `credentials:true` coherente.
- `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` + `transform`.
- `ThrottlerModule` global 100 req/60s + `ThrottlerGuard`.
- Uploads: límites de tamaño en todos; MIME validado en avatar, artículo, receta, incidencia; albarán/catálogo pasan al microservicio.
- Sin `child_process`, `exec`, `eval`, `Function()` en backend.

## Orden recomendado

1. **ALTO-1** — restringir MCP Dokploy (inmediato, sin código). Decidir rotación.
2. **ALTO-2 + BAJO-1 + BAJO-2** — fixes de bajo riesgo en una rama (`bun update`, guard SSRF, assert de identificadores).
3. **MEDIO-2** — `overrides` de `qs`, con pruebas.
4. **MEDIO-1** — `/uploads` autenticado: plan propio (toca frontend).

## Preguntas abiertas

- ¿El MCP de Dokploy ha estado accesible desde entornos no controlados? Determina si hay que rotar secretos.
- ¿Se quiere `/uploads` con auth por tenant ahora o migrar directamente a Bunny.net?
