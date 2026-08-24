# Fase 2 — Frontend: selector de imagen reutilizable

## Contexto
- El modal de artículo (`articulo-modal.tsx`) hoy pasa `imageUrl`/`onImageUpload` a `tab-alergenos.tsx` (líneas 166, 233, 405-406), que renderiza el control de subida junto a los alérgenos — sitio poco intuitivo para lo que ahora es "foto identificativa del artículo".
- Ya existe `frontend/src/lib/upload-api.ts` (`uploadUrl()`) para construir URLs directas al backend saltándose el proxy de Next en subidas multipart.
- `frontend/src/hooks/use-products.ts` ya tiene el tipo `Product` con `imageUrl?: string` (líneas 87, 141) — no requiere cambios de tipo.

## Requisitos
- Un componente que, dado un nombre de artículo (y marca opcional), permita:
  1. Buscar candidatos en internet (Fase 1) con una consulta editable.
  2. Mostrar hasta 8 miniaturas en rejilla.
  3. Elegir una → guarda la `url` completa (no el thumbnail) en el estado del formulario.
  4. Quitar la imagen actual → vuelve a `undefined`/`''`.
  5. Mantener la opción de subir un archivo manual ya existente (para casos sin buen resultado en la web).
- Reposicionar el control fuera de la pestaña Alérgenos.

## Archivos a crear
- `frontend/src/app/dashboard/articulos/components/product-image-picker.tsx` — componente combinado (vista actual + botón buscar + rejilla de resultados + botón subir archivo + botón quitar).
- `frontend/src/hooks/use-product-image-search.ts` — hook `useProductImageSearch()` que llama `GET /products/image-search?q=...` vía `apiClient` (recordar: el interceptor global desenvuelve `{success,data}` — devolver directamente el array, ver `[[apiclient-interceptor-unwrap-mutation-result-is-entity]]`).

## Archivos a modificar
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx`:
  - Quitar `imageUrl`/`onImageUpload` de las props de `TabAlergenos` (líneas 399-407).
  - Montar `<ProductImagePicker />` en un sitio visible independiente de la pestaña activa — candidato natural: junto al campo "Nombre" en la cabecera del formulario (siempre visible), o como primera pieza de la pestaña "Formato y Precio" (primera pestaña de la lista, `TABS[0]`). Decidir en implementación mirando el layout real alrededor de la línea 360-380; preferir la cabecera si no rompe el grid.
- `frontend/src/app/dashboard/articulos/components/tab-alergenos.tsx`:
  - Quitar `imageUrl`, `onImageUpload`, el `fileInputRef` y el bloque de subida de imagen (mantener solo alérgenos + checkbox "Ocultar en etiquetado").
- `frontend/src/hooks/use-products.ts`: sin cambios de tipo; revisar si `handleImageUpload` en `articulo-modal.tsx` (la función que llama a `upload-image`) se puede reusar tal cual dentro del nuevo componente o si conviene moverla junto a él.

## Diseño del componente `ProductImagePicker`

Props:
```ts
interface ProductImagePickerProps {
  value: string;                 // imageUrl actual (puede ser '')
  onChange: (url: string) => void;
  defaultQuery: string;           // ej: `${formData.name} ${formData.brand ?? ''}`.trim()
}
```

Estados internos: `searching`, `query` (editable, prellenado con `defaultQuery`), `results` (array de candidatos), `panelOpen`.

Flujo:
1. Vista compacta: miniatura actual (o placeholder `Tag`, mismo patrón que `ArticleContextCard`) + botón "Buscar imagen" + botón "Subir archivo" + botón "Quitar" (solo si hay `value`).
2. Al pulsar "Buscar imagen": abre panel con input de texto (editable) prellenado con `defaultQuery` + botón "Buscar" → llama `useProductImageSearch(query)`.
3. Resultados: rejilla de miniaturas (`<img>` plano, no `next/image` — dominios arbitrarios, ver Fase 3). Cada miniatura clicable; al click, `onChange(result.url)` y cierra el panel.
4. Estado vacío (`results.length === 0` tras buscar): mensaje "Sin resultados, prueba otra búsqueda o sube un archivo".
5. Estado de error (Google no configurado / cuota agotada): toast/mensaje inline con el `message` que devuelva el backend — no bloquear el guardado del artículo, la imagen es opcional.
6. Cada `<img>` de resultado y de la vista compacta lleva `onError` para ocultarse/mostrar el placeholder si el hotlink falla en el momento de renderizar (no todo enlace de Google Images permite hotlinking).

## Tests / validación
- Sin test automatizado de UI en este proyecto para esta zona (no hay precedente de RTL en `articulos/`); validar manualmente en local:
  - Abrir modal de un artículo existente, buscar, elegir imagen, guardar, reabrir y comprobar que persiste.
  - Quitar imagen, guardar, comprobar que vuelve al placeholder en listado/tarjetas.
  - Simular fallo de Google (env var vacía) y comprobar que el modal no se rompe y el guardado del resto de campos sigue funcionando.

## Riesgos / rollback
- Mover el control fuera de Alérgenos es un cambio de UI visible; si el usuario prefiere mantenerlo donde está, es un cambio de una línea de posición, no de lógica.
- Sin cambios de API pública del formulario (`imageUrl` sigue siendo un string opcional en el payload de guardado).
