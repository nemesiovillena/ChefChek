# Consolidar ingesta en Albaranes + eliminar vestigio OCR/IA

## Estado
- Branch: `develop` · Fecha: 2026-07-06
- Decisión de usuario (confirmada): subir albaranes desde el **móvil vía web** (`/dashboard/albaranes/subir` mobile-first con cámara), **borrar Telegram**, eliminar el menú y página OCR/IA, y consolidar el backend (Albaranes como pipeline canónico).
- PWA instalable queda como **fase 3 opcional**, tras validar el flujo móvil.

## Contexto
- `/dashboard/ocr-ai` = mockup vestigial; lee el módulo `ingesta` (pipeline paralelo) y la mayoría de sus controles no funcionan.
- `/dashboard/ingestion` = subida de albaranes mal etiquetada como "Ingesta"; sólo sube albaranes.
- Backend `ingesta` (21 archivos, 18 endpoints, Telegram, cola Bull, OCR-AI, GoogleVision) es un pipeline paralelo del que Albaranes sólo consume **2 servicios**: `PythonOcrService` y `ProductRecognitionService`.
- Necesidad real del usuario: escanear y subir albaranes rápido desde el teléfono. Solución: captura de cámara vía web (`capture="environment"`) + Albaranes en el nav móvil (+ PWA opcional).

## Fases
1. **Frontend + móvil** (segura) → `phase-01-frontend-movil.md`
2. **Backend** (extraer módulo `ocr` compartido, borrar `ingesta` completo) → `phase-02-backend-consolidacion.md`
3. **PWA** (opcional, tras validar fase 1) → `phase-03-pwa-opcional.md`

## Dependencias
- Fase 2 requiere Fase 1 terminada (frontend sin referencias a `/ingesta/*` ni a las rutas viejas).
- Fase 3 requiere Fase 1 validada en móvil real.

## Criterios de aceptación
- Cero referencias frontend a `/dashboard/ocr-ai`, `/dashboard/ingestion`, ni `/api/v1/ingesta/*`.
- `/dashboard/albaranes/subir` mobile-first con `capture="environment"`; Albaranes en nav móvil.
- Backend arranca; upload+OCR+matching de Albaranes funcionan (specs verdes, smoke manual).
- Módulo `ingesta` y sus 18 endpoints eliminados; `PythonOcrService` y `ProductRecognitionService` vivos en `modules/ocr/`.
- Telegram eliminado.

## Riesgo / rollback
- Fase 2 toca `app.module.ts` y registry de módulos → rollback = revert commit.
- Validación por fase: lint/build frontend; `bun test` backend; smoke de upload desde navegador móvil.
