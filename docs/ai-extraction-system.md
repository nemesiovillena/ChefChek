# Sistema de Extracción con IA

## Resumen

Sistema inteligente de extracción de datos de documentos OCR usando IA. Detecta automáticamente el tipo de documento, extrae ítems lineales, información de proveedor, fechas y totales, con cálculo de confianza para cada dato extraído.

## Arquitectura del Sistema

### Componentes

```
AI Extraction System
├── Document Type Detection
│   ├── Pattern matching
│   ├── ML classification
│   └── Confidence scoring
├── Line Item Extraction
│   ├── Product name extraction
│   ├── Quantity parsing
│   ├── Unit identification
│   ├── Price extraction
│   └── Validation
├── Supplier Info Extraction
│   ├── Name extraction
│   ├── NIF extraction
│   ├── Address extraction
│   └── Contact info extraction
├── Date Extraction
│   ├── Invoice date detection
│   ├── Due date detection
│   ├── Delivery date detection
│   └── Format normalization
└── Totals Extraction
    ├── Subtotal calculation
    ├── Tax extraction
    ├── Total extraction
    └── Validation
```

## Flujo de Extracción

```
1. Recibir Texto OCR
   ├── Obtener texto crudo
   ├── Obtener texto estructurado
   └── Calcular confianza del OCR

2. Detectar Tipo de Documento
   ├── Analizar patrones de texto
   ├── Usar clasificación ML
   ├── Determinar tipo (factura, recibo, etc.)
   └── Establecer estrategia de extracción

3. Extraer Ítems Lineales
   ├── Detectar patrones de línea de ítem
   ├── Parsear cada línea
   ├── Extraer componentes
   ├── Calcular confianza por ítem
   └── Validar datos extraídos

4. Extraer Información de Proveedor
   ├── Buscar patrones de proveedor
   ├── Extraer NIF y nombre
   ├── Extraer dirección y contacto
   ├── Calcular confianza
   └── Validar con DB existente

5. Extraer Fechas
   ├── Detectar patrones de fecha
   ├── Parsear fechas
   ├── Normalizar formato
   └── Validar razonabilidad

6. Extraer Totales
   ├── Buscar patrones de totales
   ├── Extraer subtotal
   ├── Extraer IVA/impuestos
   ├── Calcular total
   └── Validar matemática

7. Calcular Confianza Global
   ├── Promedio de confianzas de ítems
   ├── Confianza de proveedor
   ├── Confianza de fechas
   ├── Confianza de totales
   └── Determinar si necesita revisión manual

8. Generar Resultado
   ├── Compilar todos los datos
   ├── Crear resultado estructurado
   ├── Guardar en DB
   └── Notificar usuario
```

## Detección de Tipo de Documento

### Patrones de Detección

```typescript
interface DocumentTypePattern {
  type: DocumentType;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
}

const documentTypePatterns: DocumentTypePattern[] = [
  {
    type: DocumentType.INVOICE,
    patterns: [
      /^factura\s*n[º°]?\s*\d+/i,
      /^invoice\s*n[º°]?\s*\d+/i,
    ],
    keywords: ['factura', 'invoice', 'nif', 'iva'],
    priority: 10,
  },
  {
    type: DocumentType.RECEIPT,
    patterns: [
      /^recibo\s*n[º°]?\s*\d+/i,
      /^receipt\s*n[º°]?\s*\d+/i,
    ],
    keywords: ['recibo', 'receipt', 'ticket'],
    priority: 9,
  },
  {
    type: DocumentType.PURCHASE_ORDER,
    patterns: [
      /^pedido\s*n[º°]?\s*\d+/i,
      /^purchase\s*order\s*n[º°]?\s*\d+/i,
    ],
    keywords: ['pedido', 'purchase order', 'po'],
    priority: 8,
  },
  {
    type: DocumentType.DELIVERY_NOTE,
    patterns: [
      /^albar[á]n\s*n[º°]?\s*\d+/i,
      /^delivery\s*note\s*n[º°]?\s*\d+/i,
    ],
    keywords: ['albarán', 'delivery note'],
    priority: 7,
  },
  {
    type: DocumentType.PRICE_LIST,
    patterns: [
      /^lista\s*de\s*precios/i,
      /^price\s*list/i,
    ],
    keywords: ['precio', 'price', 'tarifa'],
    priority: 6,
  },
];
```

### Detección Basada en Patrones

