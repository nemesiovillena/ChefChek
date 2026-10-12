# Research: fichas de Fichar alimentadas desde Equipo + credencial única

Fecha: 2026-10-12 20:53 (Europe/Madrid). Fuente: código y BD local (clon Warynessy). Sin búsqueda web: es una cuestión interna de modelo de datos.

## Resumen

- Hoy **Equipo** (`User`) y **Fichar** (`Employee`) son dos tablas con enlace opcional 1:1 (`Employee.userId`). Solo se copia el nombre **una vez**, al importar. Después no hay sincronización: cambiar el nombre en Equipo no cambia la ficha.
- Los datos que pide Fichar (DNI, NAF, puesto, contrato, horas, coste) **no existen en Equipo**. No se pueden "traer": hay que decidir dónde se editan.
- En Equipo **no hay contraseña de firma**: solo la contraseña de acceso (`User.passwordHash`). El único PIN del sistema es el de kiosco, y vive en la ficha de Fichar (`Employee.pinHash`).
- Viable. Recomendación: Equipo como única pantalla de edición (pestaña "Datos laborales"), nombre siempre leído de Equipo, y **un PIN único guardado en Equipo**. No recomiendo usar la contraseña de acceso en el kiosco (ver §3).

## 1. Estado actual

| | Equipo (`users`) | Fichar (`employees`) |
|---|---|---|
| Pantalla | `/dashboard/users` (`user-modal.tsx`) | `/dashboard/check-in/empleados` (`check-in-employee-form.tsx`) |
| Identidad | `name`, `email`, `avatarUrl` | `firstName`, `lastName` (copia) |
| Contacto | `street`, `city`, `phone`, `whatsapp`, `payrollEmail` | — |
| Laboral | — | `nationalId`, `socialSecurityNumber`, `jobTitle`, `section`, `contractType`, `weeklyHours`, `hourlyCost`, `hireDate`, `terminationDate`, centros |
| Credencial | `passwordHash` (login) | `pinHash` + bloqueo 5 intentos / 15 min |
| Otros | `role`, `isActive`, `isSharedAccount` | `isActive` |

Hechos verificados:

- Enlace: `Employee.userId String? @unique`, `onDelete: SetNull`. Opcional a propósito: el formulario ofrece "Sin cuenta (solo ficha en kiosco con PIN)".
- "Importar del equipo" (`EmployeesService.importFromUsers`) crea la ficha con `splitFullName(user.name)` y el puesto sugerido de SICTED. Copia puntual.
- Kiosco: teclado numérico, envía solo al llegar a `pinLength` dígitos (`fichar/page.tsx`). Sin red, el PIN se cifra con RSA del tenant y se valida al sincronizar (`punch.service.ts → verifyOfflinePin`).
- Cuenta personal: ficha sin PIN, la sesión identifica.
- BD local (Warynessy): 10 usuarios personales, 9 fichas con cuenta, **2 fichas sin cuenta**.

## 2. Datos: tres opciones

**A. Fusionar tablas** (campos laborales dentro de `users`). Descartada: `time_punches` y demás tablas de evidencia referencian `employeeId` y son inalterables por trigger; además impide fichas sin cuenta. Migración de alto riesgo sin beneficio visible.

**B. Mantener dos tablas, Equipo manda (recomendada).**
- `Employee` conserva solo lo laboral. Con cuenta enlazada, nombre = `User.name` siempre (dejar de usar la copia; `firstName/lastName` quedan solo para fichas sin cuenta).
- `isActive`: baja en Equipo ⇒ ficha inactiva.
- Edición en un solo sitio: pestaña **"Datos laborales"** en el modal de Equipo (solo ADMIN/OWNER, solo si el módulo Fichar está activo). Guarda sobre `employees`.
- Alta de usuario personal ⇒ ficha creada automáticamente con el centro por defecto.
- `Fichar → Empleados` queda como listado (centro, PIN sí/no, estado) con enlace a la ficha de Equipo.

**C. Mínimo**: dejar todo como está y solo re-sincronizar nombre/activo desde Equipo. Barato, pero sigue habiendo dos formularios. No cumple "los campos vengan de Equipo".

## 3. Credencial: "la misma que en Equipo"

Lo literal (contraseña de login en el kiosco) es posible técnicamente, pero es mala idea:

- **Exposición**: se teclea en una tablet compartida a la vista de todos. Quien la vea entra en la app con ese usuario, incluido un ADMIN (costes, proveedores, DNI y NAF del personal).
- **Uso**: teclado completo en vez de 4 dígitos con envío automático. Más lento en cada fichaje.
- **Offline**: la cola del kiosco guardaría contraseñas de acceso cifradas, no PINs.
- **Bloqueo**: 5 fallos en el kiosco tendrían que bloquear… ¿el login también?
- **Fichas sin cuenta**: no tienen contraseña; seguirían necesitando PIN.

Alternativa que cumple el objetivo ("una sola clave, gestionada en Equipo"):

- Mover el PIN a Equipo: `User.pinHash` (+ contadores de bloqueo). Se asigna y cambia desde el modal de Equipo; cada persona puede cambiar el suyo desde su perfil.
- El kiosco valida contra el PIN del usuario enlazado. Teclado numérico y offline no cambian.
- El mismo PIN queda disponible para firmar en cuenta compartida en otros módulos (SICTED "Quién", etiquetas), que hoy solo eligen nombre sin verificar. Fuera de alcance inicial.
- Fichas sin cuenta: conservan `Employee.pinHash`.

## 4. Alcance estimado (opción B + PIN en Equipo)

1. Migración: `users.pinHash`, `pinFailedAttempts`, `pinLockedUntil`; copiar PIN de fichas enlazadas. Aditiva, sin borrar columnas.
2. Backend: `EmployeePinService` resuelve el PIN en `User` si hay cuenta, si no en `Employee`. Nombre derivado de `User`. Alta/baja de usuario propaga a la ficha. Endpoints laborales accesibles desde Equipo.
3. Frontend: pestaña "Datos laborales" + sección PIN en `user-modal.tsx`; `Empleados` pasa a listado.
4. Tests: PIN service, employees service, e2e de alta de usuario ⇒ ficha.

Riesgos: permisos (Equipo lo ve ADMIN; DNI/NAF deben seguir ocultos a cuentas compartidas, como exige `CheckInManagerGuard`); el informe de inspección usa nombre de la ficha — comprobar que lee el nombre derivado.

## Preguntas sin resolver

1. "Contraseñas para firmar": ¿te refieres a la contraseña de acceso de Equipo, o te vale un PIN único gestionado desde Equipo?
2. ¿"Firmar" es solo fichar en el kiosco, o también firmar registros en otros módulos (SICTED, etiquetas)?
3. ¿Sigue habiendo personal sin cuenta en Equipo (hoy 2 fichas en Warynessy), o todo el que ficha tendrá usuario?
4. ¿La edición de datos laborales se muda a Equipo y `Fichar → Empleados` queda solo como listado?
