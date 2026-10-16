# Research: ocultar apartados de Personal al empleado desde Configuración → Check-in

Fecha: 2026-10-14 16:52 · Rama base: develop · Fuente: código del repo (sin búsqueda web: no hace falta)

## Resumen

Petición: en Configuración → bloque «Check-in», checks para que el empleado NO vea: Registro de jornada, Turnos, Ausencias y vacaciones, Mi espacio, Fichar y el botón Solicitar ausencia.

Viable y barato (~1 PR, sin endpoints nuevos salvo 5 columnas). Ya existe el patrón exacto: `CheckInSettings.show*` + `display` en `GET /check-in/me` (PR #285). Encaja ampliarlo.

**Conflicto con decisión previa (2026-10-07):** se decidió NO ofrecer ocultar el Registro de jornada (art. 34.9 ET: el trabajador tiene derecho a consultarlo). El propio panel lo dice hoy: «El Registro de jornada no se puede ocultar». Hay que decidir antes de implementar (ver Preguntas).

## Estado actual

| Apartado | Ruta | Módulo | Gating actual |
|---|---|---|---|
| Mi espacio | `/dashboard/mi-espacio` | `rrhh` | módulo + rol (sección `rrhh`) + `personalAccountOnly` |
| Fichar | `/dashboard/check-in` | `check-in` | módulo + rol (sección `check-in`) |
| Registro de jornada | `/dashboard/check-in/jornadas` | `check-in` | ídem + `personalAccountOnly` |
| Turnos | `/dashboard/turnos/planificador` | `turnos` | módulo + rol (sección `turnos`) |
| Ausencias y vacaciones | `/dashboard/turnos/ausencias` | `turnos` | ídem |

Archivos clave:
- `frontend/src/features/modules/lib/nav-config.ts:110-122` — grupo «Personal».
- `frontend/src/app/dashboard/layout.tsx:63-76,128-140,373` — filtro de menú y bloqueo de URL directa (`isEnabled` + `canSee`).
- `backend/prisma/schema.prisma:3556` — `CheckInSettings` (4 `show*` ya existentes).
- `backend/src/modules/check-in/services/punch.service.ts:515` — `display` (gestor siempre ve todo).
- `frontend/src/app/dashboard/settings/components/check-in-config-section.tsx` — UI de los checks.
- `frontend/src/app/dashboard/mi-espacio/page.tsx` — Mi espacio embebe tarjeta de fichar, enlace a jornadas, próximos turnos y pestaña Ausencias.
- `frontend/src/app/login/page.tsx:35` — empleados aterrizan en `/dashboard/mi-espacio`.

### Por qué NO usar «Permisos por rol»
Ya existe `RoleAccessPanel` (USER/VIEWER por sección), pero:
- granularidad = módulo: `check-in` agrupa Fichar + Registro + gestión; `turnos` agrupa Turnos + Ausencias. No separa.
- ocultar sección `check-in` → `@RequireSection("check-in")` devuelve 403 en la API → rompe también el fichaje desde kiosco/cuentas.
- decisión previa: bloques del portal del empleado se configuran en `CheckInSettings`, no como permisos por rol.

### «Solicitar ausencia» (añadido a petición del usuario)
No es un apartado del menú: es el botón `own-absences-tab.tsx:89-95` (abre `AbsenceForm mode="own"`). `OwnAbsencesTab` se usa en 2 sitios (pestaña Ausencias de Mi espacio y pestaña «Mías» de `/dashboard/turnos/ausencias`), así que un solo cambio cubre los dos. Ocultarlo deja al empleado ver su saldo y sus ausencias, pero sin poder pedir nuevas (las registra el gestor).
- Comprobado: «Nueva solicitud» de Mi espacio → Solicitudes (`my-requests-tab.tsx:68`) solo envía texto libre (`kind: 'OTHER'`), no crea ausencias. No hace falta tocarlo, aunque el empleado podría pedir unas vacaciones por escrito ahí.
- Igual que el resto: solo interfaz. Si se quiere que sea una regla real, `POST` de ausencia propia debería rechazar con 403 cuando `showAbsenceRequest=false` (decisión pendiente).

## Recomendación (KISS)

1. **Schema**: 6 booleanos en `CheckInSettings`, default `true` (cero cambio para tenants actuales):
   `showMySpace`, `showClockIn`, `showWorkdayRecord`, `showShifts`, `showAbsences`, `showAbsenceRequest`. Migración vía `migrate diff` limpiando DROPs ajenos (BD dev compartida).
2. **Backend**: DTO de settings + `display` en `getOwnState` con la misma regla `actor.isManager || settings.x`. Solo interfaz; la API no cambia permisos (igual que los 4 actuales).
3. **Frontend nav**: nuevo campo opcional en `NavItem`, p. ej. `employeeDisplayKey: 'showShifts'`; el layout oculta el item y redirige la URL directa si `display[key] === false`. `display` viene de `GET /check-in/me` (hook existente). Gestor nunca afectado.
4. **Mi espacio coherente**: si `showClockIn=false` ocultar `CheckInPersonalCard` y enlace «Pantalla de fichaje»; `showWorkdayRecord=false` → quitar enlace «Mis fichajes»; `showShifts=false` → quitar «Mis próximos turnos»; `showAbsences=false` → quitar pestaña Ausencias; `showAbsenceRequest=false` → ocultar botón «Solicitar ausencia» en `OwnAbsencesTab`.
5. **Login**: si `showMySpace=false`, aterrizar en `/dashboard` (no en Mi espacio).
6. **Panel**: añadir los 6 checks al `TOGGLES` existente; actualizar el texto legal del encabezado según la decisión.

```ts
// punch.service.ts — misma forma que hoy
const display = {
  ...,
  showMySpace: actor.isManager || settings.showMySpace,
  showClockIn: actor.isManager || settings.showClockIn,
  showWorkdayRecord: actor.isManager || settings.showWorkdayRecord,
  showShifts: actor.isManager || settings.showShifts,
  showAbsences: actor.isManager || settings.showAbsences,
  showAbsenceRequest: actor.isManager || settings.showAbsenceRequest,
};
```

## Riesgos / trampas

- **Legal (Registro de jornada)**: art. 34.9 ET obliga a conservar el registro 4 años y tenerlo a disposición de trabajadores, representantes e Inspección. Ocultarlo en la app es defendible solo si el trabajador tiene otra vía real (p. ej. hoja firmada / PDF entregado por la empresa). Riesgo asumido por el tenant → mínimo, texto de aviso en el check.
- **Fichar oculto ≠ no fichar**: si se oculta Fichar a la cuenta personal, el empleado debe fichar en el kiosco `/fichar`. Si el local no tiene kiosco, nadie podría fichar → avisar en el texto del check.
- **Módulos distintos**: Turnos/Ausencias dependen del módulo `turnos`, Mi espacio de `rrhh`. Los checks deben mostrarse solo si el módulo correspondiente está activo (o aparecer desactivados), para no confundir. Sitio: bloque «Check-in» pedido por el usuario aunque abarque 3 módulos — quizá renombrar a «Personal».
- **`display` hoy solo vive en `/check-in/me`** (requiere módulo check-in). Si un tenant tiene `turnos`/`rrhh` sin `check-in`, el layout no tendría `display` → tratar ausencia como «visible».
- **Cuentas compartidas**: ya ocultan la mayoría (`personalAccountOnly`); no cambian.
- **Avisos sueltos**: notificaciones/enlaces que lleven a una ruta oculta → la redirección del layout los cubre.

## Esfuerzo
~0,5–1 día: migración + DTO + `display` + nav flag + Mi espacio + login + 6 checks + tests (unit `check-in-settings.service.spec`, e2e `check-in-foundations`/`rrhh-mi-espacio`).

## Preguntas sin resolver
1. ¿Se permite ahora ocultar el Registro de jornada (revierte decisión 2026-10-07 por art. 34.9 ET)? Opciones: (a) permitirlo con aviso legal, (b) mantenerlo no ocultable, (c) ocultar solo del menú pero dejar el enlace dentro de Mi espacio.
2. «Fichar» oculto: ¿solo la página `/dashboard/check-in` del menú, o también la tarjeta de fichar dentro de Mi espacio (el empleado solo fichará en kiosco)?
3. Si se oculta Mi espacio, ¿a dónde aterriza el empleado al entrar? (propuesta: `/dashboard`).
4. «Solicitar ausencia» oculto: ¿solo interfaz (como los demás) o también que la API rechace la solicitud propia?
5. ¿Mantener el bloque con nombre «Check-in» o renombrarlo a «Personal», ya que cubre Turnos y RRHH?
