# Fase 1 — Backend: integración Google Custom Search

## Contexto
- Ya existe un patrón de integración con Google (`GOOGLE_CLOUD_VISION_API_KEY` en `backend/.env.example`) para el OCR de albaranes.
- El módulo de productos (`backend/src/modules/products/`) ya expone `POST /products/upload-image` (products.controller.ts:186) con `@Roles("ADMIN", "USER")`.
- Respuestas del API en este módulo siguen el patrón `{ success, data, message? }`.

## Requisitos
- Nuevo endpoint `GET /api/v1/products/image-search?q=<texto>` que llama a Google Custom Search JSON API (`searchType=image`, `safe=active`, `num=8`) y devuelve una lista de candidatos.
- Config vía variables de entorno, no hardcodeadas.
- Manejo explícito de errores de Google (cuota agotada, key/cx mal configurados) sin tumbar el request del frontend.

## Archivos a crear
- `backend/src/modules/products/google-image-search.service.ts` — llamada HTTP a Google CSE, mapeo de respuesta.
- `backend/src/modules/products/google-image-search.service.spec.ts` — tests con `fetch`/`httpService` mockeado.

## Archivos a modificar
- `backend/src/modules/products/products.controller.ts` — nuevo endpoint `GET image-search`.
- `backend/src/modules/products/products.module.ts` — registrar el nuevo service como provider.
- `backend/.env.example`, `backend/.env.production.example` — documentar `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ENGINE_ID`.
- `backend/.env` (local, no versionado) — añadir las claves reales una vez el usuario cree el motor de búsqueda.

## Diseño

### Endpoint
```
GET /api/v1/products/image-search?q=Lej%C3%ADa%20Conejo%205L
@Roles("ADMIN", "USER")
```
Respuesta:
```json
{
  "success": true,
  "data": [
    { "url": "https://.../foto-full.jpg", "thumbnailUrl": "https://.../thumb.jpg", "title": "...", "sourcePage": "https://tienda.com/producto" }
  ]
}
```
- `url`: imagen a tamaño completo (Google `link`) — es lo que se guarda si el usuario elige esa opción.
- `thumbnailUrl`: Google `image.thumbnailLink` — es lo que se pinta en la rejilla de candidatos (carga más rápida).
- Límite: máx. 8 resultados (1 sola página de Google CSE, evita coste extra por paginar).
- `q` vacío o ausente → 400 `BadRequestException`.

### Service (`GoogleImageSearchService`)
- Lee `GOOGLE_CSE_API_KEY` y `GOOGLE_CSE_ENGINE_ID` de `ConfigService` (o `process.env` si el módulo no usa `@nestjs/config`; comprobar patrón existente en el proyecto antes de decidir).
- Si falta alguna de las dos env vars: lanzar error claro en el primer uso (`ServiceUnavailableException` con mensaje "Búsqueda de imágenes no configurada") — no fallar silenciosamente devolviendo `[]`, para que quede claro en dev/staging que falta configurar.
- Llamada: `GET https://www.googleapis.com/customsearch/v1?key=...&cx=...&searchType=image&safe=active&num=8&q=...`
- Captura de errores HTTP de Google:
  - 403 (cuota diaria agotada o API no habilitada) → `ServiceUnavailableException("Búsqueda de imágenes no disponible (límite diario alcanzado)")`.
  - Cualquier otro error de red/timeout → mismo tipo de excepción con mensaje genérico; loguear el detalle real con el logger del módulo (no exponerlo al cliente).
- Mapear `items[]` de la respuesta de Google a `{ url: item.link, thumbnailUrl: item.image?.thumbnailLink, title: item.title, sourcePage: item.image?.contextLink }`. Si `items` viene vacío/undefined, devolver `[]` (0 resultados es un caso válido, no un error).

## Tests
- `google-image-search.service.spec.ts`:
  - Mapea correctamente una respuesta de éxito de Google (fixture con 2-3 items).
  - Devuelve `[]` cuando Google responde sin `items`.
  - Lanza `ServiceUnavailableException` en 403.
  - Lanza `ServiceUnavailableException` si faltan las env vars (mock `ConfigService` sin valores).
- `products.controller.spec.ts`: añadir caso para `GET image-search` — 400 sin `q`, 200 con `q` (service mockeado).

## Validación
- `bun run test` (Jest, no `bun test` — ver `[[backend-tests-use-jest-not-bun-test]]`) acotado a los specs tocados.
- Prueba manual con `curl` autenticado (`[[api-testing-auth-session-tenant]]`) una vez el usuario aporte las credenciales de Google CSE.

## Riesgos / rollback
- Si Google CSE no queda configurado a tiempo, el endpoint devuelve error controlado — no bloquea el resto del módulo de productos.
- Sin cambios de esquema de BD en esta fase — rollback es solo revertir el commit.
