# Research: ¿ADMIN = OWNER en ChefChek?

Fecha: 2026-09-30 16:05 · Fuente: solo código del repo (0 búsquedas web)

## Respuesta

**En la práctica sí: ADMIN puede hacer lo mismo que OWNER dentro del restaurante.** Una sola diferencia real en la interfaz (Etiquetado, a favor de ADMIN) y una asimetría de gestión: OWNER no se puede volver a asignar desde la app.

## Evidencia

| Punto | Hallazgo | Fichero |
|---|---|---|
| Guard registrado | Jerárquico: SUPERADMIN 5 > OWNER 4 > ADMIN 3 > USER 2 > VIEWER 1; pasa si nivel ≥ requerido | `backend/src/guards/roles.guard.ts`, `users.service.ts:348` |
| Endpoints solo OWNER | Ninguno (`@Roles` con OWNER siempre incluye ADMIN) | grep `@Roles` |
| Endpoints solo ADMIN (p. ej. Compras) | OWNER también pasa por jerarquía | `compras.controller.ts` |
| Permisos por sección | OWNER y ADMIN se saltan el filtro por igual | `section-registry.ts:187` |
| Frontend | Todas las listas incluyen ambos (`['ADMIN','OWNER','SUPERADMIN']`) | sicted, compras, backups, artículos, proveedores, ajustes |
| Excepción | Ajustes → Etiquetado: `isAdmin = role === 'ADMIN'` → OWNER no veía campos; ADMIN sí | `etiquetado-config-section.tsx:61` |
| Asignar rol | DTO usuarios solo admite `ADMIN / USER / VIEWER` → OWNER no se puede volver a poner desde la app | `users/dto/create-user.dto.ts:16,68` |

Nota: existe un 2º RolesGuard de coincidencia exacta (`modules/auth/roles.guard.ts`) pero no lo usa ningún controller.

## Impacto del cambio Warynessy OWNER → USER

Pierde (cuenta compartida de cocina):
- Validar hojas SICTED («Aprobado por») — `SUPERVISOR_ROLES`.
- Editar Plan SICTED, personas, mantenimiento, dirección, proveedores SICTED.
- Gestión Compras (pedidos: revertir, ofertas, endpoints `@Roles("ADMIN")`).
- Copias de seguridad, gestionar artículos/proveedores, Ajustes de gestión, Permisos por rol.
- Además solo verá las secciones que «Permisos por rol» habilite para USER.

Conserva: tareas diarias con rol USER (marcar hojas, etiquetar, compras operativas `ADMIN,USER`).

## Preguntas abiertas

- ¿Alguien validará hojas SICTED en la tablet de cocina? Ahora exige iniciar sesión como ADMIN.
- ¿Quieres poder volver a asignar OWNER desde la app, o que quede solo vía superadmin/BD?
- ¿Unificar el check de Etiquetado (`role === 'ADMIN'`) para incluir OWNER/SUPERADMIN?
