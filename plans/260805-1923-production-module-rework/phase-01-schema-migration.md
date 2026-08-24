# Fase 1: rediseño de schema Prisma + migración

## Status (2026-08-05)
**Completada en dev.** Resumen de lo ejecutado (difiere ligeramente del plan original en el mecanismo, no en el resultado):
- Se encontraron filas de seed/demo (1 por tabla, `createdAt` 2026-06-28, contenido tipo "Lote de paellas") en `work_batches`/`production_orders`/`production_alerts`/`staff_members`/`progress_trackings`/`task_assignments` en dev. El usuario confirmó descartarlas (no eran datos reales de tenant).
- Se repuntó `TaskAssignment.taskId` de `Task` (módulo sprint) a `ProductionTask` (nuevo) — esto dejó huérfano el back-relation `Task.taskAssignments`, que se eliminó del modelo `Task` (sin uso en código, verificado con grep).
- `npx prisma migrate dev` no es utilizable en este entorno (requiere TTY interactivo, no disponible). Workflow usado en su lugar: `prisma migrate diff --from-url ... --to-schema-datamodel ... --script` para generar el SQL, revisión manual línea por línea, SQL colocado a mano en `prisma/migrations/20260805192254_production_module_rework/migration.sql`, aplicado con `prisma migrate deploy` (no interactivo, sí dispara historial de migraciones igual que `migrate dev`).
- `npx prisma generate` regenerado. `npx tsc --noEmit` sin errores nuevos (el resto del backend no se rompió).
- **Pendiente**: aplicar esta misma migración en producción (backup previo obligatorio, ver `plan.md` § Riesgo principal) — no se ha tocado producción todavía. `production.service.ts`/DTOs siguen escritos contra el schema viejo (fase 2 pendiente) — el módulo NO es funcional todavía aunque el schema ya esté migrado en dev.

## Contexto
- Modelos actuales en `backend/prisma/schema.prisma:944-1099` (`StaffMember`, `TaskAssignment`, `WorkBatch`, `ProgressTracking`, `ProductionOrder`, `ProductionAlert`, `MiseEnPlaceSheet`, `MiseEnPlaceItem`).
- `Task`/`Sprint` (`schema.prisma:504-529`) son del módulo `sprint` (gestión de proyectos interno) — uso confirmado exclusivo en `backend/src/modules/sprint/*`, sin cruces con producción. No tocar esos modelos.
- Convención de migraciones: `backend/prisma/migrations/<timestamp>_<snake_case_description>/`, ver últimas en el directorio para el patrón de nombre.
- Nota memoria [[two-postgres-databases-dev]]: hay dos Postgres en dev (brew :5432 vs docker :5433); confirmar cuál usa el backend en :3001 antes de correr `prisma migrate dev`.

## Cambios de modelo

### `WorkBatch` (modificar)
Añadir:
```prisma
priority     String    // LOW, MEDIUM, HIGH, URGENT — @default("MEDIUM")
responsible  String[]  @default([])
kitchenZone  String    // HOT_KITCHEN, COLD_KITCHEN, ... — @default("HOT_KITCHEN")
deletedAt    DateTime?

productionOrders ProductionOrder[]
```
`scheduledFor` ya existe y es correcto (el bug estaba en el *servicio*, que usaba `scheduledDate` — se corrige en fase 2, no aquí).

### `ProductionOrder` (modificar)
Añadir:
```prisma
batchId       String
recipeId      String
recipeName    String
quantity      Float
unit          String
estimatedTime Float
deletedAt     DateTime?

batch            WorkBatch          @relation(fields: [batchId], references: [id], onDelete: Cascade)
tasks            ProductionTask[]
progressTracking ProgressTracking?
milestones       Milestone[]
alerts           ProductionAlert[]
miseEnPlaceItems MiseEnPlaceItem[]
```
Eliminar el campo `miseEnPlaceItems Json?` (duplicaba, con otro tipo, la relación real a `MiseEnPlaceItem` — confuso y sin uso real; usar solo la relación). Mantener `items Json?` para el snapshot de ingredientes (`ProductionIngredientDto[]`).

### `ProductionTask` (nuevo)
```prisma
model ProductionTask {
  id            String    @id @default(cuid())
  tenantId      String
  orderId       String
  title         String
  taskType      String    // PREPARATION, COOKING, PLATING, QUALITY_CHECK
  estimatedTime Float
  dependencies  String[]  @default([])
  status        String    @default("PENDING") // PENDING, ASSIGNED, IN_PROGRESS, COMPLETED
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant     Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order      ProductionOrder  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  assignments TaskAssignment[]

  @@map("production_tasks")
}
```

### `TaskAssignment` (modificar)
- Cambiar la relación `task Task @relation(...)` por `productionTask ProductionTask @relation(fields: [taskId], references: [id], onDelete: Cascade)`.
- Añadir `actualTime Float?` (usado por `updateTaskAssignment`, hoy no existe en el modelo).
- Añadir `orderId String` (denormalizado, evita tener que atravesar `taskId → ProductionTask → orderId` en cada query de listado).

### `MiseEnPlaceSheet` (modificar)
Convertir `batchId`/`orderId` de string plano a relación real:
```prisma
batch WorkBatch       @relation(fields: [batchId], references: [id], onDelete: Cascade)
order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
```

### `MiseEnPlaceItem` (modificar)
- Añadir `tenantId String` (falta hoy — causa raíz del IDOR en `updateMiseEnPlaceItem`, que no puede filtrar por tenant porque el campo no existe).
- Cambiar `orderId` de string plano a relación real: `order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)`.

