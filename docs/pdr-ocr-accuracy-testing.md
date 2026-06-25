# PDR: Pruebas de Precisión OCR con Albaranes Reales

## Resumen Ejecutivo

Validar la precisión del microservicio OCR Python (EasyOCR) comparándolo con el sistema anterior Tesseract.js utilizando 10 albaranes reales del cliente ChefChek.

## Objetivos

1. **Validar precisión >90%** en reconocimiento de albaranes reales
2. **Medir mejora vs Tesseract.js** (actual: 70-80% precisión)
3. **Identificar patrones de error** para optimizar pre-procesamiento
4. **Confirmar preparación producción** del microservicio

## Estado

**Fase:** Planeamiento pruebas
**Prioridad:** Alta
**Progreso:** 10% (sistema funcional, pendiente pruebas reales)

## Metas de Éxito

- [ ] Precisión global ≥90% en 10 albaranes reales
- [ ] Extracción correcta: proveedor, fecha, productos, total
- [ ] Validación multicapa detectando errores reales
- [ ] Tiempo de procesamiento ≤5s por documento
- [ ] Acción correcta (auto/review/manual) apropiada en cada caso

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

## Referencias

- PDR principal: `plans/260615-1336-chefchek-ocr-modernization-python-albaran-processing/pdr-ocr-modernization.md`
- Microservicio: `backend/ocr-microservice/`
- Tests: `backend/ocr-microservice/tests/` (pendiente crear)