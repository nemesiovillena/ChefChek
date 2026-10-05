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
