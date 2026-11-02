# Mensaje para el soporte de Cuiner

**Asunto:** Contador de platos — acceso de lectura y carga de unidades desde nuestra aplicación de cocina

Hola:

Somos Warynessy (centro 02). Usamos a diario el **Contador de platos** del TPV para limitar las raciones de solomillo, lubina, dorada, etc. Queremos llevar esas raciones desde nuestra aplicación de cocina, ChefChek, que ya está conectada a vuestra base de datos de gestión (SQL Server, solo lectura y albaranes), y que esté enlazada con el contador del TPV.

Hemos visto que en SQL Server la tabla `ContadorPlatos` no se mueve desde 2021 y que el TPV trabaja con el servicio **CuinerPostgreSQL**. Por eso os preguntamos:

1. **Lectura en vivo:** ¿nos podéis crear un **usuario de solo lectura** en CuinerPostgreSQL, con acceso solo desde el propio servidor (localhost)? Lo queremos para leer, durante el servicio, lo comandado en mesas aún sin cobrar y las unidades que quedan en el contador. Lo ya cobrado lo leemos de SQL Server.
2. **Carga de unidades:** ¿hay una forma **oficial y segura** de sumar unidades al Contador de platos desde fuera? Puede ser una API, una tabla de entrada, un fichero que importe el TPV… Lo usaríamos al etiquetar en cocina. No queremos escribir en vuestra base de datos sin vuestra indicación.
3. **API Cuiner Connect:** ¿las ventas (`sales`) se publican al momento o también tras el cierre o las cintas?
4. Si alguna de estas opciones tiene coste o necesita una versión concreta del TPV, ¿nos lo podéis indicar?

Gracias.