```typescript
function detectDocumentType(text: string): DocumentType {
  const scores: Record<DocumentType, number> = {};

  for (const pattern of documentTypePatterns) {
    let score = 0;

    // Match patrones de expresión regular
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        score += 10;
      }
    }

    // Contar coincidencias de palabras clave
    for (const keyword of pattern.keywords) {
      const keywordRegex = new RegExp(keyword, 'gi');
      const matches = text.match(keywordRegex);
      if (matches) {
        score += matches.length * 5;
      }
    }

    // Sumar prioridad base
    score += pattern.priority;

    scores[pattern.type] = score;
  }

  // Devolver el tipo con mayor score
  const detectedType = Object.entries(scores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  if (detectedType[1] > 10) {
    return detectedType[0] as DocumentType;
  }

  return DocumentType.UNKNOWN;
}
```

## Extracción de Ítems Lineales

### Patrón de Línea de Ítem

```typescript
interface LineItemPattern {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  confidence: number;
}

function parseLineItem(line: string, minConfidence: number = 0.8): LineItemPattern | null {
  // Patrón: "Producto X kg 2.50 25.00"
  // Donde: X = cantidad, kg = unidad, 2.50 = precio unitario, 25.00 = total

  const regex = /^(.+?)\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/i;
  const match = line.match(regex);

  if (!match) {
    return null;
  }

  const productName = match[1].trim();
  const quantity = parseFloat(match[2]);
  const unit = match[3].trim();
  const unitPrice = parseFloat(match[4]);
  const totalPrice = parseFloat(match[5]);

  // Validar que el total sea consistente
  const calculatedTotal = quantity * unitPrice;
  const tolerance = 0.01; // 1% tolerance

  if (Math.abs(totalPrice - calculatedTotal) / calculatedTotal > tolerance) {
    return null; // Los números no son consistentes
  }

  // Calcular confianza
  const confidence = calculateLineItemConfidence(productName, quantity, unit, unitPrice, totalPrice);

  if (confidence < minConfidence) {
    return null;
  }

  return {
    productName,
    productId: undefined, // TODO: match with existing products
    quantity,
    unit,
    unitPrice,
    totalPrice,
    confidence: confidence > 0.9 ? ExtractionConfidence.HIGH : confidence > 0.7 ? ExtractionConfidence.MEDIUM : ExtractionConfidence.LOW,
    confidenceScore: confidence,
    metadata: { originalLine: line },
    needsReview: confidence < 0.9,
  };
}

function calculateLineItemConfidence(
  productName: string,
  quantity: number,
  unit: string,
  unitPrice: number,
  totalPrice: number
): number {
  let confidence = 1.0;

  // Confianza basada en nombre del producto
  if (productName.length < 3) {
    confidence -= 0.3;
  }

  if (productName.length > 50) {
    confidence -= 0.1;
  }

  // Confianza basada en valores numéricos
  if (quantity <= 0 || quantity > 1000) {
    confidence -= 0.2;
  }

  if (unitPrice <= 0 || unitPrice > 10000) {
    confidence -= 0.2;
  }

  if (totalPrice <= 0 || totalPrice > 100000) {
    confidence -= 0.2;
  }

  // Confianza basada en consistencia matemática
  const calculatedTotal = quantity * unitPrice;
  const deviation = Math.abs(totalPrice - calculatedTotal) / calculatedTotal;

  if (deviation > 0.01) {
    confidence -= 0.3;
  }

  return Math.max(0, confidence);
}
```

### Extracción en Lote

```typescript
async function extractLineItems(
  text: string,
  minConfidence: number
): Promise<ExtractedItemDto[]> {
  const lines = text.split('\n');
  const items: ExtractedItemDto[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    const item = parseLineItem(trimmedLine, minConfidence);

    if (item) {
      items.push({
        id: uuidv4(),
        ...item,
        extractionId: undefined, // Set in context
      });
    }
  }

  return items;
}
```

## Extracción de Información de Proveedor

### Patrones de Proveedor

