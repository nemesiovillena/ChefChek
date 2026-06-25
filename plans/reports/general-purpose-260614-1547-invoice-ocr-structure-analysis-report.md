# Invoice Structure Analysis Report
## OCR Analysis of Spanish Supplier Invoice

### 1. FORMATO EXACTO DE LA TABLA DE PRODUCTOS

**Separador de columnas:** ESPACIOS (alineación visual)
- No se usan pipes (|) o tabs como separadores explícitos
- Las columnas están alineadas visualmente con espacios múltiples
- El OCR muestra inconsistencia en el espaciado debido a la calidad de la imagen

**Columnas detectadas (basado en líneas de producto):**
1. Código de producto (ej: "1000022", "00002")  
2. Descripción del producto (ej: "PATATA AGRIA", "CEBOLLAS")
3. Datos adicionales (posiblemente código EAN o referencia interna)
4. Cantidad/Precio unitario (ej: "50,00", "18,00")
5. Otros valores numéricos (ej: "0,880", "0,800")
6. Total o valor adicional (ej: "4,900", "12,00")

---

### 2. EJEMPLOS REALES DE LÍNEAS DE PRODUCTOS

**Línea 1:**
```
1000022 PATATAAGRIA p24iooe26 50,000,880 4900
```

**Línea 2:**
```
00002 CEBOLLAS cd24100626 18,00 0,800 12,00
```

**Formato exacto detectado:**
- Los espacios son inconsistentes debido al OCR
- Números decimales usan COMA como separador (,)
- No hay símbolo de € visible en el OCR
- Estructura aproximada: `CÓDIGO DESCRIPCIÓN REF_DATA CANTIDAD PRECIO TOTAL`

---

### 3. CABECERAS Y ESTRUCTURA

**Cabeceras:** No detectadas claramente en el OCR
- El encabezado de la tabla no es visible en la extracción
- Probablemente está en una parte de la imagen que el OCR no capturó bien

**Separadores visuales entre filas:**
- No se detectaron líneas horizontales claras
- Los productos parecen estar en líneas separadas
- Hay 3 pipes (|) detectados en el texto completo, pero NO en las líneas de producto

---

### 4. FORMATO DE PRECIOS

**Separador decimal:** COMA (,)
- Todos los números decimales detectados usan coma
- Ejemplos: "50,00", "0,880", "18,00", "0,800", "4,900", "12,00"

**Símbolo €:** NO PRESENTE
- No se detecta el símbolo de euro en el OCR
- Es posible que esté en una parte no capturada o el formato no lo incluya

**Formato numérico detectado:**
- Enteros: ej "1000022", "00002" (códigos)
- Decimales: ej "50,00", "0,880" (2 o 3 decimales)
- Sin separador de miles (no se detectaron puntos como separador de miles)

---

### 5. PATRONES REGEX SUGERIDOS PARA PARSING

**Patrón básico de línea de producto:**
```regex
^(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+(\w+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)$
```

**Componentes del regex:**
1. `^(\d+)` - Código de producto (números al inicio)
2. `\s+([A-ZÁÉÍÓÚÑ\s]+?)` - Descripción (texto en mayúsculas)
3. `\s+(\w+)` - Referencia/EAN (texto corto)
4. `\s+(\d+[,.]\d+)` - Cantidad/precio unitario (número decimal)
5. `\s+(\d+[,.]\d+)` - Segundo valor numérico
6. `\s+(\d+[,.]\d+)$` - Total/tercer valor numérico

**Patrón flexible (recomendado para producción):**
```regex
^(\d{4,8})\s*([A-ZÁÉÍÓÚÑ\s]{3,30})\s*(\w{4,15})\s*(\d+[,.]\d{2,3})\s*(\d+[,.]\d{2,3})\s*(\d+[,.]\d{2,3})\s*$
```

