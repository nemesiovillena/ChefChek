# Exploración de la base de datos de Cuiner (SRVCUINER), solo lectura

**Fecha:** 04/10/2026, 23:10.
**Acceso:** SSH por Tailscale `tpv@100.68.34.99`, con `sqlcmd -S .\CUINERSQL -E` (autenticación de Windows; no ha hecho falta `sa`).
**Operaciones:** solo SELECT y consultas a `sys.*` / `INFORMATION_SCHEMA`, todas con `READ UNCOMMITTED`. No se ha ejecutado ninguna escritura.

## Entorno
- **Motor:** SQL Server 2014 SP2 **Express**, 64 bits. Express limita cada base de datos a 10 GB.
- **Bases de datos:** `Cuiner` (producción) y `cuinerdemo`. **La demo sirve para probar escrituras** antes de tocar producción.
- **Tamaño:** 155 tablas, 197 procedimientos almacenados y 13 vistas (`V_StockArticulos`, `V_Ventas`, `V_Articulos`, `V_Proveedores`…).
- **Triggers:** ninguno. La lógica la hace el programa de Cuiner o sus procedimientos, no la base de datos al insertar.

## Compras y albaranes
`TiposDocs` (empresa `01`):

| TipoDoc | Descripción | Stock |
|---|---|---|
| **A** | Albarán de compra | **+** (suma) |
| F | Factura de compra | + |
| P | Pedido de compra | (ninguno). Se convierte en A (`TiposDocsConversiones` P→A) |
| T | Traspaso entre almacenes | +/- |
| V / C | Albarán / factura de venta | - (casi sin uso) |

Volumen en `DocsCab`: A = 15.416 (hay fechas basura: 1899 y 2500), P = 2.663, C = 1, V = 3.

### Albarán = `DocsCab` + `DocsLin` + `DocsSumas`
**`DocsCab`** (cabecera; `Id_DocsCab` es IDENTITY). Albarán real 21294:
- `Empresa='01'`, `TipoDoc='A'`, `Serie='1'`.
- `TipoCodigo='P'` (proveedor) y `Codigo='00019'`: código de proveedor de 5 dígitos.
- `Centro='02'`, `Almacen='01'`, `Fecha` (fecha del albarán, sin hora).
- `Numdoc='05/629'`: número de albarán del proveedor, texto libre.
- `Contador=0`.
- `Total=386.77`, que es la base más el IVA.
- `Moneda='E'`, `ActUsuario='3'`, `ActFecha` = momento de grabación.
- `Estado`, `Factura`, `Facturado`, `Procesado` y `Contabilizado` van a NULL al crearlo.
- Los albaranes de compra **no usan la tabla `Contadores`**: allí solo hay contadores para ventas (V y C).

**`DocsLin`** (`Id_DocsLin` es IDENTITY). Campos usados:
- `Articulo` (código de 8 dígitos, p. ej. `10070007`) y `Descripcion` (35 caracteres).
- `Unidades`, `UnidadesPorCaja`, `Importe` (precio).
- `DescuentoP` (% de descuento) y `Base`, que es unidades × precio × (1 − descuento).
  - Ejemplo: 2 × 50,50 × 0,88 = 88,88.
- `CosteUM` (coste por unidad mínima) y `ImporteUC` (0/1: si el precio es por caja o por unidad; **sin confirmar**).
- `TipoIVA='10'`, `IVA=10`.
- `Centro` y `Almacen` van vacíos: se heredan de la cabecera.
- `ActUsuario`, `ActFecha`.

**`DocsSumas`**: una fila por cada tipo de IVA, con `TipoIVA`, `Dtos`, `Base` y `Cuota`. Ejemplo: 10% | 351,61 | 35,16.

**Observación:** el albarán 21296 se grabó hoy con `Id_PlantillasOrigen=31` y `Total` a NULL. Parece un documento a medias creado desde una plantilla, así que **el `Total` y `DocsSumas` los calcula el programa al guardar o cerrar**. Al escribir desde el conector habrá que calcularlos nosotros.

## Stock: periódico, no en tiempo real
- **No hay un stock que se actualice en cada movimiento.** `Stocks` (16 filas) guarda cálculos o inventarios por fecha, centro y almacén:
  - `FechaCalculosDesde`/`FechaCalculosHasta`, `Calculado`, `InventarioCerrado`.
- `StockArticulos` (16.395 filas) guarda el resultado por artículo:
  - `StockAnterior`, `Compras`, `Ventas`, `VentasTPV`, `ConsumoPersonal`, `Mermas`, `Roturas`, `Inventario`, `Entradas`, `Salidas`.
  - Valoraciones PMP, UPC y UM.
