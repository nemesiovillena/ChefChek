# Fase 1: Entorno de pruebas `CuinerPruebas` y login SQL

## Requisitos
- Una copia exacta de `Cuiner` en una base nueva, `CuinerPruebas`, en el mismo servidor.
- El login `chefchek_conector` con permisos mínimos, **primero solo sobre `CuinerPruebas`**.

## Pasos (por SSH; cada comando que escribe se enseña al usuario y requiere su confirmación)
1. Comprobar que hay espacio (72 GB libres frente a 285 MB) y hacerlo fuera del horario de servicio.
2. `BACKUP DATABASE Cuiner TO DISK='C:\ChefChekConector\backup\Cuiner_copy.bak' WITH COPY_ONLY, CHECKSUM`.
   - `COPY_ONLY` hace que no altere las copias de seguridad propias de Cuiner (copiaSQL).
3. `RESTORE FILELISTONLY` y después `RESTORE DATABASE CuinerPruebas … WITH MOVE` a ficheros nuevos (`CuinerPruebas.mdf` / `_log.ldf`).
4. Verificar que coinciden el número de tablas y el recuento de filas entre `Cuiner` y `CuinerPruebas`.
5. Crear el login `chefchek_conector` (autenticación SQL, contraseña aleatoria que guarda el usuario) y su usuario en `CuinerPruebas`.
   - GRANT SELECT en: `DocsCab`, `DocsLin`, `DocsSumas`, `Proveedores`, `EmpresaProveedores`, `Articulos`, `EmpresaArticulos`, `ArticulosProv`, `TiposIVA`, `Centros`, `Almacenes`, `VentasCab`, `VentasLin`, `CartasLin`, `CartasCab`, `EscandallosCab`.
   - GRANT INSERT en: `DocsCab`, `DocsLin`, `DocsLinAux`, `DocsSumas`.
   - GRANT UPDATE en: `ArticulosProv(UltFecha, UltImporte, UltDescuentoP, UltDescuentoI, UltIVA, UltUnPorCaja, UltImporteUC, UltCosteUM, ActUsuario, ActFecha)` y `DocsCab(Total)`.
6. Probar con el login nuevo que un DELETE y un INSERT en una tabla no autorizada **fallan**.
7. En `Cuiner` (producción), ahora mismo solo los mismos GRANT SELECT. Los INSERT y UPDATE se dan en la fase 6, con permiso.

## Validación
- Recuento de filas idéntico en las dos bases.
- La prueba de permisos negativos falla como se espera.
- Con `Cuiner` solo se han hecho operaciones de lectura (BACKUP COPY_ONLY).

## Riesgos
- Carga puntual en el servidor durante el backup (pocos segundos con 285 MB): hacerlo fuera del servicio.
- `CuinerPruebas` se queda desactualizada: se puede regenerar repitiendo los pasos 2 y 3.
- Lo que cuenta para el límite de 10 GB de SQL Express es cada base por separado, así que no hay problema.

## Marcha atrás
`DROP DATABASE CuinerPruebas` y `DROP LOGIN chefchek_conector`. No afecta a `Cuiner`.

## ✅ Ejecutada el 05/10/2026 (19:10–19:20)
- **Copia:** `BACKUP … COPY_ONLY, CHECKSUM` en `C:\Program Files\Microsoft SQL Server\MSSQL12.CUINERSQL\MSSQL\Backup\Cuiner_copia_chefchek_20261005.bak` (285 MB, 0,9 s). Validada con `RESTORE VERIFYONLY`.
- **Restauración:** `CuinerPruebas` en `…\Data\CuinerPruebas.mdf` / `_log.ldf`. Comparación de las 155 tablas con `Cuiner`: **0 diferencias** en el número de filas.
- **Login `chefchek_conector`:** solo con usuario en `CuinerPruebas`; **sin acceso a `Cuiner`**.
  - La contraseña está en `C:\ChefChekConector\secrets\chefchek_conector.txt`, con ACL solo para Administradores y SYSTEM. No se ha mostrado en ningún sitio.
- **Pruebas de permisos (9 de 9 correctas):**
  - permitidos: SELECT DocsCab, SELECT VentasLin, INSERT DocsSumas;
  - denegados: DELETE DocsCab, UPDATE DocsLin, UPDATE ArticulosProv.RefProveedor, SELECT Usuarios, CREATE TABLE, acceso a `Cuiner`.
- **`Cuiner`:** sin ningún cambio; solo se ha leído para la copia.
- El paso 7 (SELECT en `Cuiner` para el conector) se aplaza a la fase 3, con permiso.

**Hallazgo:** la última copia de seguridad registrada en `msdb` para `Cuiner` es del **25/03/2026**. `copiaSQL` parece no estar funcionando: hay que revisarlo aparte.

## Deshacer todo (dejarlo como estaba)
```sql
USE master;
ALTER DATABASE CuinerPruebas SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE CuinerPruebas;          -- borra CuinerPruebas.mdf/.ldf
DROP LOGIN chefchek_conector;
```
Después, en PowerShell: borrar `C:\ChefChekConector` y el archivo `.bak` de la carpeta Backup (opcional; se puede conservar como respaldo).