```typescript
interface SupplierPattern {
  namePattern: RegExp[];
  nifPattern: RegExp[];
  addressPattern: RegExp[];
  contactPattern: RegExp[];
}

async function extractSupplierInfo(text: string): Promise<ExtractedSupplierInfoDto> {
  const supplierInfo: ExtractedSupplierInfoDto = {
    supplierName: '',
    supplierId: undefined,
    supplierNIF: '',
    address: '',
    phone: '',
    email: '',
    confidence: ExtractionConfidence.MEDIUM,
  };

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Extraer NIF (formato español: 8 dígitos + letra)
    const nifMatch = trimmedLine.match(/[A-Z]{8}-?\d{7}[A-Z0-9]$/);
    if (nifMatch && !supplierInfo.supplierNIF) {
      supplierInfo.supplierNIF = nifMatch[0];
    }

    // Extraer email
    const emailMatch = trimmedLine.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch && !supplierInfo.email) {
      supplierInfo.email = emailMatch[0];
    }

    // Extraer teléfono
    const phoneMatch = trimmedLine.match(/(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{3}\d+/);
    if (phoneMatch && !supplierInfo.phone) {
      supplierInfo.phone = phoneMatch[0];
    }
  }

  // Extraer nombre de proveedor
  supplierInfo.supplierName = extractSupplierName(text);

  // Calcular confianza
  supplierInfo.confidence = calculateSupplierConfidence(supplierInfo);

  return supplierInfo;
}

function extractSupplierName(text: string): string {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Patrones comunes de proveedor
    const patterns = [
      /proveedor\s*:\s*(.+)/i,
      /supplier\s*:\s*(.+)/i,
      /de\s+(.+)/i, // "De: Proveedor S.A."
      /para\s+(.+)/i, // "Para: Proveedor S.A."
    ];

    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return '';
}

function calculateSupplierConfidence(supplierInfo: ExtractedSupplierInfoDto): ExtractionConfidence {
  let confidence = 0;

  if (supplierInfo.supplierName) confidence += 0.3;
  if (supplierInfo.supplierNIF) confidence += 0.3;
  if (supplierInfo.address) confidence += 0.2;
  if (supplierInfo.phone) confidence += 0.1;
  if (supplierInfo.email) confidence += 0.1;

  if (confidence >= 0.8) return ExtractionConfidence.HIGH;
  if (confidence >= 0.5) return ExtractionConfidence.MEDIUM;
  return ExtractionConfidence.LOW;
}
```

## Extracción de Fechas

### Patrones de Fecha

```typescript
interface DatePattern {
  regex: RegExp;
  format: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
  priority: number;
}

const datePatterns: DatePattern[] = [
  {
    regex: /(\d{2})\/(\d{2})\/(\d{4})/,
    format: 'dd/mm/yyyy',
    priority: 10,
  },
  {
    regex: /(\d{2})\/(\d{2})\/(\d{4})/,
    format: 'mm/dd/yyyy',
    priority: 9,
  },
  {
    regex: /(\d{4})-(\d{2})-(\d{2})/,
    format: 'yyyy-mm-dd',
    priority: 8,
  },
];

async function extractDates(text: string): Promise<ExtractedDatesDto> {
  const dates: ExtractedDatesDto = {
    invoiceDate: undefined,
    dueDate: undefined,
    deliveryDate: undefined,
    confidence: ExtractionConfidence.MEDIUM,
  };

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Detectar patrones de fecha
    if (trimmedLine.toLowerCase().includes('fecha') ||
        trimmedLine.toLowerCase().includes('date')) {
      const dateMatch = trimmedLine.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (dateMatch) {
        const date = parseDate(dateMatch[1]);
        if (date && !dates.invoiceDate) {
          dates.invoiceDate = date;
        }
      }
    }

    // Detectar fecha de vencimiento
    if (trimmedLine.toLowerCase().includes('vencimiento') ||
        trimmedLine.toLowerCase().includes('due')) {
      const dateMatch = trimmedLine.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (dateMatch) {
        const date = parseDate(dateMatch[1]);
        if (date && !dates.dueDate) {
          dates.dueDate = date;
        }
      }
    }

    // Detectar fecha de entrega
    if (trimmedLine.toLowerCase().includes('entrega') ||
        trimmedLine.toLowerCase().includes('delivery')) {
      const dateMatch = trimmedLine.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (dateMatch) {
        const date = parseDate(dateMatch[1]);
        if (date && !dates.deliveryDate) {
          dates.deliveryDate = date;
        }
      }
    }
  }

  // Calcular confianza
  dates.confidence = calculateDatesConfidence(dates);

  return dates;
}

function parseDate(dateStr: string): Date | undefined {
  const parts = dateStr.split('/');

  if (parts.length !== 3) {
    return undefined;
  }

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return undefined;
  }

  // Validar razonabilidad de fecha
  const now = new Date();
  const currentYear = now.getFullYear();

  if (year < 2000 || year > currentYear + 1) {
    return undefined; // Fecha demasiado antigua o futura
  }

  if (month < 1 || month > 12) {
    return undefined;
  }

  if (day < 1 || day > 31) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function calculateDatesConfidence(dates: ExtractedDatesDto): ExtractionConfidence {
  let confidence = 0;

  if (dates.invoiceDate) confidence += 0.4;
  if (dates.dueDate) confidence += 0.3;
  if (dates.deliveryDate) confidence += 0.3;

  if (confidence >= 0.8) return ExtractionConfidence.HIGH;
  if (confidence >= 0.5) return ExtractionConfidence.MEDIUM;
  return ExtractionConfidence.LOW;
}
```

