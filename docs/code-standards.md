# ChefChek — Estándares de Código y Convenciones

## ⛔ Regla crítica: Cero pérdida de datos

**Ningún cambio, refactor o migración puede provocar la pérdida de datos.** Esta regla prevalece sobre cualquier otra consideración (estética, limpieza, rendimiento) y es **no negociable**.

Aplica a TODO tipo de trabajo:

- **Migraciones de UI** (p. ej. sustituir `confirm()`/`alert()` nativos por diálogos/toasts):
  - Una acción destructiva (borrar, sobrescribir, archivar, vaciar) **solo** puede ejecutarse **después** de una confirmación explícita del usuario. Nunca dispararla automáticamente ni omitir la confirmación.
  - Conservar íntegra la lógica de negocio: mismos datos enviados, mismo endpoint, mismo orden. Si el flujo original pedía confirmación, el nuevo también debe pedirla.
  - Antes de cerrar el cambio, verificar que la acción sigue ejecutándose al confirmar y que **no** se ejecuta al cancelar.
- **Migraciones de base de datos / Prisma**:
  - Toda migración debe ser **reversible** y probarse primero en seco (`dry-run`). Prohibido `TRUNCATE`, `DROP` o `DELETE` masivo sin backup explícito y aprobación.
  - Para cambios de esquema con datos existentes, aportar `up` y `down` y un plan de rescate.
- **Semántica de borrado**: preferir **soft-delete** (`isActive=false`, `deletedAt`) al borrado físico salvo que el producto lo exija y se justifique.

**Verificación obligatoria antes de dar por terminado un cambio destructivo:** demostrar (test, curl o evidencia en UI) que (1) la acción no se dispara sin confirmación y (2) los datos confirmados se procesan correctamente. Si hay duda, conservar el comportamiento anterior y preguntar.

## 1. Idioma

Toda la comunicación, comentarios, nombres de variables descriptivas y documentación se redactan en **español** cuando el contexto del negocio lo requiere. Los identificadores de código (variables, funciones, componentes) siguen la convención del lenguaje (kebab-case para archivos JS/TS, PascalCase para componentes React, snake_case para Python/SQL).

## 2. Límite de líneas por archivo

**Máximo 1000 líneas por archivo.** Si un archivo supera este límite, se fragmenta obligatoriamente en:

- Componentes más pequeños (subcomponentes por sección)
- Hooks/composables extraídos para lógica reutilizable
- Módulos de utilidad separados por responsabilidad

**Excepción:** solo se permite superar el límite si es absolutamente imprescindible y se justifica con comentario en el archivo.

### Criterios de fragmentación

| Tipo de archivo | Estrategia de fragmentación |
|---|---|
| Página admin | Componente principal + subcomponentes de sección + hooks de lógica |
| Formulario complejo | Campo/formulario principal + componentes de campo extraídos |
| API endpoints | Agrupados por dominio, no en un archivo monolítico |
| Utilidades | Un módulo por responsabilidad concreta |

## 3. Control del roadmap

Al completar una fase del roadmap y confirmar que funciona correctamente, se marca como **realizada** en `docs/project-roadmap.md`. Estados posibles por fase:

- `pendiente` — aún no iniciada
- `en progreso` — desarrollo activo
- `completada` — verificada y funcional

No se marca como completada hasta que el usuario confirme que todo funciona.

## 4. Ancho de contenido consistente

El ancho del contenido principal es **idéntico en toda la aplicación**. No puede haber secciones con anchos distintos.

- Se define un **token CSS centralizado** (`--content-max-width` o equivalente en el sistema de diseño) para el ancho máximo del contenedor principal
- Todas las páginas (admin, pública, carta QR) usan el mismo token
- Si una sección necesita más ancho, se rediseña para encajar en el estándar
- Sin excepciones sin aprobación explícita

## 5. Reutilización de clases, variables y componentes

Prioridad absoluta a la reutilización siguiendo DRY:

- **Tokens de diseño centralizados:** colores primarios, espaciado, tipografía, ancho de contenido, radios, sombras
- **Componentes base reutilizables:** botones, inputs, tablas, selectores, modales, tabs
- **Sin valores hardcodeados:** todo referencia a tokens del Design System
- **Tailwind CSS:** tema centralizado con `extend` en config, sin clases ad-hoc con valores arbitrarios (`w-[342px]`, `text-[#abc]`) salvo casos justificados

### Ejemplo de reutilización

```
// Mal
<div className="max-w-5xl mx-auto px-6">

// Bien
<div className="content-container">  // clase que usa --content-max-width
```

## 6. Pestañas con URL amigable en admin

Las pestañas del panel de administración deben tener **URL propia y navegable**, no solo estado JS.

### Patrón obligatorio

- Las pestañas se implementan como **rutas anidadas**, no como `useState` + renderizado condicional
- Cada pestaña tiene su propia URL accesible directamente
- Back/forward del navegador funciona correctamente
- Compartir una URL lleva directamente a la pestaña correcta

### Ejemplo de estructura

```
/admin/recetas/:id/general     → Pestaña "General"
/admin/recetas/:id/escandallo  → Pestaña "Escandallo"
/admin/recetas/:id/alergenos   → Pestaña "Alérgenos"
```

### Antipatrón prohibido

```tsx
// MAL — pestaña sin URL
const [activeTab, setActiveTab] = useState('general')
```

```tsx
// BIEN — pestaña como ruta anidada
<Routes>
  <Route index element={<Navigate to="general" />} />
  <Route path="general" element={<GeneralTab />} />
  <Route path="escandallo" element={<EscandalloTab />} />
</Routes>
```
