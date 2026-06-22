---
title: "Integración Google Vision API para OCR Real"
description: "Reemplazar implementación mock de Tesseract.js con Google Cloud Vision API para procesamiento OCR de documentos en ChefChek"
status: pending
priority: P2
effort: 8h
branch: develop
tags: [ocr, google-vision, ingesta, document-processing]
created: 2026-06-09
---

## Resumen

Este plan implementa la integración real de Google Cloud Vision API para el procesamiento OCR de documentos (facturas, recibos, listas de precios) en el módulo de Ingesta, reemplazando la implementación actual que usa Tesseract.js con fallback a mock.

## Arquitectura Actual

```
DocumentQueueProcessor
  └── OcrAiService.extractText(fileUrl)
       ├── Tesseract.js (actual - limitado)
       └── Fallback: generateMockText() (si falla)
```

## Arquitectura Objetivo

```
DocumentQueueProcessor
  └── OcrAiService.extractText(fileUrl)
       ├── GoogleVisionService (nuevo - primario)
       ├── TesseractService (refactorizado - fallback)
       └── Fallback: error transaccional (sin mock)
```

## Fases

| Fase | Estado | Descripción | Tiempo |
|------|--------|-------------|--------|
| [01](phase-01-configuracion-entorno.md) | pending | Configuración de entorno y dependencias | 1h |
| [02](phase-02-implementacion-google-vision.md) | pending | Implementación Google Vision Service | 2h |
| [03](phase-02b-refactorizacion-tesseract.md) | pending | Refactorización Tesseract como fallback | 1h |
| [04](phase-03-integracion-ocr-ai-service.md) | pending | Integración en OcrAiService | 1h |
| [05](phase-04-tests-unitarios.md) | pending | Tests unitarios | 2h |
| [06](phase-05-tests-integracion.md) | pending | Tests de integración y E2E | 1h |

## Dependencias

- Fase 01 → Fase 02: Google Vision Service requiere dependencias instaladas
- Fase 02 → Fase 03: Refactorización Tesseract requiere conocer estructura de Google Vision
- Fase 02, 03 → Fase 04: Integración requiere ambos servicios implementados
- Fase 04 → Fase 05: Tests requieren código implementado
- Fase 05 → Fase 06: Tests de integración requieren tests unitarios pasando

## Archivos a Crear

- `backend/src/modules/ingesta/services/google-vision.service.ts`
- `backend/src/modules/ingesta/services/tesseract.service.ts` (refactorizado desde ocr-ai.service.ts)
- `backend/src/modules/ingesta/services/ocr-service.interface.ts`
- `backend/src/modules/ingesta/dto/google-vision.dto.ts`

## Archivos a Modificar

- `backend/src/modules/ingesta/ocr-ai.service.ts` → refactorizado para usar inyección de dependencias
- `backend/src/modules/ingesta/ingesta.module.ts` → registrar nuevos servicios
- `backend/.env.example` → agregar GOOGLE_CLOUD_VISION_API_KEY
- `backend/package.json` → agregar @google-cloud/vision
- `frontend/src/app/dashboard/ocr-ai/page.tsx` → conectar API real

## Archivos a Eliminar

- Mock fallback en `ocr-ai.service.ts` (método `generateMockText`)

## Success Criteria

- [ ] Google Vision API integrada exitosamente
- [ ] Tesseract.js permanece como fallback configurable
- [ ] API key segura y configurable por entorno
- [ ] Todos los tests pasan (unitarios + integración)
- [ ] Documentación actualizada
- [ ] Frontend muestra resultados reales de OCR
- [ ] Eliminado cualquier código mock de producción

## Riesgos y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Google Vision API rate limits | Alto | Medio | Implementar retry con backoff exponencial |
| Costo de API | Alto | Medio | Configurable por tenant, límites de uso |
| Formatos no soportados | Medio | Bajo | Validar formato antes de enviar |
| API key exposure | Crítico | Bajo | Variables de entorno, jamás en código |

## Notas de Implementación

- La implementación actual ya tiene Tesseract.js instalado (`tesseract@^7.0.0`)
- El código mock está en `generateMockText()` dentro de `ocr-ai.service.ts:91`
- La estructura de DTOs ya existe en `dto/ingesta.dto.ts`
- El modelo de base de datos soporta OCR en `Document.ocrData: Json?`