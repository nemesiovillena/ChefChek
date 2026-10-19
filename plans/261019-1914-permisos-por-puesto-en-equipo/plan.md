# Puestos en Equipo y permisos por puesto

Status: en curso · Rama `feat/permisos-por-puesto`

## Decisiones (usuario, 2026-10-19)
- Restringir apartados por puesto (cocina, barra, sala 1…), no solo por rol. Rol no distingue: en Warynessy los 10 usuarios son USER.
- Los puestos se gestionan desde **Equipo**, existan o no SICTED. «Todo lo que se pueda configurar desde Equipo, mejor».
- Se reutilizan los puestos existentes (`sicted_job_profiles` / `sicted_job_assignments`): sin migración de datos; SICTED sigue usándolos (misión, tareas, áreas de hojas).

## Regla de acceso
- ADMIN/OWNER/SUPERADMIN: sin cambios (ven todo).
- Resto: apartado visible si lo permite su rol **y** su puesto vigente. Sin puesto = solo rol.
- Config por puesto en `Configuration`: `positionAccess.{profileId}.{sectionKey}`; sin fila = permitido (el puesto solo resta).

## Cambios
Backend
- `RoleAccessService`: `isSectionAllowed`/`getSectionMapForUserRole` aceptan `userId` y aplican el puesto; config por puesto (leer/guardar).
- Llamadas con contexto de usuario pasan `userId` (guard, /role-access/me, recetas, asistente…).
- Nuevo controlador `api/v1/team/positions` (módulo Equipo `sala`): listar, crear, renombrar, archivar, asignar/quitar puesto a un usuario, leer/guardar permisos del puesto.

Frontend
- Equipo: pestañas **Personas / Puestos**; columna Puesto; selector de puesto en la ficha del usuario.
- Puestos: crear/renombrar/archivar y casillas «qué ve este puesto» (misma lista que Accesos por rol).

## Fuera de alcance
- Varios puestos a la vez por persona (el modelo actual es uno vigente).
- Migrar tablas a nombres neutros (`sicted_*` se quedan).

## Validación
- jest role-access, guard, recetas, asistente, nuevos tests de puestos; tsc; eslint.
- Local :3300/:3301: puesto Cocinero sin «Ver recetas de bebida» → usuario cocinero no ve Bebidas; camarero sí.