### `ProductionAlert` (modificar)
Añadir:
```prisma
orderId    String
resolution String?

order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
```
Nota para fase 2: el campo real se llama `alertType` (no `type`) y `isResolved Boolean` ya existe — el servicio debe setear ambos (`isResolved: true` + `resolvedAt`) al resolver, no solo `resolvedAt`.

### `Milestone` (nuevo)
```prisma
model Milestone {
  id            String    @id @default(cuid())
  orderId       String
  name          String
  percentage    Int
  scheduledTime DateTime
  completedAt   DateTime?
  status        String    @default("PENDING") // PENDING, COMPLETED

  order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("milestones")
}
```

### `ProgressTracking` (modificar — rediseño)
Hoy está modelado por lote (`workBatchId`); el código lo usa por orden. Cambiar a 1:1 con `ProductionOrder`:
```prisma
model ProgressTracking {
  id              String   @id @default(cuid())
  orderId         String   @unique
  overallProgress Float    @default(0)
  timeElapsed     Int      @default(0)
  timeRemaining   Int      @default(0)
  status          String   @default("ON_SCHEDULE") // ON_SCHEDULE, DELAYED, AHEAD, CRITICAL
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("progress_trackings")
}
```
Se elimina `workBatchId`/`taskId`/`progress`/`notes`/`trackedBy`/`trackedAt` del modelo anterior (sin uso real hoy, confirmar con `grep -rn "progressTracking" backend/src` antes de borrar que ningún otro sitio los usa).

### `ProductionReport` (nuevo)
```prisma
model ProductionReport {
  id               String   @id @default(cuid())
  tenantId         String
  batchId          String
  totalOrders      Int
  completedOrders  Int
  completionRate   Float
  avgActualTime    Float
  avgEstimatedTime Float
  efficiency       Float
  generatedAt      DateTime @default(now())

  tenant Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  batch  WorkBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  @@map("production_reports")
}
```

### `Tenant` (modificar)
Añadir back-relations que Prisma exige: `productionTasks ProductionTask[]`, `productionReports ProductionReport[]` (junto a las ya existentes `productionAlerts`, `productionOrders` — verificar en `schema.prisma:50-51` si ya están o si hace falta añadirlas).

## Pasos

**La app ya está en producción con datos reales de otros tenants — la BD que se migra es la misma para todo, aunque las tablas de este módulo en concreto sean nuevas/sin uso real.** Regla no negociable [[zero-data-loss-mandatory-rule]]: backup obligatorio antes de tocar nada, sin excepción.

1. **Backup/snapshot de la BD de producción** antes de cualquier `migrate deploy` contra ella (confirmar con el usuario el mecanismo — Dokploy suele tener snapshot de volumen/backup programado, o `pg_dump` manual).
2. Identificar qué Postgres local usa el backend en dev (:3001) para probar ahí primero (memoria [[two-postgres-databases-dev]] — brew :5432 vs docker :5433 divergen).
3. `SELECT COUNT(*) FROM work_batches; SELECT COUNT(*) FROM production_orders; SELECT COUNT(*) FROM production_alerts; SELECT COUNT(*) FROM mise_en_place_sheets; SELECT COUNT(*) FROM mise_en_place_items;` contra dev y (con el backup ya hecho) contra producción — confirmar que son 0 o solo basura de pruebas antes de decidir si algún `DROP COLUMN` (el `miseEnPlaceItems Json?` duplicado) es seguro. Si aparece cualquier fila inesperada, parar y preguntar al usuario antes de continuar.
4. Editar `schema.prisma` con todos los cambios anteriores. Todos los campos nuevos `required` en tablas que puedan tener filas (`WorkBatch.priority/kitchenZone`, etc.) llevan `@default(...)` para que el `ALTER TABLE` no pueda fallar ni truncar nada aunque el conteo del paso 3 resultara no ser cero.
5. `npx prisma format` para validar sintaxis.
6. `npx prisma migrate dev --name production_module_rework` **en dev primero** (nombre de migración descriptivo del comportamiento, no de fase/plan — regla del usuario: nada de IDs de plan/fase en artefactos de código).
7. Revisar el SQL generado línea por línea antes de aplicarlo en producción — usar `--create-only` para poder inspeccionar el archivo SQL sin ejecutarlo, especialmente cualquier `DROP COLUMN`/`DROP TABLE`.
8. Validar el resultado en dev (fase 2+3 mínimas funcionando) antes de replicar en producción.
9. En producción: con el backup del paso 1 ya confirmado como restaurable, aplicar la migración en ventana de bajo tráfico (`npx prisma migrate deploy`).
10. `npx prisma generate` para regenerar el client (dev y producción).

## Archivos a modificar
- `backend/prisma/schema.prisma`
- Nueva carpeta de migración en `backend/prisma/migrations/`

## Riesgos / rollback
- Riesgo principal del plan entero: cambio de schema contra la BD de producción compartida. Mitigado con backup previo (paso 1), `@default(...)` en todos los campos nuevos required, verificación de conteos (paso 3), y validación completa en dev antes de tocar producción (pasos 6-8).
- Rollback: `prisma migrate resolve --rolled-back <nombre>` + restaurar `schema.prisma` del commit anterior si la migración falla a mitad. Si ya se aplicó en producción y algo se rompe, restaurar desde el backup del paso 1 — por eso el backup se confirma como restaurable ANTES de aplicar, no después.
- No aplicar en producción bajo ninguna circunstancia sin el backup del paso 1 confirmado y sin haber validado primero en dev.
