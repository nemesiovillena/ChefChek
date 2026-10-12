# Plan: fichas de Fichar alimentadas desde Equipo y contraseña única

Estado: IMPLEMENTADO, EN REVISIÓN · PR #335 (fase 1) ← #336 (fase 2) ← fase 3, apilados · Creado 2026-10-12
Research: `../reports/research-261012-2053-fichar-fichas-desde-equipo-y-credencial-unica-report.md`

## Decisiones del usuario (2026-10-12)

1. La clave para fichar en kiosco es **la contraseña de acceso de Equipo** (no un PIN aparte).
2. De momento solo se usa en el kiosco; debe quedar reutilizable para firmar en otros módulos.
3. Seguirá habiendo personal que ficha **sin cuenta** en Equipo.
4. Los datos laborales se editan en **Equipo**; `Fichar → Empleados` queda como listado.

Consecuencia de 1+3: las fichas sin cuenta no tienen contraseña, así que **conservan el PIN numérico**. El kiosco muestra contraseña o PIN según la persona.

## Fases

| # | Fase | Depende de | Fichero |
|---|---|---|---|
| 1 | Equipo como fuente de datos (backend) | — | `phase-01-equipo-fuente-de-datos-backend.md` |
| 2 | Datos laborales en Equipo y Empleados como listado (frontend) | 1 | `phase-02-datos-laborales-en-equipo-frontend.md` |
| 3 | Contraseña de Equipo en el kiosco | 1 | `phase-03-contrasena-de-equipo-en-kiosco.md` |

Sin migraciones de esquema: se reutilizan `Employee.userId`, `pinFailedAttempts` y `pinLockedUntil`. No se borra ningún dato (los PIN de fichas con cuenta dejan de usarse, pero no se eliminan).

Un PR por fase contra `develop`.

## Criterios de aceptación

- Crear un usuario personal en Equipo crea su ficha de Fichar con el centro por defecto.
- Cambiar nombre o dar de baja en Equipo se refleja en la ficha sin tocar Fichar.
- DNI, NAF, puesto, contrato, horas, coste, fechas y centros se editan desde la ficha de Equipo.
- En el kiosco, quien tiene cuenta ficha con su contraseña de Equipo; quien no, con su PIN.
- 3 fallos seguidos en el kiosco bloquean a esa persona 15 min **en el kiosco**, no su login.
- Fichaje sin conexión sigue funcionando con contraseña.
- Los fichajes existentes y sus informes no cambian.

## Riesgos aceptados

- La contraseña de acceso se teclea en un dispositivo compartido. Mitigación: campo oculto, sin autocompletar ni guardar, bloqueo por intentos. Riesgo residual asumido por decisión 1.

## Decisiones adicionales (2026-10-12)

5. Bloqueo en kiosco: **3 fallos** seguidos ⇒ 15 min, solo en el kiosco (no afecta al login). Aplica a contraseña y a PIN.
6. Sin transición: desde el despliegue de la fase 3, quien tiene cuenta ficha con la clave de Equipo. Las contraseñas de Equipo admiten 4 caracteres y el personal las usa como PIN: el kiosco mantiene teclado numérico por defecto, con opción de teclado completo.
7. Usuarios sin ficha: se mantiene «Importar del equipo»; no se crean en bloque al desplegar.

## Desviaciones respecto al plan

- Fase 1: el nombre no se deriva en lectura; `firstName/lastName` de una ficha vinculada son una copia que se reescribe al guardar la cuenta en Equipo. Evita tocar informes y fichajes, que leen esas columnas.
- Fase 2: no se extrajo un componente de campos; la pestaña de Equipo incrusta el formulario de ficha existente.
- Fase 3: `EmployeePinService` conserva nombre y fichero (ya se exporta en `CheckInModule`); el punto reutilizable es `verifyCredential`.

## Pendiente de probar

- Fichaje sin conexión con contraseña (el service worker solo existe en build de producción).
