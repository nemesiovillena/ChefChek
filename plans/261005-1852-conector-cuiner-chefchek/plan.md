---
status: pending
created: 2026-10-05
---
# Conector Cuiner ↔ ChefChek

**Objetivo:**
- Los albaranes confirmados en ChefChek se envían a Cuiner con un botón «Enviar a Cuiner».
- Las ventas del TPV de Cuiner descuentan, por receta, el almacén de ChefChek.
- Cuiner sigue llevando su propio stock y descontando con sus escandallos.

**Base:** `plans/reports/research-261004-2309-cuiner-sql-schema-exploracion-report.md` (esquema, prueba del albarán y fórmulas).

## Principios de seguridad (no negociables)
1. **Nada en `Cuiner` hasta que el usuario dé el visto bueno.** Todas las escrituras se prueban antes en `CuinerPruebas`, una copia en el mismo servidor.
2. **Login SQL propio `chefchek_conector`:**
   - SELECT en maestros y ventas;
   - INSERT solo en `DocsCab`, `DocsLin`, `DocsLinAux` y `DocsSumas`;
   - UPDATE solo en las columnas `Ult*` de `ArticulosProv` y en `DocsCab.Total`;
   - **sin DELETE ni DDL.** No se usa `sa` ni `tpv`.
3. **Escritura idempotente:** `DocsCab.Notas = 'CHEFCHEK:<albaranId>'`. Antes de insertar se comprueba si ya existe esa marca, para no duplicar nunca.
4. **Una transacción por albarán:** si falla algo, no queda nada a medias.
5. **Por defecto en simulación:** el conector valida y registra lo que haría sin ejecutarlo. El modo real se activa por tenant en la configuración.
6. **Interruptor por tenant** y botón manual de envío. Nunca hay envío automático.
7. **Credenciales** solo en el servidor (variables de entorno o archivo protegido). Nunca en el repositorio, en la memoria ni en los planes.

## Arquitectura
```
[SRVCUINER] servicio Windows «chefchek-conector» (Node + mssql)
   ├─ lee SQL local .\CUINERSQL  (Cuiner / CuinerPruebas según configuración)
   └─ HTTPS saliente ──▶ API ChefChek /api/v1/cuiner/connector/*  (token por tenant)
[ChefChek] módulo `cuiner` (MODULE_REGISTRY, por tenant)
   ├─ configuración: centro y almacén de Cuiner, modo simulación o real, cursor de ventas
   ├─ mapeos: proveedor, artículo, plato ↔ códigos de Cuiner
   ├─ cola de envío de albaranes (PENDIENTE → ENVIADO / ERROR)
   └─ importación de ventas → salidas de stock (StockMovement EXIT, idempotente)
```
- El conector no guarda estado: el cursor de ventas y la cola viven en ChefChek.
- Warynessy = Centro `02`. Rodeo Diner (Centro `01`) usará el mismo conector cuando se cree su tenant.

## Fases
| # | Fase | Escribe en Cuiner | Archivo |
|---|---|---|---|
| 1 ✅ | Entorno de pruebas: crear `CuinerPruebas` y el login SQL | Crea una base nueva (no toca `Cuiner`) | [phase-01](phase-01-entorno-pruebas-cuinerpruebas-login-sql.md) |
| 2 ✅ | Backend ChefChek: módulo, modelos y API del conector | No | [phase-02](phase-02-backend-modulo-cuiner-modelos-api.md) |
| 3 ✅ | Conector de solo lectura: catálogos y ventas | No (solo SELECT) | [phase-03](phase-03-conector-windows-lectura-catalogos-ventas.md) |
| 4 ✅ | Interfaz de mapeos: proveedores, artículos y platos | No | [phase-04](phase-04-ui-mapeos-proveedores-articulos-platos.md) |
| 5 ✅ | Ventas de Cuiner → salidas de stock en ChefChek | No | [phase-05](phase-05-ventas-cuiner-descuento-stock-chefchek.md) |
| 6 | Envío de albaranes: simulación → CuinerPruebas → producción | Sí (por pasos y con permiso) | [phase-06](phase-06-envio-albaranes-a-cuiner.md) |

**Dependencias:**
- 1 → 3 → 6.
- 2 → 3 / 4 / 5 / 6.
- 4 → 5 y 6.
- La 3 y la 4 se pueden hacer en paralelo una vez terminada la 2.

## Criterios de aceptación globales
- Un albarán enviado aparece en Cuiner igual que uno creado a mano: mismas tablas y mismos cálculos de base, IVA, total y `CosteUM`, sin diferencias de céntimos.
- Reenviar el mismo albarán no crea un duplicado.
- Cada venta de Cuiner descuenta el stock de ChefChek una sola vez, aunque se reprocese.
- Las ventas sin mapear quedan listadas como avisos y no descuentan.
- Hay un registro auditable de cada operación (payload, id de Cuiner, resultado).

## Preguntas abiertas
- **Cuiner:** ¿cómo se abre la gestión contra `CuinerPruebas` para validar visualmente? Hay que preguntarles.
- **Ventas:** ¿qué tipos de línea descuentan? P (platos) sí; ¿I (ingredientes o modificadores) y M (menús)?
- **Usuario en los albaranes:** ¿qué `ActUsuario` llevan los albaranes del conector? ¿Uno existente (Supervisor = 1) o crear un usuario «ChefChek» en Cuiner?
- **Artículos sin relación:** si un artículo no tiene relación con el proveedor en `ArticulosProv`, ¿se crea esa relación o se bloquea el envío?
- ~~Runtime del conector~~ → resuelto: PowerShell 5.1 nativo + tareas programadas (sin instalar nada).