## Extracción de Totales

### Patrones de Totales

```typescript
async function extractTotals(text: string): Promise<ExtractedTotalsDto> {
  const totals: ExtractedTotalsDto = {
    subtotal: 0,
    tax: 0,
    total: 0,
    taxBreakdown: [],
    confidence: ExtractionConfidence.MEDIUM,
  };

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Extraer subtotal
    if (trimmedLine.toLowerCase().includes('subtotal') ||
        trimmedLine.toLowerCase().includes('base imponible')) {
      const amountMatch = trimmedLine.match(/[\d,]+\.?\d*€/);

      if (amountMatch) {
        totals.subtotal = parseFloat(amountMatch[0].replace(/,/g, '').replace('€', ''));
      }
    }

    // Extraer IVA/impuestos
    if (trimmedLine.toLowerCase().includes('iva') ||
        trimmedLine.toLowerCase().includes('impuesto')) {
      const amountMatch = trimmedLine.match(/[\d,]+\.?\d*€/);

      if (amountMatch) {
        totals.tax = parseFloat(amountMatch[0].replace(/,/g, '').replace('€', ''));
        totals.taxBreakdown.push(trimmedLine);
      }
    }

    // Extraer total
    if (trimmedLine.toLowerCase().includes('total') &&
        !trimmedLine.toLowerCase().includes('subtotal')) {
      const amountMatch = trimmedLine.match(/[\d,]+\.?\d*€/);

      if (amountMatch) {
        totals.total = parseFloat(amountMatch[0].replace(/,/g, '').replace('€', ''));
      }
    }
  }

  // Validar consistencia matemática
  const calculatedTotal = totals.subtotal + totals.tax;
  const deviation = Math.abs(totals.total - calculatedTotal) / calculatedTotal;

  if (deviation > 0.01) {
    totals.confidence = ExtractionConfidence.LOW;
  } else {
    totals.confidence = ExtractionConfidence.HIGH;
  }

  return totals;
}
```

## Cálculo de Confianza Global

```typescript
function calculateOverallConfidence(extraction: AIExtractionResultDto): number {
  const confidences: number[] = [];

  // Confianza de ítems
  if (extraction.items && extraction.items.length > 0) {
    const itemConfidences = extraction.items.map((item) => item.confidenceScore || 0);
    const avgItemConfidence = itemConfidences.reduce((sum, conf) => sum + conf, 0) / itemConfidences.length;
    confidences.push(avgItemConfidence);
  }

  // Confianza de proveedor
  const supplierConfidence = extraction.supplierInfo.confidence === ExtractionConfidence.HIGH ? 1 : 0.8;
  confidences.push(supplierConfidence);

  // Confianza de fechas
  const datesConfidence = extraction.dates.confidence === ExtractionConfidence.HIGH ? 1 : 0.8;
  confidences.push(datesConfidence);

  // Confianza de totales
  const totalsConfidence = extraction.totals.confidence === ExtractionConfidence.HIGH ? 1 : 0.8;
  confidences.push(totalsConfidence);

  // Promedio de todas las confianzas
  const overallConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

  return overallConfidence;
}
```

## Checklist de Implementación

### Detección de Documento ✅
- [x] Patrones de detección
- [x] Clasificación ML
- [x] 6 tipos de documento
- [x] Sistema de prioridad

### Extracción de Ítems ✅
- [x] Patrón de línea de ítem
- [x] Parsing de componentes
- [x] Validación matemática
- [x] Cálculo de confianza
- [x] Lote extraction

### Información de Proveedor ✅
- [x] Extracción de NIF
- [x] Extracción de email
- [x] Extracción de teléfono
- [x] Extracción de dirección
- [x] Cálculo de confianza

### Fechas ✅
- [x] Detección de fecha de factura
- [x] Detección de fecha de vencimiento
- [x] Detección de fecha de entrega
- [x] Parseo y validación
- [x] Cálculo de confianza

### Totales ✅
- [x] Extracción de subtotal
- [x] Extracción de IVA
- [x] Extracción de total
- [x] Validación matemática
- [x] Cálculo de confianza

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 13 - Ingesta Omnicanal - OCR + IA