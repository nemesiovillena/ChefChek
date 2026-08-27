# Vista visual de receta en pantalla

## Status: done

## Contexto
Hoy la receta solo se ve como PDF (Ficha técnica / Receta imprimible). Se pide
una vista visual en pantalla (imagen, ingredientes, pasos) responsiva
(móvil/tablet/desktop), con icono de imprimir que reutiliza el PDF actual sin
tocarlo.

Decisiones del usuario:
- Desktop: nuevo botón "Vista visual" junto a los iconos PDF existentes (no
  los sustituye).
- Móvil: tocar la fila abre la vista visual en vez del PDF directo.
- Se añade también subida de imagen de receta (el backend ya tenía el
  endpoint pero `imageUrl` nunca se guardaba/devolvía en el CRUD — bug
  preexistente, se corrige en fase 1).

## Fases
1. `phase-01-backend-imageurl.md` — completar `imageUrl` en DTO/service/response de recipes.
2. `phase-02-frontend-visual-view.md` — hook de subida de imagen, campo en el modal, y componente de vista visual + puntos de entrada.

## Criterios de aceptación
- Crear/editar receta con imagen: se sube, se guarda, se ve en listado tras recargar.
- Botón "Vista visual" (desktop) y tap de fila (móvil) abren la nueva vista.
- Vista visual: imagen (o placeholder), ingredientes, pasos con equipo/tiempo/temperatura, alérgenos, responsiva.
- Icono imprimir dentro de la vista visual genera el mismo PDF "Receta" que ya existe (sin cambios en el PDF).
- Iconos "Receta"/"Ficha técnica" en desktop siguen funcionando igual.
- `bun run typecheck` (o build) limpio en backend y frontend.

## Sin resolver
- Ninguna.
