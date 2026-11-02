# Fase 4 — Descontar al pedir (bloqueada hasta que responda Cuiner)

## Por qué
- El usuario quiere que el contador baje **al pedir**, no al cobrar.
- Lo pedido sin cobrar solo está en la base del TPV (servicio **CuinerPostgreSQL**, con contraseña). Necesitamos el usuario de solo lectura que pide `mensaje-cuiner.md`.

## Idea (sin descuadre ni doble descuento)
- El conector lee cada 1-2 minutos, de la base del TPV, las **líneas pedidas en mesas abiertas** de los platos enlazados.
- ChefChek **no las apunta en el registro de movimientos**: las guarda como «pedidas sin cobrar», una foto que se reemplaza en cada lectura.
- Disponible mostrado = disponible del registro − pedidas sin cobrar. Ejemplo: «5 disponibles (2 pedidas sin cobrar)».
- Al cobrar, el ticket aparece en SQL Server y la fase 2 lo descuenta de verdad. En la siguiente foto la mesa ya no está abierta y el provisional desaparece, así que no se cuenta dos veces.
- Si se anula un plato o una mesa antes de cobrar, desaparece de la foto y la ración vuelve sola.
- Avisos de mínimo y de agotado calculados con el disponible mostrado.

## Pendiente de Cuiner
- Usuario de solo lectura en CuinerPostgreSQL, solo localhost.
- Qué tablas tienen las mesas abiertas y sus líneas. Explorar solo leyendo, como se hizo con SQL Server.

## Riesgos
- **Esquema sin documentar** de la base del TPV: puede cambiar con una actualización de Cuiner. Si la lectura falla, el disponible vuelve a ser el de la fase 2 y la pantalla avisa de que no hay datos en vivo.
- **Carga en servicio:** solo SELECT ligeros, en una ventana corta y sin bloqueos (lectura sin bloqueo).
