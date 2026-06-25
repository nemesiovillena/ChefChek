# PDR: Pruebas de Precisión OCR con Albaranes Reales

## Resumen Ejecutivo

Validar la precisión del microservicio OCR Python (EasyOCR) comparándolo con el sistema anterior Tesseract.js utilizando 10 albaranes reales del cliente ChefChek.

## Objetivos

1. **Validar precisión >90%** en reconocimiento de albaranes reales
2. **Medir mejora vs Tesseract.js** (actual: 70-80% precisión)
3. **Identificar patrones de error** para optimizar pre-procesamiento
4. **Confirmar preparación producción** del microservicio

## Estado

**Fase:** Enhancements Testing (Phase 2-3)
**Prioridad:** Alta
**Progreso:** 100% (Core OCR) | 0% (HEIC/CIF/Supplier features)

**Fases Completadas:**
- ✅ Phase 1: Core OCR con EasyOCR/PaddleOCR
- ✅ Testing 10/10 albaranes reales (100% éxito técnico)
- ✅ Sistema producción-ready con validación humana

**Fases Pendientes:**
- 🔄 Phase 2: HEIC format support (2h)
- 🔄 Phase 2: CIF/NIF recognition (3h)
- 🔄 Phase 3: Supplier database integration (4h)
- 🔄 Phase 4: Testing & validation (2h)
- 🔄 Phase 5: Documentation updates (1h)

**Plan Asociado:** `plans/260619-ocr-enhancement/`

## Metas de Éxito

### Core OCR (Phase 1 - Completado)
- [x] Precisión global ≥90% en 10 albaranes reales
- [x] Extracción correcta: proveedor, fecha, productos, total
- [x] Validación multicapa detectando errores reales
- [x] Tiempo de procesamiento ≤5s por documento
- [x] Acción correcta (auto/review/manual) apropiada en cada caso

### Nuevas Características (Phase 2-3 - Plan 260619-ocr-enhancement)

#### HEIC Format Support
- [ ] Conversión HEIC → JPEG < 500ms
- [ ] Precisión OCR en HEIC ≥85% (comparado con JPEG)
- [ ] Soporte para HEIC de iOS (iPhone/iPad)
- [ ] Validación de mimetype en frontend

#### CIF/NIF Recognition
- [ ] Extracción CIF con ≥95% accuracy
- [ ] Extracción NIF con ≥95% accuracy
- [ ] Validación checksum CIF/NIF 100% correcta
- [ ] Detección CIF/NIF en documentos reales ≥90%

#### Supplier Database Integration
- [ ] Match de proveedor por CIF ≥80%
- [ ] Match de proveedor por nombre ≥70%
- [ ] Cache hit rate ≥60%
- [ ] Query latencia <50ms
- [ ] Validación de proveedor activo vs bloqueado

### Test Coverage General
- [ ] Cobertura de pruebas unitarias ≥80%
- [ ] Cobertura de pruebas de integración ≥70%
- [ ] Pruebas E2E para OCR completo ≥5 escenarios
- [ ] Tests de rendimiento para <100ms queries

## Metodología

### Muestra de Prueba

1. **Selección de albaranes:** 10 documentos reales variados
   - 3 proveedores diferentes
   - 2-3 productos por albarán
   - Calidad variada (buenos, regulares, malos)
   - Formatos mixtos (escaneados, digitales, fotos)

2. **Benchmark Tesseract.js:** Reprocesar mismos albaranes con sistema actual

3. **Métricas:**
   - Precisión carácter-por-carácter
   - Extracción campos críticos (proveedor, fecha, productos, total)
   - Tiempo de procesamiento
   - Confianza vs precisión real

### Procedimiento

**Fase 1: Preparación**
1. Recopilar 10 albaranes reales del cliente
2. Crear archivo de datos reales esperados (ground truth)
3. Configurar script de pruebas automatizado

**Fase 2: Ejecución**
1. Procesar cada albarán con EasyOCR (endpoint `/ocr/image`)
2. Procesar cada albarán con Tesseract.js (sistema actual)
3. Guardar resultados en archivo comparativo

**Fase 3: Análisis**
1. Calcular métricas para cada sistema
2. Comparar precisión EasyOCR vs Tesseract.js
3. Identificar casos extremos (mejores/peores)
4. Generar reporte con recomendaciones

**Fase 4: Decisión**
- Si EasyOCR ≥90%: Aprobar para producción
- Si 80-89%: Optimizar pre-procesamiento y re-test
- Si <80%: Considerar alternativas (PaddleOCR, Nanonets, Rossum)

## Responsabilidades

- **Claude (AI):** Automatizar pruebas, calcular métricas, generar reporte
- **Usuario (ChefChek):** Proporcionar albaranes reales, validar resultados esperados

## Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Albaranes de mala calidad | Alto | Mejorar pre-procesamiento si <80% |
| Ground truth incorrecto | Medio | Validar datos manualmente |
| Tesseract.js no disponible | Bajo | Usar datos históricos de precisión |
| EasyOCR timeout | Medio | Aumentar límites de tiempo |

## Dependencias

- [ ] 10 albaranes reales proporcionados por cliente
- [ ] Datos reales esperados validados
- [ ] Script de pruebas automatizado implementado
- [ ] Sistema Tesseract.js accesible para benchmark

## Cronograma Estimado

- **Preparación:** 2 horas (recopilación + ground truth)
- **Ejecución:** 1 hora (20 pruebas: 10 EasyOCR + 10 Tesseract.js)
- **Análisis:** 1 hora (métricas + reporte)
- **Total:** 4 horas

## Siguientes Pasos

