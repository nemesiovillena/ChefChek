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
