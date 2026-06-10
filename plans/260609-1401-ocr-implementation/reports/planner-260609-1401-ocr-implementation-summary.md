# Plan de Implementación: Google Vision API para OCR Real

**Plan ID:** 260609-1401-ocr-implementation
**Fecha:** 2026-06-09
**Estado:** pending
**Prioridad:** P2
**Esfuerzo estimado:** 8h

## Resumen Ejecutivo

Este plan reemplaza la implementación mock de OCR en ChefChek con una integración real de Google Cloud Vision API. La implementación actual usa Tesseract.js con fallback a un mock que genera datos falsos cuando falla. El objetivo es eliminar el mock y usar Google Vision como proveedor primario, manteniendo Tesseract como fallback.

## Motivación

1. **Precisión mejorada**: Google Vision API tiene mejor precisión en OCR general
2. **Eliminación de mock**: El mock genera datos falsos que no corresponden a documentos reales
3. **Escalabilidad**: Google Vision maneja mejor volúmenes altos
4. **Flexibilidad**: Sistema de proveedores permite cambiar entre OCR services fácilmente

## Estado Actual

```
OcrAiService (actual)
├── Tesseract.js (limitado)
└── generateMockText() - Mock que crea datos falsos cuando falla
```

**Problemas identificados:**
- `generateMockText()` en `ocr-ai.service.ts:91` siempre genera los mismos datos
- Datos no corresponden a documentos reales
- Confusión para usuarios al ver productos inventados
- No hay fallback real sin mock

## Objetivo

```
OcrAiService (refactorizado)
├── GoogleVisionService (primario)
│   ├── Google Cloud Vision API
│   ├── Retry con backoff exponencial
│   └── Manejo robusto de errores
└── TesseractService (fallback)
    └── Tesseract.js sin mock
```

## Fases de Implementación

| Fase | Descripción | Tiempo | Estado |
|------|-------------|--------|--------|
| 01 | Configuración de entorno y dependencias | 1h | pending |
| 02 | Implementación Google Vision Service | 2h | pending |
| 02b | Refactorización Tesseract como fallback | 1h | pending |
| 03 | Integración en OcrAiService | 1h | pending |
| 04 | Tests unitarios | 2h | pending |
| 05 | Tests de integración y E2E | 1h | pending |
| 06 | Documentación y verificación final | 0.5h | pending |

**Total:** 8.5 horas

## Archivos a Crear

### Nuevos Servicios
- `backend/src/modules/ingesta/services/google-vision.service.ts`
- `backend/src/modules/ingesta/services/tesseract.service.ts`
- `backend/src/modules/ingesta/services/ocr-service.interface.ts`

### DTOs
- `backend/src/modules/ingesta/dto/google-vision.dto.ts`

### Tests
- `backend/src/modules/ingesta/services/google-vision.service.spec.ts`
- `backend/src/modules/ingesta/services/tesseract.service.spec.ts`
- `backend/src/modules/ingesta/ingesta.integration.spec.ts`
- `frontend/__tests__/ocr-e2e.spec.ts`

### Documentación
- `docs/google-vision-setup.md`

## Archivos a Modificar

### Backend
- `backend/src/modules/ingesta/ocr-ai.service.ts` - Refactorización completa
- `backend/src/modules/ingesta/ingesta.module.ts` - Registro de nuevos servicios
- `backend/package.json` - Agregar @google-cloud/vision
- `backend/.env.example` - Variables de entorno nuevas
- `backend/src/modules/ingesta/ocr-ai.service.spec.ts` - Actualizar tests

### Frontend
- `frontend/src/app/dashboard/ocr-ai/page.tsx` - Ya existe, verificar funcionamiento
- `frontend/package.json` - Ya tiene dependencias necesarias

### Docs
- `docs/ocr-engine-architecture.md` - Actualizar checklist

## Archivos a Eliminar

- Método `generateMockText()` de `ocr-ai.service.ts`

## Data Flow

### Flujo Actual
```
DocumentQueueProcessor
  └── OcrAiService.extractText(fileUrl)
       └── Tesseract.js
            └── Si falla → generateMockText() ❌ MOCK
```

### Flujo Objetivo
```
DocumentQueueProcessor
  └── OcrAiService.extractText(fileUrl)
       └── GoogleVisionService (inyectado)
            └── Si falla → TesseractService (fallback)
                 └── Si falla → Error (sin mock) ✅
```

## Security Considerations

1. **API Key Security**
   - Nunca en código (usar variables de entorno)
   - Configurar restricciones de IP
   - Configurar restricciones de API

2. **Rate Limiting**
   - Google Vision tiene límites de uso
   - Implementar retry con backoff exponencial
   - Monitorear uso y alertar

3. **Data Privacy**
   - Datos enviados a Google Cloud
   - Verificar términos de servicio
   - No enviar datos sensibles sin permiso

## Risk Assessment

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Google Vision API rate limits | Alto | Medio | Retry con backoff, fallback a Tesseract |
| Costo de API | Alto | Medio | Configurar límites de uso, monitorear |
| API key exposure | Crítico | Bajo | Variables de entorno, .gitignore |
| Cambio de API break | Medio | Bajo | Versión fija de @google-cloud/vision |
| Tests mock fallan | Bajo | Alto | Validar mocks antes de implementar |

## Testing Strategy

### Unit Tests
- GoogleVisionService: extractText, validateInput, handleOcrError, retry
- TesseractService: extractText, worker cleanup
- OcrAiService: primary service, fallback, processDocumentData

### Integration Tests
- Creación de documento
- Procesamiento de documento
- Actualización en cascada
- Consulta de documentos

### E2E Tests
- Navegación en frontend
- Display de extracciones
- Configuración de OCR

**Cobertura objetivo:** ≥80%

## Success Criteria

### Backend
- [ ] Google Vision API integrada
- [ ] Tesseract como fallback
- [ ] Mock eliminado
- [ ] Tests unitarios pasan
- [ ] Tests de integración pasan
- [ ] Cobertura ≥80%

### Frontend
- [ ] Página OCR-AI renderiza
- [ ] Configuración visible
- [ ] Sin datos mock hardcoded

### Documentación
- [ ] Guía de configuración
- [ ] Documentación actualizada
- [ ] .env.example actualizado

### Security
- [ ] API key no en código
- [ ] Variables de entorno documentadas
- [ ] Restricciones configuradas

## Rollback Plan

Si hay problemas en producción:

1. Cambiar `OCR_PROVIDER=tesseract` en `.env`
2. Reiniciar servidor
3. Verificar que Tesseract funciona
4. Investigar logs de Google Vision

## Dependencies

### Externas
- @google-cloud/vision@^4.3.2
- Tesseract.js@^7.0.0 (ya instalado)

### Internas
- PrismaService
- ProductRecognitionService
- Bull Queue

## Next Steps

1. Revisar plan con el equipo
2. Aprobar implementación
3. Comenzar Fase 01: Configuración de entorno

## Referencias

- Plan files: `plans/260609-1401-ocr-implementation/`
- Docs: `docs/ocr-engine-architecture.md`
- Google Vision API: https://cloud.google.com/vision/docs
- Tesseract.js: https://github.com/naptha/tesseract.js

## Unresolved Questions

- ¿Límites de presupuesto para Google Vision API?
- ¿Necesidad de support multi-tenant para configuración de OCR por tenant?
- ¿Almacenamiento de imágenes procesadas para debug?
- ¿Métricas de uso de OCR por proveedor?

---

**Creado por:** Planner Agent
**Fecha de creación:** 2026-06-09
**Última actualización:** 2026-06-09