# Fase 2 — Ventas de Cuiner → contador

## Contexto
- El conector (`connectors/cuiner/`) envía las ventas cada 30 minutos a `POST /cuiner/connector/sales` → `CuinerSalesService.ingest`, que las guarda en `CuinerSaleLine`.
- Cuiner escribe cada ticket en SQL Server **al cobrarlo** (comprobado el 02/11/2026: tickets cerrados a las 00:27 ya estaban a las 00:30). `VentasCab.Fecha` es la fecha de negocio, sin hora; la hora de cierre está en `HoraCierrehh` / `HoraCierremm`.
- Bajar la tarea programada «ChefChek Conector - Ventas» de 30 a **5 min** (`connectors/cuiner/InstalarTareasProgramadas.ps1`). Es SELECT incremental por `Id_VentasCab`, coste mínimo.
- `CuinerSaleLine.status` (PENDIENTE / APLICADA…) es del **almacén** («Aplicar ventas», manual). El contador **no lo usa ni lo cambia**.

## Requisitos
- Después de cada `ingest`, aplicar al contador las líneas nuevas cuyo `(tipo, producto)` esté en `PortionCounterDish`.
  - Es automático, no hay botón: el contador tiene que estar al día sin que nadie haga nada.
- Unidades consumidas = `unidades × portionsPerSale`.
  - Ticket anulado: llega como otra línea con unidades negativas, así que **devuelve** raciones a la etiqueta de la que salieron o, si no, a la más reciente.
  - Las invitaciones también gastan raciones.
- Idempotente: único `(cuinerSaleLineId, foodLabelId)`. Si el conector reenvía, no se descuenta dos veces.
- Solo cuentan las ventas con `fecha >= createdAt` del `PortionCounterDish`, para no descontar todo el histórico al enlazar un plato.
- Líneas de modificador (`tipo='I'`): no cuentan salvo que se enlacen a propósito. Ver la memoria sobre los calamares (plato vs modificador).

## Archivos
- `backend/src/modules/cuiner/cuiner-sales.service.ts`: después de guardar, llamar a `PortionLedgerService.applySales(tenantId, lineIds)`.
  - Si el módulo `raciones` está desactivado, no hace nada.
  - Si falla, **no rompe** la ingesta: se registra el error y se reintenta en la siguiente pasada con las líneas no aplicadas.
- `portion-ledger.service.ts`: `applySales()` con FIFO (fase 1).
- Pantalla de enlace: en el contador, «Platos de Cuiner que lo gastan», con el buscador de `CuinerDish` ya existente.

## Tests
- Una venta de 2 solomillos baja 2.
- La misma línea reenviada no vuelve a bajar.
- Una línea negativa (anulación) devuelve raciones.
- Una media ración (0,5).
- Un plato enlazado hoy no descuenta las ventas de ayer.
- Con el módulo desactivado no hace nada.

## Riesgos
- **Mesas abiertas:** no cuentan hasta que se cobran. La pantalla muestra «ventas cobradas aplicadas hasta: <hora>».
- Tickets reabiertos o modificados llegan con un `Id_VentasCab` nuevo y fecha anterior: el cursor por id los recoge.
- **Cintas que llegan tarde o dos veces:** la idempotencia por línea lo cubre.
