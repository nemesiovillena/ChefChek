# Caducidades: cómo cerrar etiquetas ya gastadas

Fecha: 2026-09-27 17:26 · Alcance: `/dashboard/appcc/caducidades` + tarjeta dashboard + evidencia SICTED

## Diagnóstico (código)

- `FoodLabel` no tiene fin de ciclo de vida salvo `voidedAt` (Anular). Nada marca «consumida/gastada».
- Alerta = `useByDate` (o `frozenUseByDate`) ≤ hoy + `expiryWarningDays`, **sin límite inferior** → una etiqueta caducada hace 3 meses sigue alertando para siempre.
- Mismo filtro en 3 sitios: listado (`food-label.service.ts:340`), dashboard (`dashboard.service.ts:297`), SICTED PROV.6/PROV.8 (`sicted-procurement-evidence.service.ts:80`). Las falsas alertas ensucian también la evidencia SICTED.
- Único escape hoy: **Anular** (detalle etiqueta). Oculta la alerta, pero:
  - semántica = «etiqueta errónea», no «producto consumido» → auditoría APPCC engañosa;
  - bloquea reimpresión (PDF/ZPL) y la ficha QR pública muestra «anulada»;
  - una a una, sin acción masiva.

## Opciones

| | Qué | Coste | Pros | Contras |
|---|---|---|---|---|
| A | Usar «Anular» con motivo «gastado» | 0 código | Inmediato | Mentira en el registro APPCC; 1 a 1; QR dice anulada |
| **B** | Nuevo estado **Retirada**: `consumedAt` + `disposition` (`CONSUMIDA` \| `DESECHADA`) + quién. Botón por fila + selección múltiple «Marcar como gastadas» + botón en detalle | Migración aditiva + 3 where + UI (~medio día) | Registro APPCC correcto (consumido vs tirado por caducado = control de desechos); trazabilidad intacta; limpia dashboard y SICTED | Requiere disciplina: alguien debe marcar |
| C | Auto-ocultar caducadas tras N días (ventana) | Pequeño | Sin intervención | Esconde producto caducado que puede seguir en la cámara → riesgo sanitario real; sin evidencia |
| D | Cierre automático por consumo en producción/stock | Grande | Automático | No hay stock por etiqueta; YAGNI |

## Recomendación

**B**, sin C. Detalles:
- Listado: por defecto muestra solo «activas» (no anuladas, no retiradas); filtro Estado: Activas / Retiradas / Todas. Chip «Consumida» / «Desechada» gris.
- Acción rápida en fila de alerta: dos botones «Gastada» / «Tirada». Checkbox + barra «Marcar N como gastadas» para limpieza masiva.
- Retirar es reversible («Deshacer» mismo día) → sin riesgo de pérdida.
- Añadir `consumedAt: null` a los 3 where (listado, dashboard, SICTED). No toca `lot-number.service` (numeración sigue contando todas).
- Detalle/QR: mostrar «Retirada el dd/mm (consumida)» — no bloquea reimpresión? → bloquear, igual que anulada (no tiene sentido etiquetar algo gastado).
- Producción: tras deploy, el usuario limpia las actuales con la selección masiva (nada de SQL a mano).

Variante mínima si se quiere aún más simple: un solo estado «Gastada» (sin distinguir desechada). Se pierde el registro de desechos, que en APPCC sí se valora.

## Preguntas abiertas
1. ¿Distinguir Consumida vs Desechada (recomendado) o solo «Gastada»?
2. ¿Qué roles pueden retirar? (propuesta: los mismos que crean etiquetas)
3. ¿Bloquear reimpresión de etiquetas retiradas? (propuesta: sí)
