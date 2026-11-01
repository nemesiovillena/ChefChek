# Contador de raciones disponibles (fase 1)

**Estado:** propuesto, pendiente de aprobación · **Fecha:** 02/11/2026

## Objetivo
Sustituir el papel por un contador en ChefChek con las raciones de cada plato controlado (solomillo, lubina, dorada…).
- Sube al crear etiquetas con raciones.
- Baja con las ventas de Cuiner, con la retirada de etiquetas y con ajustes manuales.
- Avisa a cocina y a sala cuando quedan pocas.

## Decisiones del usuario
- Se cuenta en **raciones**.
- Lo sobrante **se arrastra** al día siguiente.
- **La caducidad no descuenta:** la fecha la pone el usuario a su criterio. Una etiqueta caducada con raciones solo genera el aviso «¿siguen disponibles?».
- Las raciones salen del contador al **venderse**, al **retirar** la etiqueta o con un **ajuste manual**.
- Aviso de «quedan pocas» a **cocina y sala**.
- Dan de alta contadores y mínimos **gerencia y cocina** (sección `raciones.manage`, asignable por puesto o persona).
- Habrá **recuentos a mano**: se escribe la cifra real y el contador se corrige (queda registrado).
- **Lo ideal es descontar al pedir.** Se acepta que hasta tener acceso al TPV se descuente al cobrar.

## Cuándo llegan las ventas (comprobado 02/11/2026 00:30)
- Cuiner escribe el ticket en la base de gestión (SQL Server) **al cobrarlo**, no a las 08:00. Los tickets cerrados a las 00:27 ya estaban allí a las 00:30.
- Retraso real = lo que tarde el conector en leer (hoy cada 30 min → bajar a **5 min** en la tarea «Ventas»).
- Ejemplo: en el turno de las 20:00 del viernes, ChefChek ya ha descontado lo **cobrado** al mediodía.
- **Límite:** las mesas abiertas sin cobrar no cuentan hasta que se cobran. El Contador de platos del TPV descuenta al comandar, y ChefChek al cobrar. Ver eso al momento exige leer el PostgreSQL del TPV (ver `mensaje-cuiner.md`).
- El TPV sigue bloqueando la venta con su propio contador.

## Fases
| # | Fase | Archivo |
|---|------|---------|
| 1 | Modelo y lógica del contador (backend) | [phase-01-modelo-y-logica.md](phase-01-modelo-y-logica.md) |
| 2 | Ventas de Cuiner → contador | [phase-02-ventas-cuiner.md](phase-02-ventas-cuiner.md) |
| 3 | Pantalla «Raciones», etiquetas y avisos | [phase-03-pantalla-y-avisos.md](phase-03-pantalla-y-avisos.md) |
| 4 | Descontar al pedir (bloqueada: necesita acceso de Cuiner) | [phase-04-descontar-al-pedir.md](phase-04-descontar-al-pedir.md) |

Las fases 2 y 3 dependen de la 1. Entre ellas son independientes. La 4 depende de la 2 y de la respuesta de Cuiner.

## Criterios de aceptación
- Activar el contador en un artículo o una receta, con un mínimo de raciones.
- Al emitir una etiqueta de algo con contador, las raciones son obligatorias y suman.
- Vender en Cuiner un plato enlazado resta raciones en cuanto se cobra (≤ intervalo del conector), de la etiqueta más antigua. Sin duplicar aunque el conector reenvíe.
- Retirar una etiqueta resta las raciones que le queden. Deshacer la retirada las devuelve.
- Ajustes manuales (+/−) y **recuento** (cifra real) con motivo, y registro de quién y cuándo.
- Por debajo del mínimo: aviso a los usuarios con acceso a «Raciones» (cocina y sala), una vez por cruce del umbral.
- Etiqueta caducada con raciones: aviso «¿siguen disponibles?»; nunca se descuenta sola.

## Fuera de alcance
- Escribir en el contador del TPV de Cuiner (fase 3 del proyecto, solo con permiso de Cuiner).
- Mezclar el contador con el stock del almacén: son cosas distintas, el almacén va en formatos de compra.

## Preguntas abiertas
- Ninguna para las fases 1-3. La fase 4 espera la respuesta de Cuiner (`mensaje-cuiner.md`).
