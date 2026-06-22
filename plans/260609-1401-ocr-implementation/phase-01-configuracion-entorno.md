---
title: "Phase 01: Configuración de Entorno"
description: "Configurar Google Cloud Vision API, instalar dependencias y preparar variables de entorno"
status: pending
priority: P1
effort: 1h
tags: [setup, dependencies, environment]
created: 2026-06-09
---

## Overview

Configuración inicial de Google Cloud Vision API, instalación de dependencias y preparación de variables de entorno.

## Requerimientos

### Funcionales
- API key de Google Cloud Vision configurada
- Dependencias instaladas
- Variables de entorno documentadas

### No-Funcionales
- Seguridad: API key nunca en código
- Testeabilidad: mock disponible para tests

## Architecture

```
Environment Setup
├── Google Cloud Console
│   └── Enable Cloud Vision API
│   └── Create API Key
├── Backend Dependencies
│   └── @google-cloud/vision
│   └── @types/node (ya existe)
└── Environment Variables
    ├── GOOGLE_CLOUD_VISION_API_KEY
    ├── OCR_PROVIDER (google|tesseract)
    └── OCR_MIN_CONFIDENCE
```

## Files to Modify

### backend/package.json
Agregar dependencia:
```json
{
  "dependencies": {
    "@google-cloud/vision": "^4.3.2"
  }
}
```

### backend/.env.example
Agregar:
```bash
# Google Cloud Vision API
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key-here

# OCR Configuration
OCR_PROVIDER=google
OCR_MIN_CONFIDENCE=70
OCR_ENABLE_FALLBACK=true
```

## Implementation Steps

1. **Instalar dependencia @google-cloud/vision**
   ```bash
   cd backend
   npm install @google-cloud/vision@^4.3.2
   ```

2. **Actualizar .env.example** con nuevas variables de entorno

3. **Crear guía de configuración** en `docs/google-vision-setup.md`:
   - Cómo crear proyecto en Google Cloud Console
   - Cómo habilitar Cloud Vision API
   - Cómo crear API key con restricciones
   - Cómo configurar límites de uso

4. **Verificar instalación** ejecutando:
   ```bash
   npm list @google-cloud/vision
   ```

## Security Considerations

- API key debe configurarse por entorno (development, staging, production)
- No incluir API key en git (.gitignore)
- Documentar restricciones de API key (HTTP referrers, IP addresses)

## Testing Strategy

- [ ] `npm install` exitoso
- [ ] TypeScript compila sin errores
- [ ] Dependencia verificada en package.json

## Success Criteria

- [ ] @google-cloud/vision instalado
- [ ] .env.example actualizado con nuevas variables
- [ ] Documentación de configuración creada
- [ ] Build backend exitoso sin errores

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Error al instalar dependencia | Verificar versión compatible con Node.js 18+ |
| API key expuesta en código | Documentar uso de variables de entorno |

## Next Steps

→ Fase 02: Implementación Google Vision Service