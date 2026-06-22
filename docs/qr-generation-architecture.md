# Arquitectura de Generación de Códigos QR

## Resumen

Sistema de generación de códigos QR para cartas digitales con múltiples formatos, niveles de corrección de error y opciones de personalización. Los códigos QR generados son escaneables en cualquier dispositivo móvil y redirigen a la landing page de la carta digital.

## Flujo de Generación

```
1. Solicitud de QR
   ├── Usuario selecciona carta
   ├── Configura formato y tamaño
   ├── Define colores y corrección
   └── Envía request al backend

2. Procesamiento Backend
   ├── Valida configuración
   ├── Genera URL de carta
   ├── Crea código QR
   ├── Almacena datos QR
   └── Retorna QR generado

3. Impresión y Despliegue
   ├── Descarga QR en formato seleccionado
   ├── Imprime en etiquetas/mesas
   ├── Coloca en ubicación visible
   └── Lista para escaneo

4. Escaneo por Cliente
   ├── Cliente escanea QR
   ├── Redirige a landing page
   ├── Carga carta digital
   └── Track analytics de vista
```

## Configuración de QR

### Tipos de QR

| Tipo | Descripción | Uso Recomendado | Tiempo de Vida |
|------|-------------|----------------|----------------|
| Dynamic | QR con tracking y analytics | Cartas principales | Indefinido |
| Static | QR fijo sin tracking | Cartas temporales | Indefinido |
| Temporary | QR con fecha de expiración | Eventos temporales | Definido |

### Formatos de Salida

```typescript
enum QRCodeFormat {
  SVG = 'svg',    // Vectorial, escalable sin pérdida
  PNG = 'png',    // Raster, soportado universalmente
  JPEG = 'jpeg',  // Raster, tamaño pequeño
  WEBP = 'webp',  // Raster, alta calidad compresión
}
```

### Niveles de Corrección de Error

| Nivel | Capacidad | Recuperación | Tamaño QR | Uso |
|-------|-----------|--------------|-----------|-----|
| L | ~7% | 1 de 13 módulos | +3% | Ambientes controlados |
| M | ~15% | 2 de 13 módulos | +7% | General |
| Q | ~25% | 3 de 13 módulos | +15% | Ambientes adversos |
| H | ~30% | 4 de 13 módulos | +25% | Alta calidad requerida |

### Tamaños Disponibles

```typescript
interface SizeOptions {
  small: { size: 200, description: 'Etiquetas pequeñas' };
  medium: { size: 300, description: 'Estándar mesas' };
  large: { size: 400, description: 'Carteleras' };
  xlarge: { size: 600, description: 'Stand grandes' };
  xxlarge: { size: 1000, description: 'Impresión profesional' };
}
```

## Algoritmo de Generación

### 1. Generación de URL Amigable

```typescript
function generateMenuURL(slug: string, language?: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'https://chefchek.com';
  const languagePath = language ? `/${language}` : '';
  return `${baseUrl}/menu/${slug}${languagePath}`;
}

// Ejemplos:
// https://chefchek.com/menu/carta-principal
// https://chefchek.com/menu/carta-principal/en
```

### 2. Generación de QR Code

```typescript
async function generateQRCode(
  url: string,
  config: QRCodeConfig
): Promise<string> {
  const qrOptions = {
    errorCorrectionLevel: config.errorCorrection,
    type: config.format,
    width: config.size,
    margin: 2,
    color: {
      dark: config.foregroundColor || '#000000',
      light: config.backgroundColor || '#FFFFFF',
    },
  };

  try {
    const qrCodeData = await QRCode.toDataURL(url, qrOptions);
    return qrCodeData;
  } catch (error) {
    throw new QRGenerationError('Error generando código QR');
  }
}
```

### 3. Validación de Configuración

