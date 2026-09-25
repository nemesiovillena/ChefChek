---
phase: 3
title: "Registros diarios y editor de Plan UI"
status: completed
priority: P1
effort: "L"
dependencies: [2]
---

# Phase 3: Registros diarios y editor de Plan UI

## Overview

Pantalla táctil "Hoy" para marcar apertura/cierre/limpieza en segundos, validación del encargado, editor del Plan y vista mensual tipo cuadrante (filas = tareas, columnas = días) para revisar huecos.

## Requirements

- Funcional: marcar ✓ / "no realizado + motivo" por ítem; elegir **quién lo hizo**; observaciones; validar hoja; ver histórico y correcciones; editar plantillas.
- No funcional: uso con guantes/tablet (objetivos táctiles ≥48px), móvil 400px, modo oscuro, sin scroll horizontal salvo la matriz mensual (contenedor propio con `overflow-x:auto`).

## Architecture

Rutas (App Router, `frontend/src/app/dashboard/sicted/`):

| Ruta | Contenido |
|---|---|
| `page.tsx` | Hub: tarjetas por área con progreso de hoy (X/Y), hojas pendientes de validar, hojas vencidas |
| `hoy/page.tsx` | Lista de hojas de hoy por área → detalle con ítems, marcar, quién, observaciones |
| `plan/page.tsx` | Listado/edición de plantillas (ADMIN/OWNER); botón "Cargar plantillas de ejemplo" |
| `registros/page.tsx` | Matriz mensual por plantilla/área con color (hecho / no hecho / vacío / validado) |
| `registros/[runId]/page.tsx` | Detalle solo lectura con histórico de marcas y correcciones |

Estado: hooks React Query en `frontend/src/hooks/use-sicted.ts` (`useSictedToday`, `useSictedRuns`, `useSictedRun`, mutaciones). Tras cada mutación **invalidar lista + detalle** (patrón albaranes). El `apiClient` ya desenrolla `{success,data}`: el resultado de una mutación es la entidad (`result.id`). Sin `useEffect` directo (regla `no-use-effect`): datos por React Query, estado derivado en render.

UX clave (checklist se adapta al `mode` de la plantilla — ver tabla de fase 2):
- **Selector "¿Quién?"** persistente por sesión de hoja (se recuerda para las siguientes marcas de esa hoja) — mitiga la cuenta compartida. Sin PIN (decisión confirmada): solo elegir nombre de una lista.
- Marcas en **lote**: el usuario marca varios ítems y pulsa "Guardar"; un solo POST. Tras guardar, el ítem queda bloqueado; corregir abre diálogo con motivo obligatorio.
- **`mode=EXECUTION`** (limpieza cocina/almacén/aseos — la mayoría): toggle hecho/no-hecho por ítem; "no realizado" abre el campo motivo (obligatorio) — es lo que el auditor quiere ver. Sin paso de validación (el documento real no lo lleva).
- **`mode=INSPECTION`** (revisión semanal de estado): 3 estados por ítem (Bien/Mal/—), observación obligatoria si Mal; al final de la hoja, **Validar** (botón solo ADMIN/OWNER, `useConfirm()`, "Al validar no podrá modificarse") = la firma "Aprobado por" del documento real; quien completó los ítems = "Elaborado por".
- **`mode=MEASUREMENT`** (temperatura de cámaras): input numérico por ítem con la unidad y el rango esperado visibles; fuera de rango resalta en color y pide "acción correctiva" antes de guardar. Sin paso de validación por defecto (confirmado, Validation Session 1): el documento real solo lleva una firma por fila, no doble firma.
- Vista mensual: `<div role="table">` o tabla real en contenedor con scroll; **no** usar `<nav>`/`<header>` no-fixed para tabs/títulos (`globals.css` los oculta) → `<div role="tablist">`, `useState` para pestañas de modal.

## Related Code Files

- Create: `frontend/src/app/dashboard/sicted/**` (páginas y componentes; dividir en componentes <200 líneas: `sicted-run-checklist.tsx`, `sicted-performer-picker.tsx`, `sicted-month-matrix.tsx`, `sicted-template-editor.tsx`).
- Create: `frontend/src/hooks/use-sicted.ts`, `frontend/src/lib/sicted-types.ts`.
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (enlace + accesos móviles si procede: barra inferior fija tapa overlays → `pb-28`).

## Implementation Steps

1. Tipos + hooks + cliente de API (contra los endpoints de fase 2 ya mergeados).
2. Hub y "Hoy" (mínimo utilizable): lista de hojas → checklist → guardar lote → validar.
3. Selector de persona (sin PIN).
4. Corrección con motivo y visualización de histórico.
5. Editor de Plan: crear/editar plantilla, ítems con producto/dosis/EPI/procedimiento (textarea ≥16px), archivar con `useConfirm`.
6. Matriz mensual y detalle de hoja.
7. Pulido: dark mode (`color-scheme` en date inputs; ojo con el shim que fuerza `text-gray-800`), tokens M3 (`text-primary-foreground`, no `--on-primary`), iconos Material Symbols con guard FOUC.
8. Verificación E2E en navegador (agent-browser/Chrome): comprobar antes el cwd del proceso en :3000 (sirve worktree o checkout según sesión) y que `next start` no sirve un build viejo. Recordar que los clicks por `@ref` pueden quedar obsoletos tras HMR.

## Tests

- Componentes: checklist (marcar, no-realizado exige motivo, bloqueo tras guardar), matriz (colores), permisos (USER no ve "Validar"/"Plan"; VIEWER sin controles).
- E2E manual con datos de prueba en un tenant de prueba **no** el de Warynessy (regla cero pérdida de datos).

## Success Criteria

- [x] Una hoja de 15 ítems se completa y valida en <1 min en tablet — probado en navegador real con una hoja de 10 ítems (INSPECTION): marcar los 10 + Guardar + Validar en un solo flujo fluido.
- [x] 400px sin scroll horizontal (salvo matriz); dark mode correcto — sin anchos fijos >32px fuera del contenedor `overflow-x-auto` de la matriz (grep verificado); modo claro/oscuro probados visualmente en el Hub, ambos con tokens M3 correctos.
- [x] Ninguna acción destructiva sin `useConfirm`; sin `confirm()/alert()` nativos — "Validar" y "Archivar" usan `useConfirm()`; probado en navegador (diálogo M3 real, texto exacto del plan).
- [x] Tras marcar/validar, lista y detalle se refrescan sin recargar — React Query invalida hoy+listado+detalle tras cada mutación (patrón albaranes); confirmado en navegador (progreso "2/9"→"10/10", badge "Validada" aparecen sin recargar).

## Risk Assessment

- *Doble toque/reintento de red* → POST duplicado: marcar es idempotente por `(runId,itemId)` "vigente"; UI deshabilita botón en vuelo.
- *Tablet sin wifi*: confirmado que siempre hay wifi en cocina, sin cola offline. Igualmente, ante un fallo de red puntual: mostrar error claro y **no** perder el lote en pantalla hasta confirmar guardado.
- *Cuadrante grande en móvil*: contenedor con scroll propio + vista lista alternativa.
