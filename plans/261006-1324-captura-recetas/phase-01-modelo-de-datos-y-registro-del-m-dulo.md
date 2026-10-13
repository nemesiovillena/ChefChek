---
phase: 1
title: Modelo de datos y registro del módulo
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 1: Modelo de datos y registro del módulo

## Overview

Tablas de staging para las capturas, alta del módulo `captura-recetas` en los registros de módulos, secciones y navegación, y cobertura de las tablas nuevas en backup y fusión de artículos.

## Requirements

- Functional: persistir capturas con estado, origen, datos normalizados e ingredientes en texto libre con artículo opcional.
- Non-functional: migración solo aditiva (regla cero pérdida de datos); módulo apagado por defecto; el backup de tenant no pierde capturas.

## Architecture

```prisma
enum RecipeCaptureStatus { PROCESANDO PENDIENTE ERROR PASANDO PASADA DESCARTADA }
enum RecipeCaptureSource { URL TEXTO ARCHIVO }

model RecipeCapture {
  id             String              @id @default(cuid())
  tenantId       String
  source         RecipeCaptureSource
  sourceUrl      String?             // solo source=URL
  sourceFileName String?             // solo source=ARCHIVO (etiqueta en el listado)
  sourceText     String?             // solo source=TEXTO: lo pegado, para no perderlo si falla
  status         RecipeCaptureStatus @default(PROCESANDO)
  errorMessage   String?
  createdBy      String?

  // Receta normalizada (null mientras PROCESANDO/ERROR)
  name                   String?
  description            String?
  elaboration            String? // mismo JSON que Recipe.elaboration: {"steps":[...]}
  portions               Float?
  preparationTimeMinutes Int?
  cookingTimeMinutes     Int?

  // Paso a Recetas
  reservedRecipeId String?   // id reservado al reclamar (sin FK): permite recuperar un paso a medias
  claimedAt        DateTime? // cuándo entró en PASANDO
  recipeId         String?   // receta creada (status=PASADA); null si luego se eliminó

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant      Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipe      Recipe?                   @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  ingredients RecipeCaptureIngredient[]

  @@index([tenantId, status])
  @@map("recipe_captures")
}

model RecipeCaptureIngredient {
  id               String  @id @default(cuid())
  captureId        String
  rawText          String  // línea tal cual venía en la fuente
  name             String  // nombre normalizado del ingrediente
  quantity         Float?
  unit             String? // g | kg | ml | l | ud
  note             String?
  matchedProductId String?
  matchConfidence  Float?  // 0..1 de la sugerencia automática; null si lo eligió el usuario
  sortOrder        Int     @default(0)

  capture        RecipeCapture @relation(fields: [captureId], references: [id], onDelete: Cascade)
  matchedProduct Product?      @relation(fields: [matchedProductId], references: [id], onDelete: SetNull)

  @@index([captureId])
  @@map("recipe_capture_ingredients")
}
```

Sin `deletedAt`: descartar es el estado `DESCARTADA` (el middleware de borrado lógico de `prisma.service.ts` es una lista cerrada; así no hay que tocarlo ni filtrar a mano en cada consulta por una columna que se olvida).

Añadir las relaciones inversas en `Tenant`, `Recipe` y `Product`.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_recipe_captures/migration.sql`
- Modify: `backend/src/modules/modules/constants/registry.ts`
- Modify: `backend/src/modules/role-access/constants/section-registry.ts`
- Modify: `frontend/src/features/modules/lib/nav-config.ts`
- Modify: `backend/src/modules/backup/backup.constants.ts` (+ test de ida y vuelta)
- Modify: `backend/src/modules/products/products.service.ts` (fusión de artículos) + spec
- Modify: `backend/src/modules/modules/modules.service.spec.ts` (si enumera módulos)

## Implementation Steps

1. Añadir enums y modelos al esquema, con relaciones inversas.
2. Generar la migración con `prisma migrate diff` (no hay TTY para `migrate dev`). La BD dev es compartida entre ramas: revisar el SQL y quitar cualquier `DROP` de tablas de otras ramas antes de aplicar.
3. Aplicar en dev (Postgres brew `:5432`, no el de docker) y en `chefchek_test`; `prisma generate`.
4. `MODULE_REGISTRY`: `{ id: "captura-recetas", name: "Captura de recetas", description: "Importa recetas desde una web, texto o foto con IA y las deja en revisión antes de pasarlas a Recetas", dependencies: ["recipes"], alwaysActive: false, defaultEnabled: false }`.
5. `SECTION_REGISTRY` (bloque Cocina): `{ key: "captura-recetas", label: "Captura de recetas", moduleId: "captura-recetas", defaultAllowed: true }`.
6. `nav-config.ts`: ítem en el grupo Cocina tras "Recetas" (`href: '/dashboard/captura-recetas'`, `moduleId: 'captura-recetas'`, `icon: 'travel_explore'`) y entrada en `ROUTE_MODULE_MAP`.
7. Backup: `recipe_capture_ingredients` no tiene `tenantId`, así que necesita regla explícita en `CHILD_SCOPE_RULES`: `recipe_capture_ingredients: [{ parent: "recipe_captures", col: "captureId" }]` (mismo caso que `catalog_import_lines`). Test: exportar → restaurar un tenant con una captura y sus ingredientes los conserva.
8. Fusión de artículos (`ProductsService.merge`): añadir `recipeCaptureIngredient.updateMany` que reapunte `matchedProductId` del artículo origen al destino, junto al de `catalogImportLine`. Test.

## Success Criteria

- [ ] Migración aplica en dev y test sin tocar tablas existentes.
- [ ] El módulo aparece en la pantalla de módulos del tenant, apagado por defecto.
- [ ] La sección aparece en permisos por rol.
- [ ] Al activar el módulo aparece "Captura de recetas" en el menú Cocina.
- [ ] Backup de tenant: ida y vuelta conserva capturas e ingredientes.
- [ ] Fusionar dos artículos mantiene el vínculo de los ingredientes capturados.
- [ ] `modules.service.spec.ts` en verde.

## Risk Assessment

- **BD dev compartida** → el diff puede proponer borrar tablas de otras ramas. Mitigación: revisar el SQL a mano (paso 2).
- **Restaurar un backup anterior a esta función**: se reinsertan recetas y artículos, y los `SetNull` vacían `recipeId` y `matchedProductId` de las capturas existentes. Se acepta y se documenta: las capturas siguen ahí, pierden vínculos y hay que volver a vincular.
- **Dependencias de módulos**: hoy solo se comprueban al desactivar. No se promete bloqueo al activar; la fase 4 comprueba en el servicio que `recipes` está activo antes de pasar.
- Rollback: la migración solo crea dos tablas y dos enums; revertir = `DROP` de esos objetos.
