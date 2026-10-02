# Research: quitar modal «Validar hoja» y volver al origen tras validar

Fecha: 2026-10-01 17:38 (Europe/Madrid) · Rama: develop · Solo análisis de código, sin búsquedas web (no hacían falta).

## Resumen

- Modal vive en `frontend/src/app/dashboard/sicted/components/sicted-run-checklist.tsx:151-166` (`handleValidate` → `useConfirm`).
- Además de sobrar, está mal: no pasa `variant`, así que sale con el estilo destructivo por defecto (papelera roja) para una acción que no borra nada.
- Tras validar no hay navegación: el usuario se queda en la hoja ya sellada y tiene que pulsar «Volver».
- Cambio pequeño, solo frontend, 3 archivos. Sin backend, sin migración.

## Flujo actual

```
/dashboard/sicted (hub, «Pendientes de validar»)
   └─ router.push → /dashboard/sicted/registros/[runId]
        └─ <SictedRunChecklist readOnly> → botón Validar → modal → supervise → toast → se queda ahí
```

`SictedRunChecklist` se usa en 2 sitios:

| Sitio | Cómo se «vuelve» |
|---|---|
| `registros/[runId]/page.tsx:24` | `router.back()` |
| `hoy/page.tsx:42` | `setSelectedRunId(null)` (maestro-detalle, sin ruta) |

A `registros/[runId]` se llega desde: hub (pendientes + vencidas), matriz mensual de Registros, Auditoría.

## Propuesta

1. `sicted-run-checklist.tsx`
   - `handleValidate`: quitar `confirm(...)`; llamar `supervise.mutateAsync` directo con try/catch + toast de error (mismo patrón que `handleJustify`, líneas 178-189).
   - Nueva prop opcional `onValidated?: () => void`, llamada tras éxito.
   - Quitar import/uso de `useConfirm` (queda sin usar en el fichero).
   - Botón Validar ya tiene `disabled={supervise.isPending}` → añadir spinner como en Guardar.
2. `registros/[runId]/page.tsx`: `onValidated={() => router.back()}`.
3. `hoy/page.tsx`: `onValidated={() => setSelectedRunId(null)}`.

`router.back()` y no `push('/dashboard/sicted')`: cumple literalmente «volver a de donde venía» y no rompe a quien entra desde Registros o Auditoría.

Lista del hub se refresca sola: `useSuperviseSictedRun` invalida `[RUNS_KEY]` (`use-sicted.ts:192-198`), que es la clave de `pendingValidation` (`use-sicted.ts:150,157`). Verificado en código, no en navegador.

## Riesgo real

Validar es irreversible (hoja sellada; triggers Postgres de inalterabilidad). Sin modal, un toque accidental sella la hoja sin vuelta atrás.

Valoración: riesgo bajo.
- Desde el hub se abre la hoja expresamente para validarla.
- En `registros/[runId]` (readOnly) Validar es el único botón de acción → no hay vecino con el que confundirlo.
- En `hoy` sí convive con «Guardar» (izquierda, relleno) y Validar (derecha, contorno). Aquí es donde cabe el toque erróneo.
- El toast «Hoja validada» + volver a la lista da feedback inmediato.

Alternativa descartada: mantener modal con `variant` no destructiva. Arregla la papelera pero no la queja (paso de más).

## Casos límite

- Entrada por enlace directo a `registros/[runId]` sin historial: `router.back()` no tiene adónde ir. Hoy el botón «Volver» ya tiene el mismo problema; no lo empeora.
- «Justificar» (hoja vencida): no usa modal, tampoco navega al terminar. Fuera de lo pedido.

## Verificación sugerida

- Hub → pendiente → Validar → vuelve al hub, la hoja ya no está en «Pendientes de validar», contador baja.
- Hoy → hoja hecha → Validar → vuelve a la lista con etiqueta «Validada».
- Fallo de red al validar → toast de error, se queda en la hoja, botón reactivado.
- Cuenta compartida sin «quién» elegido → sigue saliendo el aviso, no valida.

## Preguntas abiertas

1. ¿Tras «Justificar» una hoja vencida también debe volver al origen? (mismo componente, misma lógica; 1 línea más).
2. En `hoy`, ¿aceptas el riesgo de toque accidental junto a «Guardar», o prefieres mantener ahí la confirmación?