- **Consecuencia:**
  - Insertar un albarán A no actualiza ningún stock en el momento. Entra en el siguiente cálculo de stock que se lance desde Cuiner.
  - Esto simplifica la escritura: no hay contadores ni existencias que ajustar.
  - Pendiente confirmar si un cálculo ya cerrado (`InventarioCerrado`) bloquea albaranes con fecha anterior.

## Ventas
- `VentasCab` (116.622 tickets): `Id_VentasCab` es IDENTITY, `Fecha` es la fecha de negocio (sin hora).
  - También guarda `ComandaAnulada`, `Invitacion` y `ConumoPersonal` (así, con esa errata).
- `VentasLin` (962.379 líneas): `Id_VentasCab`, `Linea`, `Grupo`, `CabeceraGrupo`, `Tipo`, **`Producto`** (código de 5 dígitos, p. ej. `00967`), `Unidades`, `Importe`, `Anulacion`, `IdMenu`, `Hora`, `MediaRacion`.
- Valores de `Tipo`: **P** plato (784.758), **I** ingrediente o modificador (147.908), **M** menú (29.707), A (6).
- **Sincronización incremental:** usar `Id_VentasCab > último procesado`. Las fechas no van en orden de id (el id 3341487 tiene fecha del 03/10 y el 3341486 del 04/10), así que el cursor tiene que ser el id, no la fecha.
- Descartar las líneas con `Anulacion=1` y los tickets con `ComandaAnulada`. Las líneas I con importe 0 son modificadores del plato (`Grupo` / `CabeceraGrupo`).

## Escandallos de Cuiner
- `EscandallosCab` (225) / `EscandallosLin` (957): cada escandallo enlaza con un `Articulo`, tiene `Raciones` y cada línea lleva `Articulo`, `Unidades`, `Almacen` y `UltCoste`. También tiene flags `AfectaTickets` y similares.
- `CartasLin` (20.899) / `CartasIngredientesDelPlato` (38.178): relación de cada plato de la carta con sus ingredientes.
- **Respuesta a la pregunta pendiente:** Cuiner **sí descuenta por escandallo**, porque `StockArticulos` tiene la columna `VentasTPV` calculada a partir de los escandallos.

## Implicaciones para el conector
1. **Escribir un albarán en Cuiner:** en una sola transacción, `INSERT DocsCab` (A) → `INSERT DocsLin` → `INSERT DocsSumas`, y calcular `Total`.
   - Hace falta una tabla de enlace entre los artículos y proveedores de ChefChek y los códigos de Cuiner. `ArticulosProv` (3.166) da el código de cada artículo según el proveedor.
   - Probar primero en `cuinerdemo`, abrir el albarán en el programa de Cuiner y lanzar un cálculo de stock.
2. **Leer ventas para ChefChek:** sondear `VentasLin` con `Id_VentasCab > cursor`, filtrando por `Tipo`/`Producto` y sin anulaciones.
   - Enlazar `Producto` (código del plato en Cuiner) con la receta de ChefChek. Se puede aprovechar `CartasLin` para listar los platos y sus nombres.
3. **Usuario de base de datos:** crear un login SQL `chefchek` con permisos mínimos:
   - SELECT en ventas y maestros;
   - INSERT solo en `DocsCab`, `DocsLin` y `DocsSumas`.
   - No usar `tpv` ni `sa`.
4. **Express:** sin SQL Agent, así que la programación la hace el propio conector (por ejemplo, un servicio de Windows).

## Resuelto tras una segunda consulta
- **Código de artículo:** está en `EmpresaArticulos.Articulo` (8 dígitos), que enlaza con `Articulos.Id_Articulos`.
- **Centros:** son **dos locales distintos**, cada uno con su almacén `01`:
  - `Centro 01` = Rodeo Diner (859 albaranes A en 2026);
  - `Centro 02` = Warynessy (838 albaranes A en 2026).
  - El conector tendrá que asignar a cada albarán el centro que le corresponda.
- **`ActUsuario`:** es `Usuarios.Usuario` (1 Supervisor, 2 Nemesio, 3 Alberto). La tabla `Usuarios` guarda claves en texto plano: no volver a hacer SELECT * sobre ella.

## Prueba con un albarán creado desde Cuiner (05/10/2026, 18:38)
**Método:** recuento de filas de las 155 tablas e ids máximos antes y después de que el usuario guardara en Cuiner el albarán `PRUEBA-CHEFCHEK` (Warynessy, una línea con un 10% de descuento).

