# Research: totales del albarán en la página «Líneas»

Fecha: 2026-10-16 21:24 · Tipo: investigación de código (sin búsqueda web: no aplica)

## Resumen
Cambio solo de frontend, pequeño (~15–20 líneas). La página Líneas ya carga el albarán completo con `useAlbaranDetail(id)` — el mismo hook que Resumen — así que `albaran.base`, `albaran.vatTotal` y `albaran.total` ya están en memoria. No hace falta backend, ni endpoint nuevo, ni invalidar caché aparte: los `refetch()` que ya hacen las acciones de línea refrescan también los totales.

## Hallazgos
- Resumen pinta los totales en `frontend/src/app/dashboard/albaranes/[id]/resumen/page.tsx:421-483` (card «Totales»): Base imponible = `albaran.base`, IVA = `albaran.vatTotal`, Total = `albaran.total` con `formatCurrency`.
- Cabecera de Líneas: `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx:497-551` (título, badges, `AlbaranTotalMismatchNotice`, contadores, botón Confirmar).
- Ya existe aviso de descuadre (`AlbaranTotalMismatchNotice` + `lib/albaran-total-check.ts`): compara total del papel con el recalculado desde las líneas. Los totales nuevos complementan ese aviso: se ve el número aunque cuadre.
- La rama actual (`fix/albaran-recalcular-totales-al-corregir`, sin commitear) ajusta `base/vatTotal/total` por delta al corregir precio en confirmado → tras ese fix los totales mostrados en Líneas reflejarán la corrección al momento (refetch).

## Recomendación
Mostrar los 3 valores guardados del albarán (los mismos que Resumen, para que coincidan exactamente) en una fila compacta dentro del CardContent de la cabecera, p. ej. a la derecha de los contadores o debajo del subtítulo:

```
Base 120,00 € · IVA 12,00 € · Total 132,00 €   (Total en negrita/indigo como en Resumen)
```

```tsx
<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
  <span className="text-gray-500">Base <span className="font-medium text-foreground">{formatCurrency(albaran.base)}</span></span>
  <span className="text-gray-500">IVA <span className="font-medium text-foreground">{formatCurrency(albaran.vatTotal)}</span></span>
  <span className="font-semibold">Total <span className="text-indigo-600">{formatCurrency(albaran.total)}</span></span>
</div>
```

- DRY: si `formatCurrency` está definido local en Resumen, extraerlo/reutilizar el `formatEur` existente en vez de duplicar.
- Móvil: `flex-wrap`; respetar regla de tokens dark mode (no `text-gray-800/900`).
- No usar `<header>`/`<nav>` (globals.css los oculta).

## Pitfalls
- No mostrar el total recalculado en lugar del guardado: Resumen y Líneas dirían cosas distintas. El recalculado ya aparece en el aviso de descuadre cuando difiere.

## Preguntas abiertas
- ¿Ubicación exacta: fila junto a contadores (izquierda) o columna derecha bajo los badges?
- ¿Mostrar también el total recalculado de líneas siempre (no solo en descuadre)? Recomendado: no (YAGNI).
