# Fase 3 — PWA instalable (opcional)

## Objetivo
Que `/dashboard/albaranes/subir` se pueda instalar como icono en la home screen del móvil → acceso de un toque → cámara → subida.

## Precondición
Fase 1 validada en móvil real: el flujo cámara→upload→OCR ya funciona en el navegador.

## Tareas
- `frontend/public/manifest.webmanifest` (o `.json`): name, short_name, icons (192/512), start_url `/dashboard/albaranes/subir`, display `standalone`, theme/background color.
- `<link rel="manifest">` + meta `theme-color` + apple-touch-icon en `frontend/src/app/layout.tsx`.
- Iconos en `frontend/public/` (reutilizar el logo del proyecto; 192px y 512px mínimo).

## Service worker (sólo si se quiere offline shell)
- Evaluar `next-pwa` o SW mínimo. YAGNI: si con start_url standalone basta para el caso de uso (un-toque desde home), posponer el SW.

## Validación
- Lighthouse "Installable" = ✓.
- Instalar en móvil → icono → abre standalone → cámara → sube.

## Decisión
Ejecutar sólo si el usuario confirma tras probar la fase 1 en su móvil.
