# Captura de recetas: "la receta es demasiado larga" (tope de tokens en modelos pensantes)

**Fecha**: 2026-10-09 16:15
**Severity**: Media (bloqueaba la captura por enlace con ciertos modelos)
**Componente**: `backend/src/modules/recipe-capture/recipe-structuring.service.ts`
**Estado**: PR pendiente; al entrar en `main`, Dokploy despliega producción

## Qué pasó

Tras corregir las instrucciones (metadatos), el usuario volvió a capturar la misma receta y recibió **"La receta es demasiado larga para procesarla de una vez"**. Ese mensaje sale cuando el proveedor corta la respuesta por tope de tokens (`truncated`), no porque la receta sea larga de verdad.

## La verdad brutal

**El tope de salida estaba en 4096 tokens y los modelos "pensantes" gastan parte en razonar.** Con `gemini-3-flash-preview` y el mismo contenido, a 4096 la respuesta llegaba cortada (`truncated=true`, 495 caracteres, JSON sin cerrar); a 8192 salía entera. Reproducido antes y después con IA real. El mensaje culpaba a la receta cuando el problema era el presupuesto de tokens del modelo configurado.

## Cambio

- Tope de salida de **4096 → 8192**.
- Si aun así el proveedor corta, **un segundo intento con 16384** antes de rendirse (para modelos que razonan mucho). Si el proveedor no admite ese tope, se conserva el corte del primer intento.
- El error "demasiado larga" solo se muestra ya si los dos intentos se cortan.

## Verificación

- En vivo con el servicio real y `gemini-3-flash-preview` (el que fallaba): la URL del usuario → "Suquet de rape y cigalas", **4 pasos, 15 ingredientes**.
- `gemini-flash-lite-latest`, `gemini-3.1-flash-lite` y `gemini-3.8-flash` no se cortaban ni a 4096; siguen bien.
- Tests: 155/155 en `recipe-capture`; `tsc` en verde. Caso nuevo: si el primer intento se corta, reintenta con 16384 y devuelve la receta.

## Lo que queda sin verificar

- El modelo configurado por el cliente en producción (el error apunta a un modelo pensante de Gemini, probablemente `gemini-3-flash-preview` o similar).
- `gemini-2.5-flash` está retirado (404): quien lo tuviera configurado debe elegir otro.
