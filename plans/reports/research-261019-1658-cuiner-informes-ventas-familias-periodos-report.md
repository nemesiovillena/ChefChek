# Research: Informes de ventas Cuiner (día/semana/mes/año, por familias)

Fecha: 2026-10-19 16:58. Fuente: código ChefChek + esquema SQL Cuiner en SRVCUINER (solo lectura, `.\CUINERSQL`, BD `Cuiner`).

## Qué tenemos hoy en ChefChek
- `CuinerSaleLine`: idVentasCab, linea, fecha, tipo, producto, unidades, anulada, status. **Sin importes.**
- `CuinerDish`: tipo, producto, nombre. **Sin familia.**
- Conector PS1 (en SRVCUINER) lee `VentasLin` solo Producto/Unidades/MediaRacion/Anulacion, y `CartasLin` solo Tipo/Codigo/Descripcion.
- Ventas en ChefChek solo desde que arrancó el conector (~2026-10-07).

## Qué hay en Cuiner
- `VentasLin`: Unidades, **Importe** (precio unitario sin IVA), **Base** (total línea sin IVA, ya con descuentos), **Impuesto** (cuota IVA), TipoImpositivo, Invitacion, MediaRacion, Anulacion, Hora, Usuario (camarero), IdMenu, Tarifa.
  - Verificado: Σ VentasLin.Base = VentasCab.Base del ticket. Total con IVA = Base + Impuesto.
- `VentasCab.Fecha` = fecha de caja (00:00), `VentasLin.Hora` = hora real.
- `CartasLin.Familias`: ruta jerárquica con «-»: `BEBIDAS ALCOHOL-LICORES-TUBO L`, `VINOS-VINO TINTO-COPA V.TINTO`, `APERITIVOS`, `CERVEZAS`, `PLATOS MENU`, `POSTRES`… (filas por Empresa/Centro).
- No hay tabla de familias de carta aparte: el nombre está en la propia ruta.
- Histórico: centro 01 desde 2018 (92k tickets), centro 02 desde 2021-11 (25k tickets).

## Propuesta
1. **Conector**: catálogo añade `Familias`; ventas añaden `Base`, `Impuesto`, `Invitacion`. Requiere copiar el PS1 nuevo a SRVCUINER.
2. **Modelo**: `CuinerDish.familia String?`; `CuinerSaleLine.base Float?`, `impuesto Float?`, `invitacion Boolean`.
3. **Histórico**: importación de tickets anteriores marcados como `HISTORICO` → **nunca descuentan stock** (si no, descontaría años de ventas). Upsert por (idVentasCab, linea) también rellena importes de las líneas ya sincronizadas.
4. **Informe** (nueva pantalla): periodo (día/semana/mes/año o rango), agrupado por periodo y por familia (nivel 1 con desplegable a niveles 2-3 y platos). Columnas: unidades, base, total con IVA, % sobre total. Invitaciones aparte. Menús (M) cuentan su importe; sus platos (P con IdMenu) llevan importe 0.
5. Cálculo en servidor (SQL agregado por fecha/familia), no en navegador: años = 100k+ líneas.

## Riesgos
- Familias con «-» dentro del nombre romperían niveles (no visto en muestra).
- Cambio de familia de un plato en Cuiner reescribe histórico (se guarda la familia actual del plato, no la del día de la venta). Aceptable salvo que pidan lo contrario.
- Histórico grande en centro 01 si fuese el del tenant (~92k tickets): varios ciclos del conector.

## Preguntas abiertas
- ¿Desde cuándo importar histórico?
- ¿Quién ve el informe (rol)?
- ¿Exportar a Excel/PDF?
- ¿Centro de Warynessy = 02? (config del conector lo dirá)
