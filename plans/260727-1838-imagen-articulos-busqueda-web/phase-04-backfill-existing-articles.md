# Fase 4 — Backfill de artículos existentes

## Contexto
Con las Fases 1-3 en producción/local, cualquier artículo se puede editar para buscarle imagen desde el propio modal. Esta fase es el proceso de repasar los artículos ya existentes sin imagen, no una funcionalidad nueva.

## Precondición
- Confirmar cuántos artículos activos no tienen `imageUrl` (pregunta abierta en `plan.md` — no se pudo consultar la BD de dev en esta sesión). Query de referencia:
  ```sql
  SELECT count(*) total, count("imageUrl") con_imagen
  FROM "Product" WHERE "deletedAt" IS NULL;
  ```
- Si el volumen es pequeño (decenas), repasar artículo a artículo con el modal es viable. Si es grande (cientos), reconsiderar y evaluar una pantalla de repaso masivo dedicada (fuera de este plan, se abriría como fase adicional bajo demanda).

## Proceso propuesto (sin nueva herramienta)
1. En el listado de artículos, ordenar/repasar visualmente por la nueva miniatura (Fase 3) — los que muestran el placeholder `Tag` son los que faltan.
2. Abrir cada uno, usar "Buscar imagen en internet" (Fase 2), elegir la mejor opción o dejarlo sin imagen si ninguna es correcta (queda con el placeholder, que es un resultado válido, no un error).
3. Guardar.

## Nota sobre el campo reutilizado
Si algún artículo ya tenía `imageUrl` cargado desde la función antigua ("ficha técnica o etiqueta", pestaña Alérgenos), esa imagen pasará a mostrarse como miniatura del listado tras la Fase 3, sin que nadie la haya tocado en esta fase. Repasar esos casos primero (probablemente pocos) para decidir si la etiqueta sirve como miniatura o conviene sustituirla por una foto de producto real.

## Alcance explícitamente fuera
- No se automatiza la elección "mejor imagen" — siempre la elige una persona.
- No se construye un endpoint de backfill masivo ni un script que llame a Google en bucle sin supervisión (evita gastar cuota de la API sin control y evita elegir imágenes incorrectas sin revisión humana).

## Validación
- Tras repasar un lote, verificar en el listado que ya no aparece el placeholder en los artículos tratados y que persiste tras recargar la página (staleTime de `useProducts`, ver `[[useproducts-default-pagesize-50]]` si el listado no refresca tras guardar).
