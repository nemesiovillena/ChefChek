# Estudio: integrar SICTED en el dashboard

Fecha: 2026-09-30 21:30 · Alcance: `frontend/src/app/dashboard/page.tsx` + hooks SICTED existentes. Sin código.

## Situación actual

- Dashboard (`/dashboard`, "Cocina Principal"), 680 líneas, dos layouts:
  - **Escritorio**: bento 12 col → izquierda (4): Pedidos pendientes, Notificaciones de Sala, Notificaciones y Alertas · derecha (8): Tareas de Prep. · franja inferior 3 col: Caducidades, Etiquetado (o placeholder «Telemetría»), Recetas.
  - **Móvil**: una columna: Prep → Sala → Pedidos → Alertas → Caducidades → Recetas → Etiquetado → Compras.
- Cada card se muestra según `isEnabled(módulo)` + `canSee(sección)`.
- SICTED **no aparece** en el dashboard; solo en el menú (Calidad → SICTED) y en su portada `/dashboard/sicted` (progreso por zona, pendientes de validar, vencidas 7 días).
- Datos ya disponibles en el frontend, sin backend nuevo:
  - `useSictedRunsToday()`: hojas de hoy (status, entriesCount, requiresSupervisor, supervisedAt). Genera las hojas del día de forma lazy (efecto deseable: al abrir el dashboard ya existen).
  - `useSictedRuns({ status: 'INCOMPLETE', from })`: vencidas.

## Qué necesita ver cada uno

| Quién | Pregunta al abrir el dashboard | Dato |
|---|---|---|
| Cocina / cuenta compartida (USER) | ¿Qué hojas me quedan hoy? | pendientes de hoy (N de M) |
| Encargado (ADMIN/OWNER) | ¿Hay algo que validar o que se quedó sin hacer? | por validar + vencidas |

## Opciones

### A. Card KPI «SICTED hoy» (recomendada)
Card compacta como Caducidades:
- Número grande: **hojas pendientes hoy** (`3`), subtítulo «de 7 · Te quedan 3».
- Estado: «Todo hecho ✓» cuando 0 pendientes.
- Solo ADMIN/OWNER: línea «2 por validar» y, si hay, «1 vencida» en rojo.
- Clic → `/dashboard/sicted/hoy` (o a la portada si hay algo por validar/vencido).
- Ubicación: franja inferior pasa de 3 a **4 columnas** (Caducidades · SICTED · Etiquetado · Recetas). Móvil: justo después de Caducidades.
- Coste: ~1 componente nuevo (`dashboard-sicted-card.tsx`) + 3 líneas en `page.tsx`. Solo frontend. Pequeño.
- Riesgo: franja de 4 columnas más estrecha en portátiles de 1024–1280 px → revisar que los textos no se corten.

### B. Lista «Hojas de hoy» dentro del dashboard
Card tipo Notificaciones de Sala con las hojas pendientes (nombre + zona), clic abre la hoja.
- Pro: se hace la hoja sin pasar por SICTED.
- Contra: compite por altura con la columna izquierda, que ya está ajustada (min-h, useRowsThatFit); más código y más riesgo de maquetación. Duplica Hojas de hoy.

### C. Mezclar las hojas en «Tareas de Prep.»
- Descartada: son dominios distintos (producción vs evidencias de calidad), el board tiene drag & drop y posponer que no aplican a las hojas, y las hojas de Sala/Baños no son de cocina.

## Recomendación
**A**. Resuelve lo que confundió hoy (saber qué falta y qué validar) con un vistazo, sin tocar el layout crítico del bento. Si luego se echa en falta abrir hojas desde el dashboard, evolucionar a B dentro de la misma card (desplegar lista).

Detalle adicional detectado: la portada SICTED solo lista «Pendientes de validar» **de hoy**; una hoja de ayer sin validar deja de avisarse. Si la card muestra «por validar», conviene contar también los últimos 7 días (misma consulta `useSictedRuns` con `status: 'COMPLETED'`), y aplicar lo mismo en la portada.

## Preguntas abiertas
1. ¿La card la ve todo el que tiene SICTED (cocina incluida) o solo encargados?
2. ¿Franja inferior de 4 columnas, o prefieres que SICTED sustituya a otra card (p. ej. Recetas, que es solo un acceso)?
3. ¿«Por validar» incluye días anteriores (recomendado) o solo hoy?