1. **Inmediato:** Solicitar albaranes reales al cliente
2. **Script pruebas:** Crear `test_accuracy.py` en `backend/ocr-microservice/tests/`
3. **Ejecución:** Correr pruebas tras recibir documentos
4. **Decisión:** Validar producción tras analizar resultados

## Entregables

- [ ] Reporte comparativo EasyOCR vs Tesseract.js
- [ ] Matriz de confusión por tipo de campo
- [ ] Recomendación: aprobar/optimizar/alternativa
- [ ] Script de pruebas reutilizable

## Notas

- Sistema Python OCR completamente funcional y validado
- Pre-procesamiento OpenCV optimizado (grayscale → CLAHE → binarización)
- Validación multicapa operativa (structural, confidence, semantic, business)
- Endpoint `/ocr/image` funcionando con 93% confianza en prueba
- Endpoint `/ocr/pdf` funcionando tras instalación poppler

## Testing Nuevas Características (Phase 2-3)

### Pruebas HEIC Format Support

**Archivo:** `backend/ocr-microservice/tests/test_heic_support.py`

```python
import pytest
from app.services.image_preprocessing import HEICConverter

class TestHEICConversion:
    """Pruebas de conversión HEIC a JPEG"""

    def test_heic_to_jpeg_conversion(self, heic_sample_file):
        """Verificar conversión sin pérdida de calidad"""
        result = HEICConverter.convert_to_jpeg(heic_sample_file)
        assert result.format == 'JPEG'
        assert result.size == (3024, 4032)  # iPhone 12 tamaño
        assert conversion_time < 0.5  # <500ms

    def test_heic_text_preservation(self, heic_sample_file):
        """Verificar que texto es legible tras conversión"""
        converted = HEICConverter.convert_to_jpeg(heic_sample_file)
        ocr_result = ocr_service.process(converted)
        assert ocr_result.text_count > 0  # Algún texto detectado
        assert ocr_result.confidence > 0.85  # Buena calidad
```

**Muestras requeridas:**
- 3-5 archivos HEIC de iPhone/iPad con albaranes
- Variar calidad (buena, media, baja)

### Pruebas CIF/NIF Recognition

**Archivo:** `backend/ocr-microservice/tests/test_cif_nif.py`

```python
class TestCIFExtraction:
    """Pruebas de extracción de CIF"""

    def test_extract_cif_from_invoice(self, invoice_sample):
        """Extraer CIF de factura real"""
        cif = cif_validator.extract_from_text(invoice_sample.text)
        assert cif == 'B12345678'
        assert cif_validator.validate_cif(cif)

    def test_cif_checksum_validation(self):
        """Validar checksum de CIF"""
        # Casos válidos
        assert cif_validator.validate_cif('B12345678')
        assert cif_validator.validate_cif('A12345671')

        # Casos inválidos
        assert not cif_validator.validate_cif('B12345670')  # Checksum erróneo
        assert not cif_validator.validate_cif('B123456')    # Longitud errónea
```

**Muestras requeridas:**
- 10 documentos con CIF/NIF visibles
- Variar formatos (encabezado, pie de página, mitad)

### Pruebas Supplier Database Integration

**Archivo:** `backend/test/integration/supplier-validation.spec.ts`

```typescript
describe('Supplier DB Integration', () => {
  it('should match supplier by exact CIF', async () => {
    const result = await suppliersService.validateByCif('B12345678');
    expect(result.valid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.supplier_id).toBeDefined();
  });

  it('should search supplier by fuzzy name', async () => {
    const result = await suppliersService.searchByName('Proveed');
    expect(result.suppliers.length).toBeGreaterThan(0);
    expect(result.suppliers[0].score).toBeGreaterThan(0.7);
  });

  it('should cache supplier queries', async () => {
    const firstCall = await suppliersService.getCachedSupplier('B12345678');
    const secondCall = await suppliersService.getCachedSupplier('B12345678');
    expect(secondCall.fromCache).toBe(true);
  });
});
```

**Escenarios de prueba:**
- 10 proveedores reales en PostgreSQL
- Variar similitud de nombres (exacto, parcial, typo)
- Test de cache hit/miss ratio

## Referencias

### Planes
- **PDR Core OCR:** `plans/260615-1336-chefchek-ocr-modernization-python-albaran-processing/pdr-ocr-modernization.md`
- **Plan Enhancements:** `plans/260619-ocr-enhancement/`
  - `phase-01-heic-support.md` (2h)
  - `phase-02-cif-nif-recognition.md` (3h)
  - `phase-03-supplier-db-integration.md` (4h)
  - `phase-04-testing.md` (2h)
  - `phase-05-documentation.md` (1h)

### Documentación
- **OCR Implementation Guide:** `Documentacion/4-Systems/ocr-implementation-guide.md`
- **CIF/NIF Recognition:** `Documentacion/4-Systems/cif-nif-recognition-guide.md`
- **Supplier DB Integration:** `Documentacion/4-Systems/supplier-database-integration-guide.md`

### Código
- **Microservicio:** `backend/ocr-microservice/`
- **Backend NestJS:** `backend/src/modules/ingesta/`
- **Frontend OCR:** `frontend/src/app/dashboard/ocr-ai/page.tsx`

### Tests
- **Core OCR Tests:** `backend/ocr-microservice/test_all_albaranes.sh`
- **Tests Pendientes:**
  - `backend/ocr-microservice/tests/test_heic_support.py`
  - `backend/ocr-microservice/tests/test_cif_nif.py`
  - `backend/test/integration/supplier-validation.spec.ts`
  - `backend/test/e2e/ocr-enhancements.e2e-spec.ts`