# Fase 5: frontend de Alertas de producción y Reporte de KPIs

## Status (2026-08-06)
**Completada y verificada en navegador real.** Se tomó la opción "Recomendado" del contexto de abajo sin bloquear en pregunta al usuario (autorizado a avanzar el plan y revisar al final): las alertas de retraso puentean al modelo genérico `Alert` — cero UI nueva de alertas, se ven en la campana existente junto al resto de notificaciones. Esta fase quedó reducida a solo el reporte de KPIs, tal como preveía el contexto original.

**Bug real encontrado (otra vez heredado del stub original) al conectar la campana**: `checkForDelays` tenía la condición invertida — comprobaba `tracking.status === "DELAYED"` para **no** crear la alerta, cuando debía ser justo lo contrario. En la práctica esto significaba que las alertas de retraso **nunca se habían disparado**, ni siquiera antes de este rework (el bug ya estaba en el código original). Corregido, más una guarda nueva contra alertas duplicadas mientras el pedido siga retrasado sin resolver (no existía ninguna deduplicación real antes).

Implementación:
- `NotificationsService.notifyProductionDelay()` (nuevo wrapper, mismo patrón que `notifyPriceChange`) — `backend/src/modules/core/notifications.service.ts`.
- `ProductionModule` ahora importa `CoreModule` (aunque es `@Global()`, se importa explícito por consistencia con el resto del código, ej. `albaranes.module.ts`).
- `production-report-dialog.tsx` — rango de fechas + tarjetas de KPI (completado, eficiencia, entregas a tiempo, utilización de personal, duración media de tarea, nº de alertas). Botón "Reporte" añadido junto a "Actualizar"/"Nuevo lote".
- Los endpoints de `ProductionAlert` (`GET/PUT alerts`) de fase 2 se mantienen intactos en el backend (usables vía API), simplemente no tienen UI dedicada — decisión consciente, no un olvido.

## Validación manual — resultado
1. ✅ Backdatear un pedido (SQL directo, no hay forma realista de esperar tiempo real en pruebas) y completarlo → se crea `ProductionAlert` (`GET /production/alerts` la devuelve) **y** aparece en la campana general (`GET /alerts`, contador de la campana sube a 2 en la UI).
2. ✅ Generar reporte con rango de fechas correcto → 100% completado, eficiencia 2.0% (10 min estimados vs 500 min reales, matemática correcta), 1 alerta contabilizada.
3. ✅ (arreglado tras encontrarlo) Primer intento con rango `2026-08-01` a `2026-08-06` dio todo en cero porque `endDate` se enviaba como medianoche UTC de ese día, dejando fuera todo lo ocurrido "hoy". Fix aplicado en `production-report-dialog.tsx`: `endDate` ahora se envía como fin de día (`23:59:59.999`), inclusive — probado de nuevo, correcto.


## Contexto
- Depende de fase 2 (schema/servicio corregidos) y fase 3 (lotes/órdenes reales generando alertas por retraso).
- **Hallazgo relevante**: ya existe un modelo genérico `Alert` (`schema.prisma`, `@@map("alerts")`) que alimenta la campana de notificaciones del frontend (`use-notifications.ts`, memoria [[notificaciones-precio-alert-websocket-bridge-plan]] — puente WebSocket ya construido para alertas de variación de precio). `ProductionAlert` es un modelo aparte, sin UI, sin puente a la campana.
- **Decisión a confirmar con el usuario antes de construir una UI de alertas nueva**: por DRY, ¿las alertas de retraso de producción deberían emitirse como filas de `Alert` (reutilizando la campana + WebSocket ya existentes, cero UI nueva que mantener) en vez de mantener `ProductionAlert` como tabla/UI aislada? Si la respuesta es sí, esta fase se reduce a: en `checkForDelays` (backend, fase 2) crear también una fila en `Alert` con `type`/`alertType` acordes, y esta fase pasa a ser solo "reporte de KPIs" (sin UI de alertas dedicada). Si la respuesta es no (se quiere una vista de alertas específica de cocina, separada de la campana general), se construye lo descrito abajo.

## Requisitos (si se mantiene `ProductionAlert` con UI propia)

### Alertas activas
- `frontend/src/app/dashboard/production/components/active-alerts-panel.tsx`: lista de alertas no resueltas (`GET production/alerts`), con severidad (`INFO`/`WARNING`/`ERROR`/`CRITICAL`) como badge de color, ligadas a su orden/lote (mostrar `orderNumber`/`batchNumber` para navegar al detalle).
- Botón "Resolver" por alerta → diálogo con campo de texto para `resolution` (obligatorio, mismo patrón que otros módulos que piden motivo en acciones irreversibles — ver `revertir-estado-pedido-compra` como precedente de "motivo obligatorio").

### Reporte de KPIs
- `frontend/src/app/dashboard/production/components/production-report-dialog.tsx`: formulario de rango de fechas + filtro opcional de lotes/zona → `POST production/reports`.
- Vista de resultado: tarjetas de KPI (tasa de completado, eficiencia, entregas a tiempo, utilización de personal, duración media de tarea, nº de alertas) — reutilizar componentes de tarjeta KPI ya existentes en `dashboard` (memoria [[dashboard-kpi-and-alerts-cards-were-dead-reconnected]] tiene precedente de cards KPI reales en el dashboard principal, seguir el mismo estilo visual).
- Antes de construir gráficos nuevos, cargar el skill `dataviz` si se decide visualizar series temporales de eficiencia/completado (no solo tarjetas numéricas).

## Archivos a modificar/crear
- `frontend/src/hooks/use-production-alerts.ts` (nuevo) — u omitir si se decide la vía "bridge a `Alert` genérico".
- `frontend/src/app/dashboard/production/components/active-alerts-panel.tsx` (condicional a la decisión de arriba)
- `frontend/src/app/dashboard/production/components/production-report-dialog.tsx`
- `frontend/src/hooks/use-production-reports.ts` (nuevo)

## Validación manual
1. Forzar una orden en curso a superar el 80% de su tiempo estimado (o esperar) → aparece una alerta de retraso, visible en la campana (si se hizo el bridge) o en el panel dedicado.
2. Resolver la alerta con motivo → desaparece de "activas".
3. Generar un reporte con rango de fechas que incluya lotes de prueba → KPIs coherentes con los datos reales creados en fases anteriores.

## Riesgos / rollback
- Riesgo: construir una UI de alertas paralela a la campana ya existente duplica lógica de notificación (DRY) — de ahí la pregunta explícita al usuario antes de implementar, en vez de decidirlo unilateralmente.
- Rollback: solo frontend (+ ajuste de `checkForDelays` en backend si se opta por el bridge), revertir commits basta.
