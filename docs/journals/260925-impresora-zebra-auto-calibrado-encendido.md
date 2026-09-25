# Impresora Zebra: por qué descuadraba cada mañana y el botón que lo arregla de una vez

**Fecha**: 2026-09-25 (tarde)
**Severity**: Media (impresión descarriada a diario en el restaurante real; sin pérdida de datos)
**Componente**: `frontend/src/lib/zebra-printer-setup.ts` (nuevo), `frontend/src/lib/zebra-browser-print.ts`, `frontend/src/app/dashboard/settings/components/zebra-printer-status.tsx`, `docs/food-labeling-system.md`
**Estado**: Sin commit (trabajo aislado sobre `feat/sicted-fase-5` con WIP de SICTED sin tocar), a la espera del usuario

## Qué pasó

Reporte del restaurante: cada mañana, tras encender los ordenadores, había que repetir el ritual de calibración en la ZD220d (luz verde fija, mantener FEED, soltar tras el 2º parpadeo) o la impresión salía descuadrada desde la primera etiqueta. Y al imprimir un lote de 15 etiquetas de "Lasaña" (mucho texto), el texto de una etiqueta se montaba sobre la siguiente.

Una sola causa raíz para ambos síntomas: **de fábrica, la acción al encender de la ZD220 no es calibrar**. Tras apagar el PC/impresora, el perfil del sensor de hueco queda desfasado y el avance falla desde la primera etiqueta; en lotes con `^PQ` el error se acumula copia a copia y el texto termina invadindo la etiqueta siguiente. El usuario confirmó que la primera etiqueta del lote ya estaba descuadrada — señal de avance, no de layout.

La solución: botón **«Preparar impresora»** en Ajustes → Etiquetas (una sola vez, idempotente) que (1) sondea el SGD `media.power_up_action` por Browser Print y, si el firmware lo admite, lo fija a `calibrate` — cada encendido re-mide el rollo solo — y (2) envía siempre `^XA^MNY^JUS^XZ` (media troquelada por hueco + configuración guardada de forma persistente). Si el firmware no soporta SGD, la UI avisa y queda la calibración manual con FEED como fallback documentado en la misma pantalla.

## La verdad brutal

**El intento anterior (commit `ee00bb4`) mandaba la config segura (`^MNY`+`^JUS`) y la calibración remota (`~JC`) juntas en un solo envío. `~JC` dejó la ZD220d en error, y el revert (`cdf522f`) se llevó por delante también la parte buena.** Empaquetar lo seguro con lo arriesgado hace que el rollback te cueste el fix entero. Esta vez `~JC` no se envía nunca: el auto-calibrado al encender usa el propio camino seguro del firmware vía SGD, con sondeo previo para no insistir si el firmware no contesta.

Segunda verdad incómoda: no pude verificar el resultado físico — la impresora está en el PC del restaurante, no aquí. La implementación está diseñada para degradar con gracia (sondeo + timeout de 4 s en `sendThenRead`, que antes podía colgarse para siempre) y avisar con una notificación distinta en cada caso. La prueba real la hace el usuario: pulsar «Preparar impresora», apagar/encender la impresora una vez, y al día siguiente imprimir la Lasaña ×15 sin calibrar a mano.

## Detalles técnicos

- `sendThenRead` envuelto en `withTimeout(4000)`: sin él, un firmware que ignora un SGD deja la promesa colgada y la UI en "cargando" eterno.
- Discriminación de soporte: respuesta vacía o con "error" al `getvar` → `config-saved-only` (notificación `warning`); respuesta con valor → `auto-calibrate-on` (notificación `success`). Ya contestaba "calibrate" → no se re-envía el setvar.
- Verificación estática completa: `tsc --noEmit`, `eslint` (3 archivos) y `next build` limpios. Sin test unitario: el frontend no tiene runner de unitarios (solo Playwright e2e) y añadir uno para esto era desproporcionado — constancia honesta.
- Radio de acción verificado: el único consumidor de `preparePrinterForDailyUse` es `zebra-printer-status.tsx`; ningún otro llamador de `sendThenRead` en el repo.
- Hipótesis secundaria descartada por ahora (YAGNI): posible exceso de interlineado natural de `^FB` sobre la banda `lineMm` reservada causando solape *dentro* de la etiqueta con textos largos. La evidencia apuntaba al avance/calibración. Si tras el fix del calibrado persistiera solape con avance recto, se investiga el interlineado — está anotado en el reporte.

## Pendiente

- Verificación física por el usuario (pulsa «Preparar impresora» → apaga/enciende una vez → al día siguiente Lasaña ×15 sin ritual manual).
- Decisión de commit: los 4 archivos del fix están limpios y separables del WIP de SICTED de la rama, pero la estrategia (commit aquí vs rama propia) la decide el usuario.
- Si el solape intra-etiqueta persiste con avance ya recto: investigar interlineado de `^FB` en `food-label-zpl-layout.util.ts`.
