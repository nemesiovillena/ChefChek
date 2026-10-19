# Recetas de bebida separadas y visibles por rol

Status: en curso · Rama `feat/recetas-bebidas-por-rol`

## Decisiones (usuario, 2026-10-19)
- Bebidas = recetas normales con casilla «Es bebida» (`Recipe.isDrink`).
- Quién las ve: configurable por rol en Accesos → nueva subsección `recipes.drinks` («Ver recetas de bebida»), por defecto permitida (no cambia nada hasta configurarlo). ADMIN/OWNER siempre las ven.
- Una bebida puede ser sub-receta de un plato (p. ej. café en tiramisú): dentro del plato se sigue viendo como ingrediente aunque el rol no tenga `recipes.drinks`.

## Cambios
Backend
- Migración aditiva `recipes.isDrink BOOLEAN NOT NULL DEFAULT false`.
- `SECTION_REGISTRY`: `recipes.drinks` hijo de `recipes`.
- DTO create/update: `isDrink?: boolean`.
- `findAll`: query `kind=food|drink` (por defecto food); sin `recipes.drinks` → siempre food.
- `findAllOptions` (picker sub-recetas, Cuiner): sin permiso → excluye bebidas.
- `findOne`: bebida sin permiso → 404.
- Asistente IA: sin permiso no resuelve bebidas por nombre.

Frontend
- Recetas: pestañas Comida / Bebidas (Bebidas solo con permiso); casilla «Es bebida» en el modal.
- Accesos por rol: aparece solo (lee el registro).

## Fuera de alcance
- Fichas técnicas / producción / etiquetado: sin cambios (siguen pudiendo usar cualquier receta).

## Validación
- Tests jest recipes + role-access + ai-assistant; tsc; eslint.
- Prueba local en :3300/:3301 con rol USER sin `recipes.drinks`.
