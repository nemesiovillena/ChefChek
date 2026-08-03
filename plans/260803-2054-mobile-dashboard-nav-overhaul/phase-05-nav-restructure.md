# Fase 5 — Nueva taxonomía de menú

## Estructura final acordada

```
Dashboard                              (link top-level)
Cocina                                 (grupo)
  - Producción      /dashboard/production        moduleId: production
  - Recetas         /dashboard/recipes            moduleId: recipes
  - Compras         /dashboard/compras            moduleId: compras
  - Artículos       /dashboard/articulos          moduleId: articulos
  - Equipo          /dashboard/users               moduleId: sala
Almacén                                (grupo)
  - Albaranes       /dashboard/albaranes          moduleId: albaranes
  - Proveedores     /dashboard/proveedores        moduleId: proveedores
  - Stock           /dashboard/warehouse          moduleId: almacenes   (antes "Almacén")
  - Histórico de precios /dashboard/historico-precios  (sin moduleId, transversal — fase 4)
S. Alimentaria                         (grupo)
  - APPCC           /dashboard/appcc               moduleId: appcc
  - Alérgenos       /dashboard/allergens           moduleId: allergens
Contenido                              (grupo)
  - Menús           /dashboard/menus               moduleId: menus
  - Fichas técnicas /dashboard/technical-sheets    moduleId: technical-sheets
  - Menú digital    /dashboard/digital-menu        moduleId: digital-menu
  - Wiki            /dashboard/wiki-procedimientos moduleId: conocimiento
Herramientas                           (grupo, sin moduleId)
  - Sprint          /dashboard/sprint-tracker
  - Papelera        /dashboard/papelera
  - Copias de Seguridad /dashboard/backups
Configuración                          (link top-level, sin moduleId)
```

## Archivos
- `frontend/src/features/modules/lib/nav-config.ts` — reescribir con esta
  estructura. Mantener `ROUTE_MODULE_MAP` (no cambia, solo referencia
  moduleIds existentes; añadir excepción si se añade `historico-precios`
  bajo un moduleId — ver nota abajo).
- `frontend/src/app/dashboard/layout.tsx` — la barra superior deja de ser
  "5 links planos + 1 dropdown MÁS"; pasa a ser "Dashboard (link) + 5
  dropdowns de categoría + Configuración (link)". Reutilizar el patrón de
  dropdown ya existente (`showMore` + click-outside) generalizado a N
  dropdowns (un solo `openDropdown: string | null` en vez de un booleano).
- Drawer móvil ("Más"): recorre las mismas `NAV_GROUPS` en el mismo orden;
  no hace falta cambiar su lógica de render, solo la fuente de datos.
- `MOBILE_NAV` (bottom bar, 5 iconos fijos): mantener una selección curada
  de accesos rápidos — Dashboard, Recetas, Subir (albarán), APPCC, Stock —
  ya cubre un item de cada grupo principal salvo Cocina/Compras; se puede
  dejar igual (no pedido explícitamente por el usuario, cambiar solo si
  rompe con la nueva agrupación).

## Nota sobre moduleId de "Histórico de precios"
No tiene modelo de módulo propio; se deja transversal (sin `moduleId`,
siempre visible) igual que Configuración/Papelera, ya que vive bajo
`/dashboard/historico-precios` sin gating existente. Si en el futuro se
gatea, añadir entrada a `ROUTE_MODULE_MAP`.

## Pasos de implementación
1. Reescribir `nav-config.ts`: nuevo tipo `NavSection` ya existe y sirve tal
   cual (title + items); solo cambia el contenido/orden. Eliminar
   `PRIMARY_NAV` como "flat list"; sustituir por `NAV_GROUPS: NavSection[]`
   (Cocina/Almacén/S. Alimentaria/Contenido/Herramientas) + constantes
   sueltas para Dashboard/Configuración (no son grupos).
2. `layout.tsx`: reemplazar el único `showMore` boolean por
   `openGroup: string | null`, renderizar un botón+dropdown por cada
   `NAV_GROUPS` section (filtrando items por `isEnabled`, ocultando grupos
   vacíos igual que hoy `visibleSections`).
3. Drawer móvil: iterar `NAV_GROUPS` (mismo componente, ya agrupa por
   `section.title`).
4. Revisar breakpoint: con 5 dropdowns + Dashboard + Configuración en la
   barra superior puede no caber en `md` (768px); si se ve apretado, subir
   el breakpoint de la barra completa a `lg` en vez de `md` (ajuste visual,
   validar con el navegador).

## Validación
- Cada ruta existente sigue accesible desde algún punto del menú (ningún
  route huérfano).
- Con un módulo desactivado, su grupo se oculta si queda vacío (mismo
  comportamiento que `visibleSections` hoy).
- Responsive: probar en 375px (móvil) y 1280px (desktop) sin overflow
  horizontal.
