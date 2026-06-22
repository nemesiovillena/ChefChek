# Configuración de Google Cloud Vision API para ChefChek

Guía paso a paso para configurar Google Cloud Vision API para OCR en ChefChek.

## Requisitos Previos

- Cuenta de Google Cloud Platform (GCP)
- Proyecto de GCP creado
- Tarjeta de crédito configurada en GCP (para API usage)

---

## Paso 1: Crear o Seleccionar Proyecto en GCP

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Hacer clic en el selector de proyectos (arriba izquierda)
3. Crear nuevo proyecto o seleccionar uno existente
4. Anotar el **Project ID** (se usará más adelante)

---

## Paso 2: Habilitar Cloud Vision API

1. En el menú, ir a **APIs & Services** → **Library**
2. Buscar "Cloud Vision API"
3. Hacer clic en **Enable**
4. Esperar confirmación de que la API está habilitada

---

## Paso 3: Crear API Key

1. Ir a **APIs & Services** → **Credentials**
2. Hacer clic en **+ Create Credentials** → **API Key**
3. Google generará una API key
4. **IMPORTANTE:** Configurar restricciones de seguridad

---

## Paso 4: Configurar Restricciones de la API Key

### Restricciones de Aplicación (Application Restrictions)

**Opción A: HTTP Referrers (Recomendado para desarrollo)**

1. Editar la API Key recién creada
2. En "Application restrictions", seleccionar **HTTP referrers**
3. Agregar referrers permitidos:
   ```
   http://localhost:3001/*
   http://localhost:3000/*
   https://*.yourdomain.com/*
   ```
4. **NO** agregar `*/*` (permite cualquier origen)

**Opción B: IP Addresses (Recomendado para producción)**

1. En "Application restrictions", seleccionar **IP addresses**
2. Agregar IPs de servidores backend permitidos
3. Ejemplo: `192.168.1.100`, `203.0.113.0/24`

### Restricciones de API (API Restrictions)

1. En "API restrictions", seleccionar **Restrict key**
2. Buscar y seleccionar **Cloud Vision API**
3. Hacer clic en **Save**

---

## Paso 5: Configurar Límites de Uso (Opcional pero Recomendado)

1. Ir a **APIs & Services** → **Quotas**
2. Filtrar por **Cloud Vision API**
3. Configurar límites:
   - **Requests per day**: 1000 (development) / 10000+ (production)
   - **Requests per minute**: 60 (development) / 600+ (production)

---

## Paso 6: Configurar Variables de Entorno en ChefChek

En `backend/.env`:

```bash
# Google Cloud Vision API
GOOGLE_CLOUD_VISION_API_KEY=AIzaSyD...tu-api-key-aqui

# OCR Configuration
OCR_PROVIDER=google
OCR_MIN_CONFIDENCE=70
OCR_ENABLE_FALLBACK=true
```

**Parámetros:**
- `GOOGLE_CLOUD_VISION_API_KEY`: API key creada en Paso 3
- `OCR_PROVIDER`: `google` (primary) | `tesseract` (fallback)
- `OCR_MIN_CONFIDENCE`: Mínimo 70% de confianza para aceptar texto
- `OCR_ENABLE_FALLBACK`: Usar Tesseract si Google Vision falla

---

## Paso 7: Verificar Configuración

Ejecutar este comando para verificar que la API key funciona:

```bash
cd backend
node -e "
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_CLOUD_VISION_API_KEY
});
console.log('✅ Google Vision client initialized successfully');
"
```

---

## Paso 8: Costos y Límites

### Precios (2024)

| Servicio | Costo |
|----------|-------|
| Document Text Detection | $1.50 por 1000 páginas |
| Label Detection | $1.00 por 1000 imágenes |
| Text Detection | $1.50 por 1000 imágenes |

### Límites Gratuitos

- 1000 requests por mes (varía según región)

### Estimación para ChefChek

- 50 restaurantes × 20 facturas/día = 1000 requests/día
- Costo mensual aproximado: ~$45 USD

---

## Paso 9: Configurar Billing y Alerts

1. Ir a **Billing** → **Budget & alerts**
2. Crear presupuesto mensual (ej: $50 USD)
3. Configurar alertas por email al 80% del presupuesto
4. Esto evita sorpresas en la factura

---

## Troubleshooting

### Error: "API key not valid"

- Verificar que la API key es correcta
- Chequear restricciones de aplicación (HTTP referrers/IP)
- Asegurarse de que Cloud Vision API está habilitada

### Error: "Quota exceeded"

- Aumentar límites en Quotas page
- Verificar configuración de límites diarios
- Implementar fallback a Tesseract

### Error: "Permission denied"

- Verificar que la API key tiene permisos de Cloud Vision API
- Chequear restricciones de API

---

## Seguridad

### NUNCA:

- Commit API keys al repositorio
- Compartir API keys públicamente
- Usar la misma API key en múltiples proyectos sin restricciones

### SIEMPRE:

- Usar variables de entorno
- Configurar restricciones de aplicación
- Rotar API keys comprometidas
- Usar keys separadas por entorno (dev/staging/prod)

---

## Recursos Adicionales

- [Google Cloud Vision Documentation](https://cloud.google.com/vision/docs)
- [Vision API Pricing](https://cloud.google.com/vision/pricing)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)

---

## Soporte

Si tienes problemas configurando Google Vision API:

1. Verificar que estás usando Node.js 18+
2. Asegurarte de que la API key tiene restricciones correctas
3. Chequear que Cloud Vision API está habilitada
4. Verificar límites de quota en GCP Console

---

**Última actualización:** 2026-06-09