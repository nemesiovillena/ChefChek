# Research: «Cómo usar SICTED» → solo «Día a día (personal)»

Fecha: 2026-10-01 18:52 · Rama: develop

## Resumen
Cambio puramente de contenido en 1 archivo frontend. Sin backend, sin BD, sin web research (tema interno; 0 búsquedas externas necesarias).

## Dónde vive
- Página: `frontend/src/app/dashboard/sicted/ayuda/page.tsx` — array estático `SECTIONS` con 6 secciones (l.22-164) + chips de navegación (l.188-198) + render de cards (l.200-215).
- Sección pedida: `id: 'dia-a-dia'`, l.71-95 (4 pasos, texto idéntico a la captura).
- Entradas a la página (no cambian): enlace en portada `frontend/src/app/dashboard/sicted/page.tsx:60-66`, menú `frontend/src/features/modules/lib/nav-config.ts:90`.

## Cambio propuesto (opción A, literal a la petición)
1. `SECTIONS` → dejar solo la sección `dia-a-dia`; borrar 1, 2, 4, 5, 6.
2. Título: quitar el «3.» → `'Día a día'` (o `'Día a día (personal)'`). Con una sola sección la numeración confunde.
3. Quitar fila de chips de anclas (l.188-198): con 1 sección no aporta.
4. Limpiar imports/constantes muertas: `Link` y `linkCls` solo se usan en secciones 1, 2 y 6 → quedan sin uso (lint fallaría). Si queda una sola sección, se puede simplificar a un único `<ol>` sin array/interfaz (KISS), pero mantener el array es aceptable y menos diff.
5. Actualizar el JSDoc de l.18-21.

Riesgo: nulo funcional. Contenido borrado recuperable desde git (`git show 8435720:frontend/src/app/dashboard/sicted/ayuda/page.tsx`).

## Alternativa (opción B)
Personal ve solo «Día a día»; encargado/propietario (`canManage`, ya usado en la portada) ve además 2, 4, 5, 6. ~10 líneas extra. Útil si la guía de dirección sigue siendo valiosa para el administrador; contradice el «solamente» literal.

## Verificación
- `cd frontend && bun run lint` (imports sin uso) + `bun run build` o tsc.
- Visual: `/dashboard/sicted/ayuda` en móvil y escritorio.

## Siguiente paso
Implementar opción A (≈ -100 líneas, 1 archivo) → PR a develop.

## Preguntas abiertas
- ¿Se borra la guía de administración (puesta en marcha, dirección, evaluación, ciclo) o se mantiene solo visible para encargado/propietario (opción B)?
- ¿Título con «(personal)» o solo «Día a día»?
