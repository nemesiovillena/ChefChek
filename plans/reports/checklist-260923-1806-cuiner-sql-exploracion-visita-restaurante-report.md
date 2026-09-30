# Checklist visita restaurante: exploración SQL de Cuiner

Fecha: 23/09/2026 · Solo lectura, salvo el paso 5 (albarán de prueba desde la propia pantalla de Cuiner).
Credenciales: las tiene el usuario. No se copian aquí ni en el repositorio.

## Decisiones ya tomadas
- **Cuiner** sigue descontando stock con sus ventas.
- **ChefChek** descuenta en su propio almacén las mismas ventas, leídas del SQL de Cuiner y descompuestas por las recetas de ChefChek.
- **Albaranes:** se introducen en ChefChek (con OCR) y un conector los escribe en Cuiner.
- **Conector:** servicio en el PC servidor (Windows, siempre encendido). Accede al SQL en local y conecta con ChefChek por HTTPS saliente. SQL Server nunca expuesto a internet.

## En el restaurante (SSMS contra `.\CUINERSQL`)

1. **Bases de datos**
   ```sql
   SELECT name FROM sys.databases;
   ```
2. **Tablas candidatas y número de filas** (ejecutar dentro de la base de datos de Cuiner)
   ```sql
   SELECT t.name AS tabla, SUM(p.rows) AS filas
   FROM sys.tables t
   JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
   WHERE t.name LIKE '%albar%' OR t.name LIKE '%compr%' OR t.name LIKE '%prove%'
      OR t.name LIKE '%artic%' OR t.name LIKE '%ingred%' OR t.name LIKE '%almac%'
      OR t.name LIKE '%stock%' OR t.name LIKE '%exist%' OR t.name LIKE '%movim%'
      OR t.name LIKE '%venta%' OR t.name LIKE '%factur%' OR t.name LIKE '%escand%'
   GROUP BY t.name ORDER BY t.name;
   ```
3. **Columnas de las tablas encontradas** (cambiar la lista por las tablas del paso 2)
   ```sql
   SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_NAME IN ('tabla1','tabla2')
   ORDER BY TABLE_NAME, ORDINAL_POSITION;
   ```
4. **Triggers y procedimientos.** Revelan qué hace Cuiner por detrás al guardar un albarán.
   ```sql
   SELECT name, OBJECT_NAME(parent_id) AS tabla FROM sys.triggers;
   SELECT name FROM sys.procedures ORDER BY name;
   ```
5. **Albarán de prueba** (lo más importante)
   - Antes: `SELECT COUNT(*)` de las tablas de albarán, líneas, stock y movimientos.
   - Crear en Cuiner, a mano, un albarán de 1 línea con un artículo conocido.
   - Después: volver a contar y consultar las últimas filas (`SELECT TOP 5 ... ORDER BY <id> DESC`) de cada tabla.
   - Objetivo: saber exactamente qué filas y campos escribe Cuiner, incluidos numeración, stock y precio medio.
6. **Ventas:** `SELECT TOP 20` de la tabla de líneas de venta. Comprobar qué código de producto trae (el equivalente al `pos_ref`) y cómo se marcan las anulaciones y los menús.
7. **Versión:** `SELECT @@VERSION;` y la versión de Cuiner. Hace falta para el driver y para saber el tamaño de la base de datos.

**Llevar de vuelta:** los resultados de los pasos 1 a 7 exportados a CSV o capturas.

## Después de la visita
- Crear el login `chefchek` con permisos mínimos (no usar `sa`).
- Hacer `/ck:plan` del conector y de dos módulos en ChefChek:
  - albarán confirmado → cola de envío a Cuiner;
  - ventas de Cuiner → salidas de stock en ChefChek, idempotentes por venta y línea.
- Hacer las pruebas de escritura sobre una copia restaurada de la base de datos antes de tocar la real.

## Riesgos
- **Stocks divergentes:** ChefChek descuenta por sus recetas y Cuiner por sus propios escandallos, así que los dos almacenes nunca cuadrarán exactamente. Valorar una vista de comparación más adelante.
- **Actualizaciones de Cuiner:** una actualización puede cambiar el esquema de la base de datos, y la escritura directa no tiene soporte oficial. El conector debe fallar de forma segura y avisar.
- **Artículos de ChefChek sin equivalente en Cuiner:** hace falta una tabla de enlace entre los artículos de las dos bases.

## Preguntas abiertas
- ¿Cuiner descuenta el stock por escandallo o por artículo vendido?
- ¿Un solo restaurante o varios en la misma base de datos?
- ¿Cuiner da soporte si su programa falla por datos que ha escrito el conector?