**Tablas que cambian (y ninguna más):**

| Tabla | Cambio | Contenido |
|---|---|---|
| `DocsCab` | +1 (Id 21307) | `01`, `TipoCodigo='P'`, `Codigo='00009'` (proveedor), `Centro='02'`, `Almacen='01'`, `Fecha=2026-10-05`, `TipoDoc='A'`, `Serie='1'`, `Numdoc='PRUEBA-CHEFCHEK'`, `Contador=0`, `DescuentoP1-3=0`, `DescuentoI=0`, **`Total=8.34`**, `Moneda='E'`, `ActUsuario='3'`, `ActFecha=now`; el resto NULL |
| `DocsLin` | +1 (Id 131769) | `Articulo='05080005'`, `Descripcion='MAYONESA INMACULADA 3,6KG'`, `Unidades=1`, `UnidadesPorCaja=1`, `Importe=8.422`, `DescuentoP=10`, **`Base=7.58`**, **`CosteUM=2.1055`**, `ImporteUC=1`, `TipoIVA='10'`, `IVA=10`, `Centro`/`Almacen` vacíos, `ActUsuario='3'` |
| `DocsLinAux` | +1 | `Id_DocsLin=131769`, `LOTE=''`, `CaducRodeo=NULL`, `NOTAS=''`. **Una fila por cada línea, aunque vaya vacía** |
| `DocsSumas` | +1 | `TipoIVA=10`, `Dtos=0`, `Base=7.58`, `Cuota=0.76` |
| `ArticulosProv` | 1 actualizada | Artículo `05080005` del proveedor `00009`: actualiza `UltFecha`, `UltImporte=8.422`, `UltDescuentoP=10`, `UltIVA=10`, `UltUnPorCaja=1`, `UltImporteUC=1`, `UltCosteUM=2.1055`, `ActUsuario`, `ActFecha`. **Es el «último precio de compra» del proveedor** |

**Cómo calcula Cuiner:**
- `Base = round(Unidades × Importe × (1 − DescuentoP/100), 2)` → 1 × 8,422 × 0,9 = 7,5798 → **7,58**.
- `CosteUM = Base / (Unidades × Articulos.Medida)` → 7,58 / 3,6 = **2,1055** €/kg.
  - `Medida` es el peso o volumen del formato (3,6 kg) y `Manipulacion` la unidad (`Kg`).
  - Hipótesis: hay que comprobarla con más líneas que tengan `UnidadesPorCaja` mayor que 1 o `ImporteUC=0`.
- `DocsSumas` agrupa por tipo de IVA: `Cuota = round(Base × IVA/100, 2)` → 0,76.
- `Total` = suma de bases + suma de cuotas → **8,34**.

**Lo que NO toca:** `Stocks`, `StockArticulos`, `Contadores`, `Articulos`, `Proveedores`. Se confirma que el stock solo se ve afectado cuando se lanza un nuevo cálculo de stock desde Cuiner.

**Recetas de escritura para el conector** (una sola transacción):
1. `INSERT DocsCab` → recoger `SCOPE_IDENTITY()`.
2. Por cada línea: `INSERT DocsLin` → `SCOPE_IDENTITY()` → `INSERT DocsLinAux(Id_DocsLin, '', NULL, '')`.
3. Una fila de `DocsSumas` por cada tipo de IVA.
4. `UPDATE ArticulosProv SET Ult* …` por cada artículo y proveedor (si no existe la relación, ¿INSERT? Ver pregunta abierta).
5. `UPDATE DocsCab SET Total`.
6. `ActUsuario`: crear o usar un usuario de Cuiner para «ChefChek» y así distinguir los albaranes del conector.

**Limpieza:** el albarán 21307 lo borra el usuario desde la pantalla de Cuiner. El conector no borra nada. **Ojo:** el «último precio» de `ArticulosProv` probablemente no se revierte al borrar el albarán.

## Preguntas abiertas
- **Campos del albarán:** significado exacto de `ImporteUC`/`ImporteUM` y de `CosteUM`.
- **Inventario cerrado:** ¿deja Cuiner meter albaranes con fecha dentro de un periodo ya cerrado?
- **Procedimientos:** ¿alguno de los 197 recalcula el `Total` o `DocsSumas`, y conviene llamarlo en vez de calcularlo nosotros? Revisar los nombres.
- **Varios locales en ChefChek:** ¿se mapea cada `Centro` de Cuiner a un tenant o local distinto?
