# Fase 6: Envío de albaranes a Cuiner

## Escritura (una transacción; tablas confirmadas en la prueba del 05/10/2026)
1. Si ya existe `DocsCab` con `Notas='CHEFCHEK:<albaranId>'`: devolver ese `Id_DocsCab` y no hacer nada más.
2. `INSERT DocsCab`:
   - `Empresa='01'`, `TipoCodigo='P'`, `Codigo=<proveedor>`, `Centro`, `Almacen='01'`;
   - `Fecha` (fecha del albarán), `TipoDoc='A'`, `Serie='1'`, `Numdoc=<nº del proveedor>`, `Contador=0`;
   - `DescuentoP1..3=0`, `DescuentoI=0`, `Moneda='E'`, `ActUsuario`, `ActFecha=GETDATE()`, `Notas`.
   - Después recoger `SCOPE_IDENTITY()`.
3. Por cada línea:
   - `INSERT DocsLin`: `Articulo`, `Descripcion` (35 caracteres), `Unidades`, `UnidadesPorCaja`, `Importe`, `DescuentoP`, `Base`, `CosteUM`, `ImporteUC`, `TipoIVA`, `IVA`, `Centro=''`, `Almacen=''`, `ActUsuario`, `ActFecha`.
   - `INSERT DocsLinAux(Id_DocsLin, '', NULL, '')`. Si ChefChek tiene el lote, va en `LOTE`.
4. `INSERT DocsSumas`: una fila por cada tipo de IVA.
5. `UPDATE DocsCab SET Total`.
6. `UPDATE ArticulosProv SET Ult*` por cada artículo y proveedor que ya exista. Si no existe, no se crea y se avisa (pendiente de decidir).

## Despliegue por pasos (cada paso necesita el «OK» explícito del usuario)
1. **Simulación** contra `Cuiner`: el conector valida, monta el SQL, lo registra y hace ROLLBACK. Se revisan 5 albaranes reales.
2. **LIVE contra `CuinerPruebas`:** se envían esos 5 albaranes y se compara cada fila con un albarán equivalente creado a mano, campo por campo. Si Cuiner explica cómo, se abre la gestión contra `CuinerPruebas` y se lanza un cálculo de stock.
3. **LIVE contra `Cuiner` con 1 albarán real** enviado con el botón. El usuario lo revisa en la pantalla de Cuiner.
4. **Uso normal**, siempre con el botón.

## Validación
- Una consulta de comparación entre el albarán del conector y el creado a mano (todas las columnas salvo ids y fechas de actualización) no da ninguna diferencia.
- Reenviar el mismo albarán no lo duplica.
- Al cortar la red a mitad de un envío, la transacción no deja nada escrito.

## Marcha atrás
Un albarán mal enviado lo borra el usuario desde la pantalla de Cuiner. El conector nunca borra.