```typescript
function validateQRConfig(config: QRCodeConfig): ValidationResult {
  const errors: string[] = [];

  if (config.size < 100 || config.size > 1000) {
    errors.push('Tamaño debe estar entre 100 y 1000px');
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(config.foregroundColor || '')) {
    errors.push('Color de frente inválido (formato HEX)');
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(config.backgroundColor || '')) {
    errors.push('Color de fondo inválido (formato HEX)');
  }

  if (config.opacity !== undefined && (config.opacity < 0 || config.opacity > 1)) {
    errors.push('Opacidad debe estar entre 0 y 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

## Almacenamiento de QR

### Estructura de Datos

```typescript
interface StoredQRCode {
  id: string;
  menuId: string;
  qrCodeData: string; // Base64
  config: QRCodeConfig;
  generatedAt: Date;
  expiresAt?: Date;
  scanCount: number;
  lastScannedAt?: Date;
}
```

### Actualización de Estadísticas

```typescript
async function updateQRStats(qrId: string): Promise<void> {
  const qr = await getQRCode(qrId);

  await qrRepository.update(qrId, {
    scanCount: qr.scanCount + 1,
    lastScannedAt: new Date(),
  });
}
```

## Optimización de Performance

### Caching de QR Generados

```typescript
const qrCache = new Map<string, string>();

async function getOrGenerateQR(
  url: string,
  config: QRCodeConfig
): Promise<string> {
  const cacheKey = `${url}-${JSON.stringify(config)}`;

  if (qrCache.has(cacheKey)) {
    return qrCache.get(cacheKey)!;
  }

  const qrCodeData = await generateQRCode(url, config);
  qrCache.set(cacheKey, qrCodeData);

  // Cache por 1 hora
  setTimeout(() => qrCache.delete(cacheKey), 3600000);

  return qrCodeData;
}
```

### Generación en Batch

```typescript
async function generateMultipleQRs(
  menus: DigitalMenu[],
  config: QRCodeConfig
): Promise<QRCodeBatchResult> {
  const results = await Promise.allSettled(
    menus.map((menu) => generateQRCodeForMenu(menu.id, config))
  );

  return {
    successful: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    results: results.map((r, i) => ({
      menuId: menus[i].id,
      status: r.status,
      data: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason.message : null,
    })),
  };
}
```

## Personalización Avanzada

### Inserción de Logo en QR

```typescript
async function generateQRWithLogo(
  url: string,
  logoUrl: string,
  config: QRCodeConfig
): Promise<string> {
  const qrCanvas = await generateQRCanvas(url, config);

  // Cargar logo
  const logoImage = await loadImage(logoUrl);

  // Calcular posición y tamaño del logo (25% del QR)
  const logoSize = config.size * 0.25;
  const logoX = (config.size - logoSize) / 2;
  const logoY = (config.size - logoSize) / 2;

  // Dibujar logo en centro con fondo blanco
  const ctx = qrCanvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);
  ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

  return qrCanvas.toDataURL(`image/${config.format}`);
}
```

### QR con Efectos Visuales

```typescript
async function generateStyledQR(
  url: string,
  style: QRStyle
): Promise<string> {
  const qrCanvas = await generateQRCanvas(url, style.config);

  if (style.roundedCorners) {
    applyRoundedCorners(qrCanvas, style.borderRadius);
  }

  if (style.shadow) {
    applyShadow(qrCanvas, style.shadowConfig);
  }

  if (style.gradient) {
    applyGradient(qrCanvas, style.gradientConfig);
  }

  return qrCanvas.toDataURL(`image/${style.config.format}`);
}
```

## Testing y Validación

### Tests Unitarios

```typescript
describe('QR Generation', () => {
  it('should generate QR code with valid config', async () => {
    const config: QRCodeConfig = {
      qrType: QRCodeType.STATIC,
      format: QRCodeFormat.PNG,
      errorCorrection: QRCodeErrorCorrection.M,
      size: 300,
    };

    const result = await generateQRCode('https://example.com', config);

    expect(result).toContain('data:image/png;base64,');
  });

  it('should reject invalid config', () => {
    const config: QRCodeConfig = {
      qrType: QRCodeType.STATIC,
      format: QRCodeFormat.PNG,
      errorCorrection: QRCodeErrorCorrection.M,
      size: 1500, // Invalid: > 1000
    };

    const validation = validateQRConfig(config);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Tamaño debe estar entre 100 y 1000px');
  });
});
```

### Tests de Escaneo Real

```typescript
async function testQRScannability(qrData: string): Promise<boolean> {
  // Escanear QR con múltiples librerías
  const scanners = [
    jsQR,
    qrcodeReader,
    html5QrCode,
  ];

  const scanResults = await Promise.allSettled(
    scanners.map((scanner) => scanner(qrData))
  );

  return scanResults.some((r) => r.status === 'fulfilled' && r.value);
}
```

## Mejores Prácticas

### Para Diseño de QR

1. **Contraste alto**: Usar colores con suficiente contraste
2. **Tamaño mínimo**: Mínimo 2x2 cm para escaneo fácil
3. **Márgenes claros**: Mantener espacio blanco alrededor
4. **Superficie plana**: Imprimir en superficie lisa
5. **Prueba antes de imprimir**: Verificar escaneo real

### Para Impresión

1. **Alta resolución**: 300 DPI mínimo
2. **Papel calidad**: Usar papel de calidad superior
3. **Laminación**: Considerar laminación para durabilidad
4. **Ubicación**: Colocar a la altura de los ojos
5. **Iluminación**: Asegurar buena iluminación del área

### Para Código

1. **Error handling**: Manejar errores de generación graceful
2. **Validación**: Validar configuración antes de generar
3. **Caching**: Cache de QR generados para performance
4. **Rate limiting**: Limitar generaciones por usuario
5. **Logging**: Log todas las generaciones con metadata

## Troubleshooting

### Problemas Comunes

**QR no escanea:**
- Verificar nivel de corrección de error (usar H)
- Aumentar tamaño del QR
- Verificar contraste de colores

**QR corrompido:**
- Revalidar configuración
- Regenerar con nivel de corrección más alto
- Verificar encoding de Base64

**Performance lenta:**
- Habilitar caching
- Reducir tamaño si no necesario
- Usar formato SVG para mejor rendimiento

## Métricas y Monitoreo

### KPIs de QR

```typescript
interface QRMetrics {
  totalGenerated: number;
  totalScanned: number;
  scanRate: number; // scanned/generated
  avgScansPerQR: number;
  topPerformingQRs: QRCodeStats[];
  errorRate: number;
}
```

### Alertas

- **Baja tasa de escaneo**: < 10% en primera semana
- **Error rate alto**: > 5% generaciones fallidas
- **QR no escaneable**: Reporte manual

## Integraciones

### Con Sistema de Analytics

```typescript
async function trackQRScan(qrId: string, scanData: ScanMetadata): Promise<void> {
  // Actualizar estadísticas del QR
  await updateQRStats(qrId);

  // Track analytics de vista de carta
  await trackMenuView({
    menuId: scanData.menuId,
    deviceId: scanData.deviceId,
    userAgent: scanData.userAgent,
    language: scanData.language,
  });
}
```

### Con Sistema de Menús

```typescript
async function syncQRWithMenu(menuId: string): Promise<void> {
  const menu = await getDigitalMenu(menuId);

  // Regenerar QR si la carta cambió
  const qrExists = await getQRCodeByMenuId(menuId);

  if (!qrExists || menu.updatedAt > qrExists.generatedAt) {
    await generateQRCode(menuId, defaultQRConfig);
  }
}
```

## API Reference

### Generar QR Code

```http
POST /api/v1/digital-menus/:menuId/qr-code
Content-Type: application/json

