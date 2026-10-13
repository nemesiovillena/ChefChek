# Research: IVA incorrecto en albarán confirmado bloquea el envío a Cuiner

Fecha: 2026-10-12 17:16 · Fuente: código del repo (sin búsqueda web; problema interno)

## Resumen

- Caso: calculado 92,54 € vs papel 101,80 €. `92,54 / 1,10 = 84,13` y `84,13 × 1,21 = 101,80` → base 84,13 €, líneas al 10 % que son al 21 %. Cuadra al céntimo.
- El bloqueo de edición en CONFIRMADO es correcto para precio/cantidad/artículo, pero **demasiado amplio para el IVA**: el IVA de línea no alimenta stock, costes, histórico de precios ni conciliación de pedido.
- El error se detecta tarde: la comprobación de total solo existe en la tarjeta Cuiner, que solo aparece con el albarán ya confirmado (y ya no editable). Callejón sin salida por diseño.

## Evidencia

| Hecho | Dónde |
|---|---|
| Comprobación total calculado vs papel, tolerancia 0,05 € | `backend/src/modules/cuiner/cuiner-export.service.ts:164-178` |
| Tarjeta Cuiner solo visible si CONFIRMADO | `frontend/src/app/dashboard/albaranes/[id]/resumen/page.tsx:514` |
| `updateLine` rechaza todo en CONFIRMADO/ARCHIVADO (incluye `vatPercent`) | `backend/src/modules/albaranes/albaranes.service.ts:266-290` |
| Celda IVA editable solo si línea PENDIENTE | `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx:733-746` |
| Precedentes de corrección post-confirmación acotada | `updateDate` (`:249`), `correctConfirmedLinePrice` (`:354`) |
| Usos de `vatPercent` en backend | payload Cuiner; `priceWithVat` de la línea; pista OCR del proveedor (`albaran-stock.service.ts:468-495`) |
| `albaran.total` = total leído del papel; `updateLine` no lo recalcula | `albaranes.service.ts:773`, `:962-973` (solo `addLine` recalcula) |

Consecuencia: corregir el IVA de una línea confirmada solo cambia `vatPercent` + `priceWithVat`. Nada que re-sincronizar.

## Opciones

| | Opción | Veredicto |
|---|---|---|
| A | Corrección de IVA en albarán confirmado (endpoint acotado, como fecha/precio) | **Recomendada** |
| B | Aviso de descuadre ANTES de confirmar (resumen/líneas, no bloqueante) | **Recomendada** (ataca la causa) |
| C | «Reabrir» albarán CONFIRMADO → REVISADO | Descartada: stock, ofertas, histórico y pedido ya asentados; riesgo alto |
| D | Quitar o relajar la comprobación de Cuiner | Descartada: metería IVA erróneo en contabilidad |
| E | Corregir a mano en BD cada vez | Solo como parche puntual |

## Recomendación (A + B)

**A. Corregir IVA post-confirmación**
- Backend: `PUT /albaranes/:id/lines/:lineId/correct-vat` → valida estado CONFIRMADO, IVA dentro de los tipos que existen en Cuiner (`vatCodeFor`), actualiza `vatPercent` y `priceWithVat`. Sin tocar stock/precios.
- Rechazar si el export a Cuiner está `ENVIADO` (ya está allí: se corrige en Cuiner a mano, mismo criterio que la fecha) o `PENDIENTE` (payload congelado en cola).
- Frontend: celda IVA editable con el mismo lápiz ámbar que el precio, en líneas de albarán confirmado. Invalidar detalle + listado + query `['cuiner','albaran',id]`.
- No recalcular `albaran.total`: es el total del papel y la referencia de la comprobación.

**B. Aviso antes de confirmar**
- Misma cuenta que hace Cuiner (bases por tipo de IVA + cuotas) comparada con `albaran.total`, mostrada en resumen/líneas mientras el albarán está PENDIENTE/REVISADO. Aviso, no bloqueo (albaranes sin total leído, `total = 0`, no avisan).
- Reutilizar la lógica del payload para no duplicar el cálculo (DRY).

## Riesgos / notas

- La pista OCR del proveedor aprende el «IVA típico» al confirmar (`albaran-stock.service.ts:468-495`): un albarán confirmado con IVA erróneo puede sesgar las siguientes lecturas de ese proveedor. Corregir el IVA después no reescribe la pista. Sin verificar cuánto pesa esa pista en la lectura con IA directa.
- ARCHIVADO: no se envía a Cuiner (solo CONFIRMADO), no hace falta abrirlo.

## Preguntas abiertas

1. ¿Corregir IVA línea a línea basta, o hace falta «aplicar X % a todas las líneas» (albaranes largos)?
2. ¿El aviso previo se muestra a todos los tenants o solo a los que tienen Cuiner activo?
3. ¿Arreglamos el albarán actual en producción por BD ya, o espera al despliegue de A?
4. ¿Revisar la pista OCR de IVA del proveedor afectado?
