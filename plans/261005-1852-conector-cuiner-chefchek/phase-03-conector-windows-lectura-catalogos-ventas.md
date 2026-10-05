# Fase 3: Conector en SRVCUINER, solo lectura

## Requisitos
- Servicio Windows que arranca solo con el equipo. Paquete en `connectors/cuiner/` del repositorio, escrito en TypeScript.
- Configuración en `C:\ChefChekConector\config.json` (ACL solo para administradores):
  - base de datos (`CuinerPruebas` / `Cuiner`), login del conector, URL de la API y token.
- Ciclos de trabajo:
  - **Catálogos** (proveedores, artículos, `ArticulosProv`, platos de la carta): una vez al día y a demanda.
  - **Ventas:** cada 15 min, `VentasLin JOIN VentasCab WHERE Id_VentasCab > cursor` en lotes de 2.000. Se envían también `Anulacion` y `ComandaAnulada`; ChefChek decide qué hacer con ellas.
  - Todas las lecturas con `READ UNCOMMITTED` y `TOP N`.
  - Un ping de estado (`lastSeenAt`) en cada ciclo.
- Log en un archivo con rotación. Si pierde la conexión, reintenta con espera creciente.

## Pasos
1. Elegir el runtime: Node LTS + `mssql` (tedious) + NSSM para el servicio. Bun en Windows queda descartado por la compatibilidad con tedious.
2. Implementar los ciclos de lectura. **En esta fase no hay ningún código que escriba en SQL.**
3. Instalar en SRVCUINER por SSH, apuntando primero a `CuinerPruebas` y después a `Cuiner` con permisos de solo SELECT.

## Validación
- Los catálogos aparecen en ChefChek con recuentos iguales a los de Cuiner.
- El cursor de ventas avanza y reprocesar no duplica nada.
- El consumo de CPU y memoria del servicio es despreciable y no se nota en el TPV en hora punta.

## Riesgos
- Cortes de internet: no se pierde nada, porque el cursor solo avanza cuando ChefChek confirma la recepción.

## ✅ Implementada y probada de punta a punta el 05/10/2026
**Cambio de runtime: PowerShell 5.1 nativo, no Node.** En el servidor de producción no se instala nada: `System.Data.SqlClient` e `Invoke-RestMethod` vienen con Windows. Tareas programadas en lugar de un servicio.

**Archivos** (`connectors/cuiner/`, con BOM UTF-8, que PowerShell 5.1 necesita para las tildes):
- `ChefChekConector.ps1`: tareas `-Task check|catalog|sales|all`.
- `config.example.json`
- `InstalarTareasProgramadas.ps1` (`-Desinstalar` para dejarlo todo como estaba). Crea:
  - Ventas cada 30 min;
  - Catálogo a diario a las 09:00.

**Hallazgos de los datos de Cuiner aplicados:**
- **Ventas por cintas:** las ventas llegan por cintas (`Ventas`, una por centro) que se importan de golpe a las 08:00 del día siguiente.
  - El conector filtra por `Ventas.Centro`.
  - Solo procesa tickets cuya cinta lleva ≥30 min sin tocarse; el cursor nunca salta por encima de un ticket aún reciente.
- **Clave de plato:** el mismo código es distinto plato según el tipo (`00040` P = zumo, I = huevo frito). La clave pasa a ser tipo + código (`CuinerDish` / `CuinerDishMap`, migración regenerada).
- **Anulaciones:** un ticket anulado genera otro ticket con unidades negativas (`ComandaAnulada` = nº del original). Se envían tal cual; solo `VentasLin.Anulacion=1` se marca como anulada.
- **Medias raciones:** `MediaRacion=1` → unidades / 2.
- **Códigos basura:** 7 códigos no numéricos (`HUEV`, `9.630`, `§`…): se omiten y se anotan en el log.
- **Permisos:** el login necesitaba además `SELECT` en `Ventas` (concedido solo en `CuinerPruebas`).

**Prueba real** (servidor → backend de la rama en el Mac por Tailscale, tenant demo, base `CuinerPruebas`):
- `check`: SQL y API correctos con el login restringido.
- `catalog`: 113 proveedores, 2.320 artículos, 3.160 artículo-proveedor y 1.385 platos (centro 02), en 8 s.
- `sales` (166 tickets): P 275 líneas / 580,16 uds, I 62, M 5. **Coincide exactamente con el SQL de Cuiner.** La segunda pasada no inserta nada (idempotente).

**Pendiente para la puesta en marcha** (requiere permiso del usuario):
1. Desplegar el backend con el módulo y generar el token del tenant real (Warynessy).
2. `GRANT SELECT` en `Cuiner` (producción) para `chefchek_conector`: las mismas tablas que en `CuinerPruebas`, más `Ventas`.
3. `config.json` → `apiUrl` de producción y `database: Cuiner`; ejecutar `InstalarTareasProgramadas.ps1`.

**Estado del servidor:** en `C:\ChefChekConector` hay el script, el instalador y un `config.json` de pruebas que apunta al Mac. Es inerte: no hay ninguna tarea programada.
