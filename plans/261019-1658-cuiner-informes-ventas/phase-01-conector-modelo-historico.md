# Fase 1 — Conector, modelo e histórico

## Archivos
- `connectors/cuiner/ChefChekConector.ps1` (catálogo: MAX(Familias); ventas: Base, Impuesto, Invitacion; modo histórico)
- `backend/prisma/schema.prisma` + migración: `CuinerDish.familia String?`; `CuinerSaleLine.base Float?`, `impuesto Float?`, `invitacion Boolean @default(false)`; enum `CuinerSaleStatus.HISTORICO`; `CuinerConfig.historyCursor Int?` / `historyDone Boolean`
- `backend/src/modules/cuiner/dto/cuiner.dto.ts`, `cuiner-sales.service.ts`, `cuiner-mapping.service.ts` (upsertCatalog), `cuiner-connector.controller.ts`
- `docs/` o guía del conector: cómo actualizar el PS1 en SRVCUINER

## Pasos
1. Catálogo: `MAX(Familias)` por Tipo/Codigo del centro → `familia`.
2. Ventas en curso: añadir base/impuesto/invitacion. Media ración ya divide unidades; base viene ya correcta del TPV.
3. Histórico: endpoint del conector `GET history-cursor` → conector lee tickets `Id_VentasCab < primer id ya sincronizado`, de más nuevo a más viejo, en lotes; `POST sales/history` → upsert con status HISTORICO (si la línea existe, solo rellena base/impuesto/invitacion/familia, no cambia status).
4. Líneas ya sincronizadas sin importe: el mismo barrido histórico las cubre (upsert).
5. Guardas: `applyPending` solo toma PENDIENTE (ya es así) — test explícito de que HISTORICO no se aplica.

## Tests
- Upsert histórico no pisa status APLICADA/PENDIENTE.
- HISTORICO excluido de preview/apply.
- DTO acepta base/impuesto nulos (conector viejo sigue funcionando).

## Resultado (2026-10-19)
- Hecho: migración `20261019170000_cuiner_sales_amounts_families_history` (sin DROP; BD dev compartida con PR #403 limpiada a mano).
- `POST connector/sales/history`; `GET connector/config` devuelve historyCursor/historyDone.
- Límite JSON subido a 2 MB (`main.ts`): Express trae 100 KB y un lote de 300 tickets lo supera.
- Conector: `Get-SaleLines` común a ventas e histórico; `Invoke-HistorySync` tras ventas, `historyBatchesPerRun` (20) en config por defecto. BOM UTF-8 conservado; sintaxis validada con el parser de PowerShell 5.1 en SRVCUINER (en memoria).
- Verificado en Cuiner real (solo lectura): 59 familias, 17 platos sin familia de 1.385; 17/10 centro 02: Σ Base − anuladas = 6.310,67 vs caja 6.310,70; con IVA 6.941,74 = caja. **Excluir anuladas** en informes.
- Gotcha: SQL Server en español lee 'AAAA-MM-DD' como año-día-mes en literales; usar 'AAAAMMDD' o parámetros.
- Pendiente despliegue: copiar PS1 a `C:\ChefChekConector\` en SRVCUINER tras desplegar el backend.

## Despliegue del conector (tras desplegar el backend)
1. Copia de seguridad: `C:\ChefChekConector\ChefChekConector.ps1` → `ChefChekConector.ps1.bak-AAAAMMDD`.
2. Copiar `connectors/cuiner/ChefChekConector.ps1` de esta rama a `C:\ChefChekConector\` (conservar BOM UTF-8; copiar el archivo tal cual, no pegar texto).
3. `config.json` no cambia (historyBatchesPerRun = 20 por defecto; añadirlo solo para ajustarlo).
4. Probar a mano: `powershell -File C:\ChefChekConector\ChefChekConector.ps1 -Task sales` → el log debe mostrar «Histórico: tickets …».
5. Las tareas programadas siguen igual; cada ejecución de ventas avanza el histórico hasta «Histórico: importación terminada».
Vuelta atrás: restaurar el .bak (el backend acepta el conector antiguo).
