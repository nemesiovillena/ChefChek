# Fase 2 — Datos laborales en Equipo; Empleados como listado (frontend)

## Contexto
- `frontend/src/app/dashboard/users/components/user-modal.tsx` (312 líneas, sin pestañas)
- `frontend/src/app/dashboard/users/page.tsx`
- `frontend/src/app/dashboard/check-in/empleados/page.tsx`
- `frontend/src/app/dashboard/check-in/components/check-in-employee-form.tsx`
- `frontend/src/hooks/use-check-in.ts`

## Requisitos
- Modal de Equipo con dos pestañas: «Datos» (lo actual) y «Datos laborales» (DNI/NIE, NAF, puesto, sección, contrato, horas semanales, coste hora, alta, baja, centros).
- «Datos laborales» solo visible si: módulo `check-in` activo, quien edita puede gestionar Fichar (`canManageCheckIn`: ADMIN/OWNER desde cuenta personal) y el usuario editado no es compartido.
- `Fichar → Empleados`: listado (nombre, puesto, centro, estado, cómo ficha). Fila con cuenta ⇒ abre la ficha de Equipo en «Datos laborales». Fila sin cuenta ⇒ formulario actual (nombre, datos laborales, PIN).
- «Nuevo empleado» en Empleados crea solo fichas **sin cuenta**; para personal con cuenta, enlace a «Nuevo usuario» en Equipo.

## Ficheros
- Crear: `frontend/src/app/dashboard/users/components/user-labor-data-tab.tsx` (extrae los campos laborales del formulario actual para reutilizarlos en ambos sitios).
- Modificar: `user-modal.tsx` (pestañas con `useState` y `role="tablist"`, patrón de modales del proyecto), `check-in-employee-form.tsx` (usa el componente extraído; oculta selector de cuenta), `empleados/page.tsx`.

## Pasos
1. Extraer campos laborales a componente compartido (DRY).
2. Pestañas en `user-modal.tsx`; guardar laborales con `useUpdateEmployee` sobre la ficha enlazada.
3. Adaptar listado y navegación de Empleados.
4. Invalidar `employees` y `users` tras guardar en cualquiera de los dos sitios.

## Validación
- `bunx tsc --noEmit`, `bunx eslint` sobre lo tocado.
- Manual en local (tenant `chefchek-demo`): editar laborales desde Equipo y verlo en Empleados; ficha sin cuenta sigue editable; cuenta compartida no muestra la pestaña.
- Móvil: modal usable a 375 px, inputs ≥16 px.

## Riesgos / rollback
- Modal de Equipo crece: mantener la pestaña en fichero propio.
- Rollback: revertir el PR; backend de fase 1 sigue siendo compatible con la UI anterior.