{
  "config": {
    "qrType": "dynamic",
    "format": "png",
    "errorCorrection": "H",
    "size": 300,
    "foregroundColor": "#000000",
    "backgroundColor": "#FFFFFF",
    "opacity": 1
  }
}

Response 201:
{
  "id": "uuid-qr-id",
  "menuId": "uuid-menu-id",
  "qrCodeData": "data:image/png;base64,...",
  "config": {...},
  "generatedAt": "2026-05-31T10:30:00Z"
}
```

### Obtener QR Code

```http
GET /api/v1/digital-menus/:menuId/qr-code

Response 200:
{
  "qrCodeData": "data:image/png;base64,...",
  "format": "png",
  "size": 300,
  "generatedAt": "2026-05-31T10:30:00Z"
}
```

## Checklist de Implementación

### Backend ✅
- [x] Servicio de generación de QR
- [x] Validación de configuración
- [x] Soporte múltiple formatos
- [x] Almacenamiento de QR generados
- [x] Tracking de escaneos

### Frontend ✅
- [x] Configurador de QR
- [x] Preview en tiempo real
- [x] Descarga de QR
- [x] Lista de QR generados

### Pendiente
- [ ] Inserción de logo en QR
- [ ] QR con efectos visuales
- [ ] Batch generation
- [ ] Tests de escaneo real

---

**Versión**: 1.0.0
**Última actualización**: 2026-05-31
**Estado**: ✅ Implementado
**Sprint**: 11 - Carta Digital QR