# Fase 4: Interfaz de mapeos

## Requisitos
- Nueva sección «Cuiner» (con el módulo activo), con estas pestañas (useState, siguiendo la convención de modales y pestañas del proyecto):
  1. **Proveedores:** proveedor de ChefChek ↔ proveedor de Cuiner, con sugerencias por CIF o nombre.
  2. **Artículos:** artículo de ChefChek ↔ código de Cuiner, con sugerencias por la referencia del proveedor (`ArticulosProv.RefProveedor`) o por nombre (búsqueda sin tildes).
  3. **Platos:** plato de la carta de Cuiner ↔ receta (o artículo de venta directa) de ChefChek, ordenados por volumen de ventas.
  4. **Envíos:** cola de albaranes con su estado y error, y reintento.
  5. **Ventas sin mapear:** lista de avisos.
  6. **Configuración:** centro, almacén, modo simulación o real, token y estado del conector (última conexión).
- Botón «Enviar a Cuiner» en el detalle del albarán confirmado. Muestra qué falta mapear antes de permitir el envío.

## Validación
- Prueba en el navegador con agent-browser: mapear, intentar enviar con un mapeo incompleto (debe dar error claro) y enviar en modo simulación.
- Comprobar en modo oscuro y en móvil.

## ✅ Implementada y probada en el navegador el 06/10/2026
**Backend** (`cuiner-overview.service.ts` y nuevos endpoints `overview/suppliers|products|dishes` y `catalog/search`):
- Sugerencias de proveedor: primero por CIF normalizado y, si no hay, por parecido de nombre (≥ 0,75, reutilizando `common/utils/string-similarity`).
- Sugerencias de artículo: por parecido de nombre.
- Las sugerencias nunca se guardan solas.
- Los platos de la carta se ordenan por unidades vendidas, por tipo P/I/M.

**Frontend:**
- Página `/dashboard/cuiner`, con 4 pestañas: Proveedores, Artículos, Platos, y Conector y envíos.
- En el menú, grupo Almacén, `managerOnly` y con `moduleId: cuiner`.
- `components/albaranes/cuiner-send-card.tsx` en el resumen del albarán: lista lo que falta, previsualiza y pide confirmación antes de encolar.

**Nueva protección (encontrada al probar con datos reales):** si el total calculado no cuadra con el total del albarán (±0,05 €), se bloquea el envío.
- Caso real: el albarán «860» tiene verdura al 4 % que el OCR leyó como 10 %. Habría llegado a Cuiner con 174,35 € en lugar de 164,84 €.

**Prueba en el navegador** (tenant demo, usuario temporal ya borrado):
- Enlaces aceptados desde las sugerencias: SERRA, AJOS DUROS, CEBOLLA, PATATA AGRIA.
- Selector de plato en modo artículo.
- Albarán «860» bloqueado por el total.
- Albarán de Café Jurado (47,19 €): cálculo exacto, confirmación y envío → «Pendiente del conector».
- Vista móvil a 390 px sin desbordamiento horizontal.

**Verificación:** 40 tests del módulo; suite completa del backend: 144 suites y 2109 tests; `tsc` y `eslint` del frontend limpios.
