# Fase 1 — Backend: medidas y consumo

## Archivos
- `backend/prisma/schema.prisma` + migración nueva
- `backend/src/modules/cuiner/dto/cuiner.dto.ts`
- `backend/src/modules/cuiner/cuiner-mapping.service.ts` (setDishMap, listMaps)
- nuevo `backend/src/modules/cuiner/cuiner-serving-measures.service.ts` (+ spec)
- `backend/src/modules/cuiner/cuiner.controller.ts`
- `backend/src/modules/cuiner/cuiner-recipe-consumption.ts` (directProductFormats)
- `backend/src/modules/cuiner/cuiner-stock.service.ts` (buildPlan pasa la medida)
- `backend/src/modules/cuiner/cuiner-overview.service.ts` (devolver medida del enlace)
- `backend/src/modules/backup/*` si exige registrar tablas nuevas (CHILD_SCOPE_RULES)

## Modelo
```prisma
model ServingMeasure {
  id        String   @id @default(cuid())
  tenantId  String
  name      String          // "Chupito"
  quantity  Float           // 4
  unit      String          // cl | ml | l | g | kg | ud
  keywords  String[]        // ["CHUPITO","CHUP"] palabras del nombre del plato
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([tenantId, name])
  @@map("serving_measures")
}
// CuinerDishMap: + servingMeasureId String? (FK onDelete: Restrict)
```

## Pasos
1. Modelo + migración (diff, limpiar SQL ajeno).
2. Siembra perezosa: primer GET sin medidas → crea por defecto:
   Chupito 4 cl [CHUPITO,CHUP] · Piedra 5 cl [PIEDRA] · Tubo 5 cl [TUBO] · Combinado 6 cl [COMBI,COMBINADO] ·
   Copa licor 5 cl [COPA] · Copa vino 15 cl [COPA,CATAVINO] · Caña 20 cl [CAÑA] · Caña doble 40 cl [CAÑA DOBLE] ·
   Jarra 50 cl [JARRA] · Café 7 g [CAFE,CORTADO,AMERICANO].
3. CRUD `GET/POST/PATCH/DELETE /cuiner/serving-measures`. DELETE con platos enlazados → 409 con recuento.
4. `SetDishMapDto.servingMeasureId?` solo válido con productId. Validar categoría unidad medida == unidad referencia artículo (getUnitMeta); `ud` siempre válida si ref es ud.
5. Consumo: `directProductFormats(units, product, measure?)` → `units × qty × factor(measure.unit→ref) / unitSize`; sin medida = actual.
6. Overview/listMaps incluyen `{ servingMeasure: { id, name, quantity, unit } }`.

## Tests (jest)
- Barceló 0,7 L ref litro unitSize 0,7 + chupito 4 cl × 10 → 0,5714.
- Barril 30 L + caña 20 cl × 150 → 1.
- Sin medida → igual que hoy (regresión).
- Medida cl sobre artículo ud → 400.
- Borrar medida en uso → 409.
