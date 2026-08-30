# Plan — Servir `/uploads` con autenticación y ámbito de tenant

**Estado:** PENDIENTE · **Origen:** hallazgo MEDIO-1 de la auditoría de seguridad (`plans/reports/security-audit-260831-0018-*.md`).

## Problema

`backend/src/main.ts` sirve `uploads/` como estáticos sin auth (`useStaticAssets`). Cualquiera con la URL accede a escaneos de albarán, fotos de incidencia, avatares e imágenes de artículo/receta. Los escaneos de albarán pueden revelar precios de proveedor de otro tenant (IDOR cross-tenant).

**Mitigación ya aplicada (PR de dep-overrides + filename hardening):** los nombres de fichero pasan a UUID aleatorio (`generateUploadFilename`), así que la URL ya no es deducible por marca de tiempo. Este plan cierra el agujero del todo.

## Contexto técnico

- Backend guarda rutas relativas: `/uploads/{users,recipes,products,pedidos-compra}/<uuid>.<ext>` en `User.avatarUrl`, `Recipe.imageUrl`, `Product.imageUrl`, `PurchaseOrderEvent.payload.photoUrl`.
- Frontend: `next.config` reescribe `/uploads/:path*` → `${backendUrl}/uploads/:path*`; los componentes usan la URL guardada directa en `<img>`/`<Image>`.
- Auth: sesión Lucía vía cabecera `Authorization: Bearer` (no cookie usable desde `<img>`). El backend SÍ emite cookie de sesión (`sameSite=strict` en prod) pero el frontend no la usa.

## Decisión pendiente (elegir enfoque)

| Opción | Esfuerzo | Cross-tenant | Notas |
|---|---|---|---|
| **A. Controlador autenticado + resolución de tenant** | Alto | Sí | `GET /uploads/*` con guard; resuelve el tenant dueño buscando la ruta en las 4 tablas (o mapa categoría→modelo). El `<img>` necesita enviar credencial → o cookie same-site vía el rewrite, o el frontend pasa a cargar imágenes como blob autenticado. |
| **B. Reestructurar almacenamiento a `/uploads/<tenantId>/...`** + migrar | Alto | Sí | Requiere migración de ficheros + backfill de URLs. Encaja con object storage. |
| **C. Solo exigir sesión (sin comprobación de tenant)** | Medio | No | Corta el acceso anónimo de Internet. Un usuario logueado de otro tenant aún podría abrir la URL si la obtiene. Requiere resolver el problema credencial-en-`<img>`. |
| **D. Migrar a Bunny.net con URLs firmadas de TTL corto** | Alto | Sí | Es la dirección ya decidida para almacenamiento de imágenes ([[product-images-future-storage-bunny-net]]). Este plan se absorbe ahí. |

**Recomendación:** si Bunny.net entra pronto → hacer **D** y no construir auth intermedia. Si no → **A** con cookie de sesión same-site reenviada por el rewrite de Next.

## Fases (para el enfoque A)

1. **Backend — endpoint autenticado**
   - Nuevo `FilesController` `GET /uploads/*path` con `AuthGuard` + `TenantGuard`.
   - Quitar `useStaticAssets` de `main.ts`.
   - Resolver tenant: mapa `{ users: {model:'user', col:'avatarUrl'}, recipes: ..., products: ..., 'pedidos-compra': via PurchaseOrderEvent.payload }`; `findFirst` con caché LRU corta.
   - Protección path traversal: normalizar y verificar que resuelve dentro de `uploads/`.
   - Stream con `Content-Type` por extensión + `Cache-Control: private`.
2. **Auth por cookie para `<img>`**
   - El rewrite de Next debe reenviar la cookie de sesión del navegador al backend (`app.chefchek.com` → cookie propia → proxy añade `Authorization` o reenvía cookie).
   - Alternativa: el frontend emite la cookie de sesión en login además del `sessionStorage`.
3. **Frontend**
   - Verificar que todas las imágenes cargan (avatares en navbar/usuarios, receta visual, artículo, foto de incidencia).
   - `next.config` `images.remotePatterns` si aplica.
4. **Verificación**
   - E2E: subir avatar/imagen y comprobar que carga logueado y da 401/403 sin sesión.
   - Prueba cross-tenant: usuario de tenant B no puede abrir fichero de tenant A (403).

## Riesgos

- Regresión de carga de imágenes en producción (alto impacto visual). Desplegar con verificación E2E previa.
- El caso `pedidos-compra` (foto en JSON de evento) necesita query JSON en Postgres.
- Ficheros huérfanos (subidos, URL nunca guardada) → 404, aceptable.
