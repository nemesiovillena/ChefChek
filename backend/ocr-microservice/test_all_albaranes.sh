#!/bin/bash
# Script de testing automatizado para OCR service
# Prueba todos los albaranes disponibles y genera reporte de precisión

OCR_URL="http://localhost:8000"
RESULTS_DIR="test_results"
mkdir -p "$RESULTS_DIR"

echo "🚀 Testing OCR Service: $OCR_URL"
echo "=========================================="
echo ""

# Verificar que el servicio esté corriendo
echo "1️⃣ Verificando servicio OCR..."
HEALTH=$(curl -s "$OCR_URL/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Servicio OK: $(echo $HEALTH | jq -r '.status')"
else
    echo "❌ Servicio NO disponible"
    exit 1
fi
echo ""

# Lista de archivos de prueba
FILES=(
    "test_albaran.jpg"
    "test_albaran.pdf"
    "test_albaran_pdf_image.png"
    "user_albaran.jpg"
    "user_albaran2.jpg"
    "user_albaran3.png"
    "user_albaran4.jpg"
    "user_albaran5.jpg"
    "user_albaran6.jpg"
    "user_albaran7.jpg"
)

TOTAL_TESTS=${#FILES[@]}
SUCCESS_COUNT=0
FAIL_COUNT=0

echo "2️⃣ Procesando $TOTAL_TESTS albaranes..."
echo ""

for FILE in "${FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
        echo "⚠️  Archivo no encontrado: $FILE"
        continue
    fi

    echo "📄 Procesando: $FILE"

    # Determinar endpoint (imagen vs pdf)
    if [[ "$FILE" == *.pdf ]]; then
        ENDPOINT="/ocr/pdf"
    else
        ENDPOINT="/ocr/image"
    fi

    # Procesar archivo
    START_TIME=$(date +%s.%N)
    RESPONSE=$(curl -s -X POST "$OCR_URL$ENDPOINT" \
        -F "file=@$FILE" \
        -F "enable_preprocessing=true" \
        -F "enable_validation=true")
    END_TIME=$(date +%s.%N)

    # Calcular tiempo de procesamiento
    PROC_TIME=$(echo "$END_TIME - $START_TIME" | bc)

    # Extraer resultados
    SUCCESS=$(echo $RESPONSE | jq -r '.success')
    CONFIDENCE=$(echo $RESPONSE | jq -r '.document.confidence // "N/A"')
    PRODUCTS_COUNT=$(echo $RESPONSE | jq -r '.document.products | length // 0')
    SUPPLIER=$(echo $RESPONSE | jq -r '.document.supplier_name // "N/A"')
    RECOMMENDED=$(echo $RESPONSE | jq -r '.validation.recommended_action // "N/A"')

    # Guardar resultado
    RESULT_FILE="$RESULTS_DIR/${FILE%.*}_result.json"
    echo $RESPONSE | jq '.' > "$RESULT_FILE"

    if [ "$SUCCESS" = "true" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "   ✅ Éxito | Confianza: $CONFIDENCE | Productos: $PRODUCTS_COUNT | Proveedor: $SUPPLIER"
        echo "   ⏱️  Tiempo: ${PROC_TIME}s | Acción: $RECOMMENDED"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        ERROR=$(echo $RESPONSE | jq -r '.error_message // "Error desconocido"')
        echo "   ❌ FALLO | Error: $ERROR"
    fi
    echo ""
done

echo "=========================================="
echo "📊 RESUMEN DE TESTS"
echo "=========================================="
echo "Total: $TOTAL_TESTS"
echo "✅ Éxitos: $SUCCESS_COUNT"
echo "❌ Fallos: $FAIL_COUNT"
echo "📈 Tasa de éxito: $(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_TESTS" | bc)%"
echo ""

# Generar reporte de precisión
echo "3️⃣ Generando reporte de precisión..."
ACCURACY_REPORT="$RESULTS_DIR/accuracy_report.json"

# Calcular métricas de precisión
jq -n \
    --arg total "$TOTAL_TESTS" \
    --arg success "$SUCCESS_COUNT" \
    --arg fail "$FAIL_COUNT" \
    --arg success_rate "$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_TESTS" | bc)" \
    --arg timestamp "$(date -Iseconds)" \
    '{
        total_tests: $total,
        successful_tests: $success,
        failed_tests: $fail,
        success_rate: ($success_rate | tonumber),
        timestamp: $timestamp,
        results: []
    }' > "$ACCURACY_REPORT"

# Agregar detalles de cada test
for RESULT_FILE in "$RESULTS_DIR"/*_result.json; do
    FILENAME=$(basename "$RESULT_FILE" "_result.json")
    jq --arg filename "$FILENAME" '. + {filename: $filename}' "$RESULT_FILE" >> temp.json
done

# Combinar resultados
jq -s '.results = map(select(.success == true) | {
    filename: .filename,
    confidence: .document.confidence,
    products: .document.products | length,
    supplier: .document.supplier_name,
    recommended_action: .validation.recommended_action
})' "$ACCURACY_REPORT" temp.json > "$ACCURACY_REPORT.tmp" && mv "$ACCURACY_REPORT.tmp" "$ACCURACY_REPORT"
rm -f temp.json

echo "✅ Reporte generado: $ACCURACY_REPORT"
echo ""

# Calcular confianza promedio
AVG_CONFIDENCE=$(jq '[.results[].confidence] | add / length' "$ACCURACY_REPORT")
echo "🎯 Confianza promedio: $AVG_CONFIDENCE"

# Verificar si cumplimos el objetivo de >90%
SUCCESS_RATE=$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_TESTS" | bc)
if (( $(echo "$SUCCESS_RATE >= 90" | bc -l) )); then
    echo "✅ OBJETIVO CUMPLIDO: Tasa de éxito ≥90%"
else
    echo "⚠️  OBJETIVO NO CUMPLIDO: Tasa de éxito <90%"
fi

echo ""
echo "📁 Resultados guardados en: $RESULTS_DIR"
echo "📋 Reporte detallado: cat $ACCURACY_REPORT"