**Mejoras para robustez:**
```typescript
// Pre-procesamiento antes del regex
const cleanLine = line.replace(/\s+/g, ' ').trim();
const flexibleRegex = /^(\d+)\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*(\w+)\s*(\d+[,.]\d+)\s*(\d+[,.]\d+)\s*(\d+[,.]\d+)\s*$/;

// Soporte para ambos separadores decimales
const normalizeNumber = (num: string): number => {
  return parseFloat(num.replace(',', '.'));
};
```

---

### 6. RECOMENDACIONES PARA IMPLEMENTACIÓN OCR

**Pre-procesamiento de imagen:**
1. Aumentar contraste y nitidez
2. Aplicar corrección de perspectiva
3. Reducir ruido con filtros
4. Usar alta densidad (300 DPI)

**Configuración Tesseract:**
```bash
tesseract input.jpg output --psm 6 -l eng+spa --oem 3
```
- `--psm 6`: Assume uniform block of text
- `-l eng+spa`: Español e inglés para mejor reconocimiento
- `--oem 3`: Default LSTM OCR engine

**Post-procesamiento del texto:**
1. Unificar espacios múltiples
2. Corregir caracteres mal reconocidos
3. Validar patrones numéricos
4. Aplicar regex robustos

---

### 7. ESTRUCTURA DE DATOS SUGERIDA

```typescript
interface InvoiceProduct {
  code: string;           // "1000022"
  description: string;    // "PATATA AGRIA"
  reference: string;      // "p24iooe26"
  quantity: number;       // 50.00 (normalizado a punto decimal)
  unitPrice: number;      // 0.88 (normalizado)
  total: number;          // 4.90 (normalizado)
}
```

---

### 8. PROBLEMAS DETECTADOS Y SOLUCIONES

**Problema 1: OCR inconsistente en espacios**
- **Solución:** Usar regex flexibles con `\s*` en lugar de `\s+`
- **Solución:** Pre-procesar texto para unificar espacios

**Problema 2: Separador decimal coma vs punto**
- **Solución:** Normalizar siempre a punto decimal internamente
- **Solución:** Regex que acepte ambos separadores `[,.]`

**Problema 3: Calidad variable del OCR**
- **Solución:** Múltiples patrones regex con fallback
- **Solución:** Validación de datos (rangos esperados)

**Problema 4: Referencias EAN mal reconocidas**
- **Solución:** Regex permisivos para campos opcionales
- **Solución:** No depender críticamente de este campo

---

### 9. EJEMPLO DE IMPLEMENTACIÓN

```typescript
function parseInvoiceProductLine(line: string): InvoiceProduct | null {
  // Pre-procesamiento
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Regex con grupos de captura
  const productRegex = /^(\d+)\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*(\w+)\s*(\d+[,.]\d+)\s*(\d+[,.]\d+)\s*(\d+[,.]\d+)\s*$/;
  
  const match = cleanLine.match(productRegex);
  if (!match) return null;
  
  // Normalización de números
  const normalizeNumber = (num: string): number => {
    return parseFloat(num.replace(',', '.'));
  };
  
  return {
    code: match[1],
    description: match[2].trim(),
    reference: match[3],
    quantity: normalizeNumber(match[4]),
    unitPrice: normalizeNumber(match[5]),
    total: normalizeNumber(match[6])
  };
}

// Ejemplo de uso:
const productLine = "1000022 PATATAAGRIA p24iooe26 50,000,880 4900";
const product = parseInvoiceProductLine(productLine);
console.log(product);
```

---

### 10. CONCLUSIONES

**Formato crítico identificado:**
- ✅ Separador decimal: COMA (,)
- ✅ Separador columnas: ESPACIOS (visual)
- ✅ Estructura: 6 campos por línea de producto
- ❌ Sin símbolo de €
- ❌ Sin cabeceras claras detectadas

**Para implementación OCR robusta:**
1. Usar pre-procesamiento de imagen
2. Aplicar regex flexibles con múltiples patrones
3. Normalizar formatos numéricos (coma → punto)
4. Implementar validación y fallback
5. Considerar el uso de múltiples OCR engines para verificación

---

**Status:** DONE
**Confianza del análisis:** 75% (basado en OCR limitado, se recomienda verificación con más imágenes de albaranes reales)