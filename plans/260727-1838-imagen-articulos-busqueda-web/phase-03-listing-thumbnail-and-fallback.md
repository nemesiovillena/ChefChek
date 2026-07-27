# Fase 3 — Listado: miniatura + fallback + fix de hotlink

## Contexto
- El listado denso de artículos (`frontend/src/app/dashboard/articulos/page.tsx:648-757`) no muestra ninguna imagen hoy; solo `ArticleContextCard` (línea 845-865, diálogo de borrado) y `articulo-cards.tsx` (vista tarjetas) lo hacen.
- `articulo-cards.tsx:91-98` usa `next/image` (`Image` de `next/image`) para `product.imageUrl`, sin fallback si no hay imagen.
- `next.config.ts` solo permite `lh3.googleusercontent.com` en `images.remotePatterns` → cualquier imagen de un dominio nuevo (las que salgan de la búsqueda de Google) rompe `next/image` en runtime (error "hostname not configured"). `ArticleContextCard` ya evita esto usando `<img>` plano (page.tsx:854).

## Requisitos
- Añadir una miniatura pequeña (~32-36px, redondeada) como primera columna del listado denso, junto al nombre.
- Placeholder "No imagen" consistente en todos los sitios (tabla, tarjetas, diálogo de borrado): icono `Tag` de `lucide-react` sobre `bg-[var(--surface-container-highest)]` (mismo patrón que `ArticleContextCard`).
- Arreglar `articulo-cards.tsx` para que no dependa de `next/image` con una whitelist de dominios (usar `<img>` plano, igual que ya hace `ArticleContextCard`) — si no, las imágenes elegidas por búsqueda web no se verán ahí.
- Cualquier imagen rota en tiempo real (link muerto) debe caer al placeholder, no mostrar el icono de imagen rota del navegador (`onError`).

## Archivos a modificar
- `frontend/src/app/dashboard/articulos/page.tsx`:
  - `<thead>` (línea ~650): añadir `<th>` vacío/corto antes de "Nombre" para la miniatura (sin sort, ancho fijo `w-12` o similar).
  - `<tbody>` (línea ~669-679): nueva `<td>` con miniatura (extraer un pequeño helper o reusar directamente el bloque de `ArticleContextCard` factorizado en un componente compartido, p.ej. `ProductThumbnail`, para no duplicar el markup en 3 sitios).
  - Actualizar `colSpan={10}` (líneas 665, 667) a `colSpan={11}` (una columna más).
- `frontend/src/app/dashboard/articulos/components/articulo-cards.tsx`:
  - Sustituir `<Image src={product.imageUrl} .../>` por `<img>` plano + `onError` que oculta la imagen.
  - Añadir bloque `else` (placeholder `Tag`) cuando no hay `imageUrl`, en vez de no renderizar nada.
- Extraer un componente pequeño y compartido para el placeholder/miniatura (evita repetir el mismo JSX en `page.tsx` x2 sitios + `articulo-cards.tsx`):
  - Nuevo archivo `frontend/src/app/dashboard/articulos/components/product-thumbnail.tsx`, props `{ imageUrl?: string; size?: number }`, usado por `ArticleContextCard`, la nueva columna de la tabla, y `articulo-cards.tsx`.

## Diseño

```tsx
// product-thumbnail.tsx
export default function ProductThumbnail({ imageUrl, size = 32 }: { imageUrl?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const showImage = imageUrl && !broken;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg bg-[var(--surface-container-highest)] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <Tag className="h-1/2 w-1/2 text-[var(--on-surface-variant)]" />
      )}
    </div>
  );
}
```
- `ArticleContextCard` (page.tsx:845) pasa a usar `<ProductThumbnail imageUrl={product.imageUrl} size={44} />` en vez de su bloque manual actual.
- Nueva celda de tabla: `<ProductThumbnail imageUrl={product.imageUrl} size={32} />`.
- `articulo-cards.tsx`: `<ProductThumbnail imageUrl={product.imageUrl} size={48} />` en vez del bloque `<Image>` actual.

## Tests / validación
- Sin suite de tests de componentes en esta zona; validar manualmente:
  - Artículo con imagen de Google (dominio externo arbitrario) se ve en listado, tarjetas y diálogo de borrado.
  - Artículo sin imagen muestra el icono `Tag` en los tres sitios.
  - Forzar una URL de imagen rota (404) y comprobar que cae al placeholder sin icono roto del navegador.
  - Revisar que la tabla no rompe el layout en pantallas estrechas (columna nueva es angosta, 32px + padding).

## Riesgos / rollback
- Cambio puramente de presentación, sin tocar el backend ni el guardado — revertible con un solo commit.
- Verificar que ningún test existente cuenta columnas de la tabla por índice (buscar snapshots/tests de `page.tsx` antes de tocar `colSpan`).
