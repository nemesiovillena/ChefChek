# OCR IA config server-side (multi-device)

## Status
En curso.

## Contexto
Bug: albarán subido desde iPhone se procesaba por el path **regex** (productos basura) mientras el mismo albarán desde el ordenador usaba la **IA** (correcto). Causa: el modelo IA + API key se guardan en `localStorage` del navegador (`frontend/src/lib/ai-api-keys.ts`), por dispositivo. El iPhone no los tenía → `getOcrModel()` defaultea a `'regex'`. No es la imagen ni EXIF.

## Decisión (usuario)
Guardar config IA (modelo + API key) en el **servidor**, por tenant, cifrada. Cualquier dispositivo del tenant la usa. Reutiliza la tabla `Configuration` (categoría `OCR`) y el patrón de cifrado AES-256-GCM de `mail.service.ts` (CONFIG_ENCRYPTION_KEY). **Sin migración** de schema.

## Fases
1. **Backend crypto util** — `common/utils/encryption.util.ts` (encrypt/decrypt con salt). Refactor `mail.service` para usarlo (DRY).
2. **Backend módulo `ocr-config`** — service/controller/dto/module (molde `costing-config`). `OcrConfigService.saveConfig / getPublicConfig / resolveForUpload`. Endpoint `GET/PUT /api/v1/ocr-config`. Register en AppModule.
3. **Backend wiring** — `AlbaranesService.createFromUpload` resuelve `{aiModel, aiApiKey}` vía `ocrConfig.resolveForUpload(tenantId, req)` (request override ?? stored). → iPhone sin key → backend aplica config del tenant → IA.
4. **Backend tests** — `ocr-config.service.spec`: roundtrip cifrado, resolveForUpload fallback, keep-existing-key.
5. **Frontend** — hook `use-ocr-config` (GET/PUT); `settings/page.tsx` carga del servidor + guarda en servidor + migración automática (si server vacío y localStorage tiene modelo+key → push al server); `subir/page.tsx` lee modelo del servidor para mostrar.
6. **Deploy + verificar** — commit/push (auto-deploy backend+frontend); probar en warynessy: guardar config en un dispositivo, subir albarán desde otro → debe usar IA.

## Aceptación
- Subir albarán desde un dispositivo SIN la key en su localStorage usa la IA si el tenant la tiene configurada en servidor.
- `ocrRawData.extraction_model` presente en el resultado (path IA) para la subida iPhone tras configurar.
- Config visible desde cualquier dispositivo del tenant.
- Tests backend verde; mail.spec sigue pasando.

## Notas / fuera de scope
- Catálogos (`catalog-import-uploader`) tienen el mismo problema (localStorage). Mismo `OcrConfigService` disponible para migrarlos después; no en este PR.
- La key aún viaja en FormData desde clientes con localStorage (backward compat); el backend prefiere request, fallback a stored. Endurecimiento futuro: que el frontend deje de enviarla.
