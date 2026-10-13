# Check-In, Turnos y Portal del empleado: guía de uso

Tres módulos que se activan por separado para cada cliente (panel de superadministrador):

| Módulo | Para qué sirve | Necesita |
|---|---|---|
| **Check-In** | Fichar y llevar el registro de jornada que exige la ley | — |
| **Turnos y ausencias** | Planificar la semana, vacaciones, permisos y bajas | Check-In |
| **Portal del empleado** | "Mi espacio": cada persona consulta lo suyo y pide cambios; documentos laborales | Check-In |

Todo está en el menú **Personal**. Para una inspección, ver [check-in-guia-inspeccion.md](./check-in-guia-inspeccion.md).

## Quién hace qué

- **Gerencia** (administrador o propietario, siempre desde su cuenta personal): da de alta al equipo, configura, planifica, aprueba y descarga informes.
- **Cada persona**, desde su cuenta: ficha, consulta sus jornadas, turnos, ausencias y documentos, y envía solicitudes.
- **Cuenta compartida** (la tablet de cocina): solo abre la pantalla de fichaje en modo kiosco. No muestra datos personales de nadie.

## Puesta en marcha (gerencia)

1. **Equipo**: crea la cuenta de cada persona en *Personal → Usuarios*. Su ficha de fichaje se crea sola. Los datos laborales (centros, horas semanales, coste hora) están en la pestaña *Datos laborales* de su cuenta.
2. **Ajustes de fichaje**:
   - *Convenio*: elige el convenio y revisa jornada máxima, descansos, vacaciones y tope de horas extra.
   - *Centros de trabajo*: dirección y, si quieres, la zona permitida para fichar.
   - *Textos legales*: léelos y valídalos. Hasta entonces nadie puede fichar.
   - *Jornada y pausas*: si las pausas cuentan como trabajo y el margen frente al turno planificado.
3. **Kiosco** (opcional): inicia sesión en la tablet con la cuenta compartida; se abre directamente la pantalla de fichaje.

## Fichar

- **Desde el móvil**: *Personal → Fichar*, o la pantalla de fichaje (`/fichar`), que se puede instalar como aplicación y funciona sin conexión: los fichajes se guardan y se envían al volver la red.
- **En el kiosco**: la persona toca su nombre e introduce su clave. Quien tiene cuenta usa la misma contraseña que en Equipo; quien no la tiene, el PIN que le asigne gerencia. Tres fallos seguidos bloquean el acceso unos minutos.
- Al fichar se anota la ubicación de ese instante, si el dispositivo la da. No hay seguimiento continuo.

## Registro de jornada

*Personal → Registro de jornada*.

- Cada persona ve sus jornadas del mes. Si olvidó un fichaje, **solicita la corrección** con su motivo; un responsable la aprueba o rechaza.
- Un fichaje nunca se modifica ni se borra: la corrección se añade aparte y todo queda en el informe.
- **Hojas de horas**: gerencia aprueba el mes de cada persona y esta da su conformidad.
- **Fichajes a revisar**: en *Fichar*, gerencia ve los que necesitan comprobación (enviados tarde, sin clave verificada, fuera de zona).

## Ausencias y vacaciones

*Personal → Ausencias y vacaciones*.

- La persona ve su saldo de vacaciones y **solicita** días. No puede pedir más de los que le quedan ni solaparse con otra ausencia.
- Gerencia aprueba o rechaza (rechazar exige explicar por qué) y registra las bajas médicas. No hay que anotar el diagnóstico.
- Calendario del equipo, saldos por persona, festivos y tipos de ausencia.

## Planificador de turnos

*Personal → Turnos*.

- Rejilla semanal por persona y día. Toca **+** para crear un turno (a mano o con una plantilla) y **arrastra** para moverlo a otro día o a otra persona. Con *Duplicar al arrastrar*, lo copia.
- Admite turno partido, turnos que cruzan la medianoche y turnos abiertos sin asignar.
- Los turnos nacen en **borrador** (borde discontinuo): solo los ve gerencia hasta pulsar **Publicar**.
- *Copiar semana anterior* trae los turnos como borradores y se salta los que no encajan.
- **Avisos** (triángulo ámbar): descanso entre jornadas, jornada diaria, horas semanales, descanso semanal y horas extra del año. Son orientativos y no impiden publicar.
- **Coste estimado** por día y semana: horas por el coste hora de cada ficha, sin cotizaciones.
- Pestaña **Plan frente a real**: compara los turnos publicados con lo fichado y señala retrasos, salidas anticipadas, excesos, quién no ha fichado y quién trabajó sin turno.
- En *Fichar*, **Turnos de hoy** muestra el estado de cada turno del día.

## Mi espacio (portal del empleado)

*Personal → Mi espacio*. Quien no gestiona entra aquí directamente al iniciar sesión.

- **Inicio**: fichar y próximos turnos.
- **Ausencias**: saldo y solicitudes.
- **Documentos**: abrir los documentos propios, confirmar su lectura y subir justificantes (PDF o foto).
- **Mis datos**: datos personales y laborales. Para cambiar un dato personal se envía una solicitud; no cambia hasta que gerencia la aprueba.
- **Solicitudes**: todo lo pedido y su estado, en una lista.

## Solicitudes y documentos del equipo (gerencia)

- *Personal → Solicitudes del equipo*: una bandeja con cambios de datos, correcciones de fichaje y ausencias pendientes. Nadie responde su propia solicitud.
- *Personal → Documentos del equipo*: sube un documento a una o varias personas, con caducidad y acuse de lectura opcionales. Se señalan los que caducan en 30 días y los caducados. Un documento con acuse no se puede retirar.
- El acuse de lectura deja constancia de fecha y hora. No es una firma electrónica.
- Las nóminas no se gestionan en ChefChek.

## Privacidad

- Cada persona ve solo lo suyo. El coste hora solo lo ve gerencia.
- Los documentos son privados: los ven gerencia y su titular.
- Los avisos sobre personas (retrasos, documentos) aparecen en las pantallas de gerencia, no en la campana de notificaciones, que es común a todo el local.

## Copias de seguridad

La copia del cliente incluye los datos de los tres módulos. Al restaurar, los registros inalterables (fichajes, correcciones, hojas aprobadas, acuses) no se tocan salvo que se indique expresamente.
