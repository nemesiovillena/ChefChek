# Fase 3 — Pantalla «Raciones», etiquetas y avisos

## Pantalla `/dashboard/raciones` (página propia, tokens M3)
- Lista: plato · **disponibles** · mínimo · estado (OK / pocas / agotado) · etiquetas activas.
  - Ordenada por «pocas» primero.
- Cabecera: «Ventas de Cuiner aplicadas hasta: <fecha y hora de la última línea>».
- Por fila:
  - **Ajustar** (+/− con motivo obligatorio) y **Recuento** (escribir la cifra real);
  - **Historial** (movimientos con quién y cuándo);
  - **Etiquetas** (las activas con sus raciones, FIFO, y el botón Retirar).
- Bloque «Etiquetas caducadas con raciones»: botones **Siguen disponibles** (solo oculta el aviso de esa etiqueta) y **Retirar** (gastada o tirada).
- Bloque «Vendido sin etiquetar» (desfase de la fase 1) para revisar.
- `raciones.manage`: alta del contador (artículo o receta), mínimo y platos de Cuiner enlazados.
- Pensado para **móvil y iPad**:
  - inputs de 16 px (zoom de iOS);
  - nada que dependa del hover;
  - tablas apiladas en móvil;
  - `pb-28` si hay overlays fijos.

## Emitir etiqueta
- Si el artículo o la receta tiene contador: el campo **Raciones** es obligatorio y se muestra «Disponibles ahora: N → N+x».

## Avisos
- **Bajo mínimo:** se calcula tras cada movimiento.
  - Al cruzar el umbral hacia abajo: `Notification` (prioridad HIGH) a los usuarios con acceso a la sección `raciones` (`isSectionAllowed`, con `userId` para el permiso por persona). Así llega a cocina y a sala según los permisos de cada puesto.
  - Se guarda `belowMinNotifiedAt` y no se repite hasta volver a superar el mínimo.
  - **Agotado** (0): otro aviso URGENT.
- **Etiqueta caducada con raciones:** una notificación al día por contador, con el resumen, en el cron diario existente. **No descuenta.**
- Tarjeta en el resumen (dashboard) con los platos en «pocas» o «agotado».

## Archivos
- `frontend/src/app/dashboard/raciones/` (página y componentes) y `frontend/src/features/raciones/` (hooks de React Query; invalidar lista y detalle tras cada mutación).
- `frontend/src/features/modules/lib/nav-config.ts`: entrada «Raciones».
- Formulario de etiqueta en `frontend/src/app/dashboard/etiquetado/…`: campo de raciones condicionado.
- Backend: `raciones.controller.ts` (`@RequireModule('raciones')`, guards por sección) y aviso en `portion-ledger.service.ts`.

## Validación
- Tests jest del umbral (cruza o no cruza, sin repetir).
- Prueba manual en dev con agent-browser:
  1. emitir 2 etiquetas;
  2. ajustar −1;
  3. retirar;
  4. ingesta simulada de una venta;
  5. comprobar los avisos en las cuentas de cocina y de sala.
- Probar en móvil (375 px) y en modo oscuro.
