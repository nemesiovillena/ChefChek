# Investigación: etiqueta de plato elaborado SIN receta en el sistema

Fecha: 2026-09-30 · Caso real: «Arroz de calamar y almejas», no existe como receta → no se puede etiquetar.

## Resumen

Se puede hacer **sin migración de BD**. El modelo `FoodLabel` ya guarda todo como instantánea (`itemName`, `allergens`, conservación) y `recipeId` ya es opcional. El único bloqueo es de código: el backend exige `recipeId` (`loadRecipeContext`) y el front solo ofrece un `<select>` de recetas.

**Recomendación:** mantener `labelType = ELABORATED` y permitir `recipeId` vacío + nombre libre + alérgenos declarados a mano. **No** crear un tercer tipo.

## Estado actual (verificado en el código)

| Pieza | Hoy | Archivo |
|---|---|---|
| Schema | `recipeId String?`, `itemName` instantánea, `allergens Int[]` instantánea | `backend/prisma/schema.prisma:2807` |
| DTO | `recipeId?` opcional, sin `itemName` ni `allergens` | `dto/create-food-label.dto.ts` |
| Servicio | `loadRecipeContext` lanza 400 si falta `recipeId` | `services/food-label.service.ts:900` |
| Nº de lote | `PREFIJO-DDMMAA-NN` a partir del **nombre** (no del id) | `services/lot-number.service.ts` |
| Impresión PDF/ZPL | usa `itemName` y `allergens` de la instantánea | `util/food-label-print-format.util.ts` |
| Editar etiqueta | si no hay receta → vuelve a la conservación guardada en la etiqueta (try/catch) | `food-label.service.ts` `loadBaseConservation` |
| Front paso 1 | botones Plato/Artículo + `<select>` de recetas; `ready` exige `recipeCtx.data` | `frontend/.../etiquetado/nueva/page.tsx:146,321` |
| Rejilla de alérgenos | ya existe (webp oficiales) | `frontend/.../articulos/components/tab-alergenos.tsx` |

## Opciones

| | A. ELABORATED sin receta (recomendada) | B. Nuevo tipo `FREE` | C. Crear receta rápida |
|---|---|---|---|
| Migración | No | No (String), pero hay que ampliar `LABEL_TYPES` | No |
| Sitios tocados | DTO, servicio, página nueva | + ~10 ternarios `ELABORATED ? … : 'Artículo'` que lo mostrarían como «Artículo» (listado, caducidades, detalle, `/e/[qrToken]`, dashboard, formulario de edición) | modal de receta |
| Caducidades / filtro «Elaboraciones» | Funciona igual | Hay que tocar el filtro | Funciona |
| Efectos secundarios | Ninguno | Riesgo de que falte algún sitio | Ensucia el catálogo de recetas y escandallos con recetas vacías sin coste |

B no aporta nada: un plato sin receta **es** una elaboración. C obliga a crear una receta vacía solo para imprimir.

## Diseño propuesto (A)

### Backend
1. `CreateFoodLabelDto`: añadir `itemName?: string` y `allergens?: number[]` (`@IsInt({each:true})`, rango 1-14).
2. `createLabel`: si `ELABORATED` y **no** hay `recipeId` → contexto libre:
   - `name = dto.itemName.trim()` (obligatorio; 400 si está vacío)
   - `allergens = dto.allergens` (obligatorio que venga el array, aunque sea `[]`: declaración explícita)
   - `conservation` = todo null → el override del DTO manda; ya se valida `storageCondition` y vida útil.
   - `ingredientLots = []` (la v1 no guarda lotes de ingredientes).
3. El nº de lote no cambia: `ARRO-300926-01` sale del nombre.
4. Tests: `food-label.service.spec.ts` → crear sin receta ok; sin `itemName` → 400; sin `allergens` → 400.

### Frontend (`nueva/page.tsx`)
1. En «Plato elaborado», debajo del select: enlace **«¿No está en recetas? Escribe el nombre»** → cambia a modo libre (input de nombre). Opcional: tercer botón «Plato sin receta».
2. Modo libre → `ready` cuando el nombre no está vacío.
3. Paso 2 en modo libre: sección **Alérgenos** con rejilla de iconos + casilla **«No contiene alérgenos»**. No se puede guardar hasta marcar al menos un alérgeno o esa casilla (Reglamento UE 1169/2011: los alérgenos son información obligatoria; un vacío por despiste es un fallo real).
4. Conservación: igual que ahora; los valores por defecto del tenant ya se rellenan al elegir Refrig./Congel.
5. Extraer la rejilla de `tab-alergenos.tsx` a `components/shared/` si no se puede reutilizar tal cual (tiene props `hideAllergens` propias de artículos).

### Opcional (v2, no hace falta ya)
- Lotes de ingredientes en texto libre (añadir filas nombre + lote) para trazabilidad del plato libre.
- Botón «Crear receta a partir de esta etiqueta» si el plato se repite.
- Filtro/aviso en el listado de etiquetas: «sin receta».

## Riesgos
- **Alérgenos incorrectos**: el más importante. Sin receta no hay cálculo automático → depende de lo que declare el cocinero. Mitigación: declaración obligatoria explícita (punto 3).
- Editar una etiqueta libre: hoy el formulario de edición no toca alérgenos ni nombre; si se equivoca en eso → anular y crear otra (igual que ahora con las recetas).
- La ficha pública del QR muestra `itemName` + alérgenos de la instantánea → funciona sin cambios (verificar visualmente).

## Esfuerzo
Pequeño: unos 3 archivos del backend + 1 página del front (+ extraer la rejilla). Sin migración ni despliegue especial.

## Preguntas pendientes
1. ¿Enlace dentro de «Plato elaborado» o tercer botón visible «Plato sin receta»?
2. ¿Hace falta ya el listado de ingredientes con lote en texto libre (trazabilidad APPCC/SICTED) o basta con nombre + alérgenos + notas?
3. ¿Se obliga a declarar alérgenos (propuesta) o se permite dejarlo vacío?
