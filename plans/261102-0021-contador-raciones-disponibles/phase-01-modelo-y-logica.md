# Fase 1 — Modelo y lógica del contador

## Contexto
- Etiquetas: `backend/src/modules/etiquetado/services/food-label.service.ts`. Ya guardan `portions` y tienen `retire` / `unretire`.
- `FoodLabel` apunta a `recipeId` (elaborado) o a `productId` (manipulado).
- `CuinerDishMap` (plato → receta o artículo) sirve para **descontar almacén**. **No se reutiliza:** el plato «Lubina a la sal» descuenta almacén por receta, pero gasta raciones del contador «Lubina», que es un artículo manipulado.

## Modelo (migración con `prisma migrate diff`; limpiar los DROP de otras ramas)
```
PortionCounter
  id, tenantId, name
  recipeId?  | productId?     // qué etiquetas suman (uno de los dos)
  minPortions Float default 0 // umbral de aviso
  belowMinNotifiedAt DateTime? // evita repetir el aviso; se limpia al volver a superar el mínimo
  unlabeledPortions Float default 0 // raciones contadas a mano sin etiqueta (recuento)
  active Boolean, createdAt, updatedAt
  @@unique([tenantId, recipeId]) @@unique([tenantId, productId])

PortionCounterDish            // platos de Cuiner que gastan raciones de este contador
  id, tenantId, counterId, tipo, producto
  portionsPerSale Float default 1   // media ración = 0,5
  @@unique([tenantId, tipo, producto])  // un plato gasta de un solo contador

FoodLabel  (+campo)
  portionsRemaining Float?     // raciones que quedan de esa etiqueta; null si no tiene contador

PortionMovement               // registro: de aquí sale el historial y la auditoría
  id, tenantId, counterId, foodLabelId?
  type  LABEL_IN | SALE | RETIRE | UNRETIRE | ADJUST | RECOUNT | VOID
  quantity Float               // + entra, − sale
  cuinerSaleLineId String?     // @@unique([cuinerSaleLineId, foodLabelId]) → idempotente
  reason String?, userId?, userName?, createdAt
```
- Disponible del contador = **`unlabeledPortions` + suma de `portionsRemaining` de sus etiquetas activas** (sin retirar ni anular).
- No se guarda un total aparte, así no se puede descuadrar.

## Reglas
- **Emitir etiqueta** de un artículo o receta con contador activo:
  - `portions` es obligatorio y > 0;
  - `portionsRemaining = portions`;
  - movimiento `LABEL_IN`.
- **Editar raciones** de una etiqueta (corrección del mismo día): ajusta `portionsRemaining` por la diferencia, nunca por debajo de 0, y crea un movimiento `ADJUST`.
- **Retirar:** movimiento `RETIRE` por las raciones que queden y `portionsRemaining` a 0. Al **deshacer** se recupera la cantidad del movimiento `RETIRE` (`UNRETIRE`).
- **Anular** etiqueta: igual que retirar, con un movimiento `VOID`.
- **Consumo FIFO** (ventas y ajustes negativos):
  - se resta de la etiqueta activa con `preparedAt` más antiguo, y si no llega, de la siguiente;
  - si no hay etiquetas suficientes, lo que falte queda en un movimiento sin etiqueta y el disponible se queda en 0, nunca negativo;
  - eso se marca como **«vendido sin etiquetar»** para revisarlo: indica que se etiquetó menos de lo real.
- **Recuento** (gerencia y cocina): se escribe la cifra real N.
  - Diferencia = N − disponible. Si es positiva, suma a `unlabeledPortions`; si es negativa, consume FIFO.
  - Movimiento `RECOUNT` con la cifra anterior, la nueva y el motivo.
- **Ajuste manual** (+/− con motivo): el positivo suma a `unlabeledPortions` y el negativo consume FIFO.
- **Orden FIFO:** primero `unlabeledPortions` (ya estaban en cámara al contar) y después las etiquetas por `preparedAt`.
- La **caducidad no toca** `portionsRemaining`.

## Archivos
- Nuevo módulo `backend/src/modules/raciones/`: `raciones.module.ts`, `portion-counter.service.ts` (CRUD del contador y sus platos) y `portion-ledger.service.ts` (FIFO, movimientos, disponible).
- Registro del módulo y sección `raciones` en `modules/constants/registry.ts` y en `role-access/constants/section-registry.ts`. Sección hija: `raciones.manage` (alta de contadores, mínimos, ajustes y recuento), para gerencia y cocina.
- `food-label.service.ts`: llamar al registro al crear, editar, retirar, deshacer la retirada y anular, **en la misma transacción**. Ojo: el soft-delete de Prisma se escapa dentro de las transacciones; usar `update`.
- Al importar `AuthGuard` hay que importar también `AuthModule`. Registrar el provider también en `exports`, no solo en los controllers.

## Tests (jest)
- FIFO: dos etiquetas, una venta que gasta parte de cada una.
- Venta sin raciones suficientes: el disponible se queda en 0 y aparece «sin etiquetar».
- Retirar y deshacer la retirada devuelven lo mismo.
- Etiqueta caducada: el disponible no cambia.
- Etiqueta de algo con contador sin raciones: error 400.
- Recuento por encima y por debajo del disponible.

## Riesgos
- **Etiquetas antiguas sin `portionsRemaining`:** no cuentan. El arranque se hace con un recuento a mano.
- **Concurrencia** entre la venta y la retirada de una misma etiqueta: transacción con `SELECT … FOR UPDATE` sobre las etiquetas del contador.
