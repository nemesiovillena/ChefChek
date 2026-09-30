# Research: Etiquetas 60×40 + 57×32 (perfiles ZPL)

Fecha: 2026-09-21 | Scope: scout repo + verificación hardware/consumibles

## TL;DR

- **~70% ya existe.** Perfiles térmicos por tenant, 60×40 y 57×32 sembrados por defecto, DPI configurable, formato por defecto, generador ZPL parametrizado por `ZplLabelSpec`. No hay que construir "motor de plantillas con 2 configs".
- **Falta de verdad (3 cosas):**
  1. Layout ZPL NO se adapta al perfil (constantes mm fijas; solo `showIngredients` cambia a <36 mm).
  2. Selector de formato **en el momento de imprimir** (hoy solo lectura: "Se elige en Configuración →").
  3. Verificación física de 57×32 (cabe "por los pelos", ver abajo).
- **No hacer:** mapa formato-por-categoría de producto (Crema=60×40, Salsa=57×32…). Ver §Riesgos.
- **No hacer:** QR 30–32 mm. Inviable geométricamente.

## Estado actual (verificado en código)

| Pieza | Dónde | Estado |
|---|---|---|
| Perfiles `{id,name,widthMm,heightMm,dpi}` | `etiquetado-config.service.ts` (`Configuration` key `ETIQUETADO_THERMAL_PROFILES`) | Existe. Rango 20–200 mm, 100–600 dpi |
| Defaults 60×40 y 57×32 @203 | `DEFAULT_THERMAL_PROFILES` | Existe — solo si el tenant NO tiene fila guardada |
| Formato por defecto tenant | `ETIQUETADO_DEFAULT_FORMAT` (`thermal:<id>` / A4) | Existe |
| Generador ZPL | `food-label-zpl.service.ts` → `computeZplLayout(spec, content)` | Existe, geometría pura y testeable |
| Selector en pantalla de imprimir | `etiquetado/nueva/page.tsx`, `[id]/page.tsx` | **No**: usan `effectiveLabelFormat()` y muestran texto |
| Ajustes → Etiquetas | `etiquetado-config-section.tsx` | Existe (CRUD perfiles + default) |
| Tipo de etiqueta en modelo | `FoodLabel.labelType` = ELABORATED \| HANDLED | No hay "categoría" de etiqueta |

Dots: 60×40 → 480×320 ✔. 57×32 → `toDots` da 456×256 ✔ (coincide con lo propuesto).

## Hallazgos que cambian el diseño

### 1. Layout fijo: 57×32 cabe con 0,3 mm de margen
Constantes actuales (mm): producto 2×3,0 + lote 3,6 + elab 2,5 + consumo 2,7 + conserv. 2,5 = 17,3; + alérgenos 2×2,3 = 21,9; + línea HANDLED 2,2 = 24,1. Alto útil 27 (32 − 2×2,5); responsable ocupa 24,4–27. → caso HANDLED + alérgenos: **0,3 mm de holgura**. Cualquier campo más y se solapa. Con `^FB` maxLines no hay overflow de texto, pero sí solape entre campos.
60×40: útil 35 mm, ingredientes 4 líneas (8 mm) caben con ~2,6 mm de holgura.

### 2. QR 30–32 mm en 60×40: no
Área útil 55×35 mm. QR de 31 mm = 56% del ancho y 89% del alto → no queda sitio para texto. Hoy `QR_TARGET_MM = 15` (≈33 módulos, mag 4 → ~16,5 mm, módulo 0,49 mm). Recomendación: **15–17 mm en ambos formatos** (mag 4). Para 57×32 mag 3 (≈12,4 mm, módulo 0,375 mm) solo como fallback si falta espacio.
Fuentes web sobre tamaño mínimo de módulo (0,8–1,0 mm) son blogs genéricos de QR para papel/recibo, no de Zebra 203 dpi; **baja confianza** y contradicen lo que ya se decidió (M, mag 4). Decidir con prueba real de escaneo con móvil en cocina, no con blogs.

### 3. ZD220d: ambos anchos caben
ZD220 = modelo 4": ancho de impresión 104 mm, papel+liner 25,4–112 mm, 203 dpi ([spec Zebra](https://www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd220-tech-specs-en-us.pdf), [Jarltech](https://www.jarltech.com/en/zebra-zd220-0)). Etiqueta más estrecha que el cabezal → **posición horizontal de la etiqueta respecto al origen de impresión (alineación a guía) y calibración de sensor son cosas a medir en la impresora física**; no verificado en fuentes. Palanca: `^LH`/`^LS`, ya centralizado en el generador.

### 4. Consumible 57×32 — confirmar la referencia
- Pedido dice "referencia myZebra, 2.100/rollo". La página myZebra que encuentro es **51×32 mm**, Z-Perform 1000D, `880175-031D`, 2.100/rollo, core 25 mm, compatible ZD220 ([myZebra](https://www.myzebra.co.uk/en/label-z-perform-direct-thermal/5721-zebra-part-880175-031d.html)).
- 57×32, 2.100/rollo, core 25 mm existe como `800262-125` ([Zolemba](https://www.zolemba.com/en/white-labels-on-roll/zebra-800262-125-57x32mm)) — tienda de compatibles, no myZebra.
- **Confirmar que se compra 57×32 y no 51×32** antes de pedir. 51 mm dejaría 46 mm útiles (no 52).

## Riesgo del mapa "formato por tipo de producto"
La impresora tiene **un rollo cargado a la vez**. Si Salsa=57×32 y Carne=60×40, cada cambio de producto exige cambiar rollo físico; si no, ZPL de 57×32 sobre rollo 60×40 (o al revés) → etiqueta cortada / desfasada / avance de etiquetas en blanco. Lo que importa operativamente es **"qué rollo hay puesto"**, no el producto. Solo tendría sentido con **2 impresoras** (una por formato). Pregunta abierta abajo. YAGNI hasta que haya dos impresoras.

## Propuesta mínima (orden)

1. **Tuning derivado de geometría, no de id de perfil.** Como Ajustes permite tamaños arbitrarios (20–200 mm), el layout debe salir de `widthMm/heightMm`, no de `if id==='60x40'`.
   - Agrupar las constantes `*_FONT_MM/*_LINE_MM/QR_TARGET_MM/*_MAX_LINES` en un objeto `ZplLayoutTuning` con 2 presets (`standard` ≥36 mm alto, `compact` <36 mm) elegido en `zplSpec()` (ya decide `showIngredients` por altura). `compact`: fuentes ~10% menores, sin ingredientes.
   - Ingredientes: `maxLines = floor(espacio_restante / línea)` en vez de 4 fijo → "más líneas en 60×40" sale solo.
   - Test: `computeZplLayout` para las 4 combinaciones {60×40, 57×32} × {ELABORATED, HANDLED+alérgenos} afirmando que ningún campo pasa de `responsable.y` (hoy el 57×32 HANDLED pasaría rozando).
2. **Selector de formato al imprimir** (nueva + detalle): `<select>` con `labelFormatOptions()` preseleccionado a `effectiveLabelFormat()`; estado local, no persiste. `printLabel()` ya recibe `format` → cambio solo frontend.
3. **Defaults en tenants existentes:** `DEFAULT_THERMAL_PROFILES` solo aplica sin fila guardada. Si algún tenant (prod) ya guardó perfiles, no verá 57×32 → añadirlo desde Ajustes (no migrar datos).
4. **Prueba física en Windows** (decisión ya tomada 2026-09-21): imprimir ambos formatos, medir QR, solape, márgenes izquierdo/derecho; ajustar `*_MM` / `^LH`.
5. **Docs:** actualizar `docs/food-labeling-system.md` solo cuando cambie el comportamiento (selector + tuning).

Esfuerzo: pequeño (1 PR: refactor tuning + tests + selector). Sin migración de BD, sin contrato API nuevo.

## Preguntas abiertas

1. ¿Una impresora o dos? Decide si vale la pena el mapa formato↔tipo de etiqueta (hoy recomendado: no).
2. ¿El rollo pedido es 57×32 (`800262-125`) o 51×32 (`880175-031D`)?
3. ¿Formato por defecto por tenant basta, o cada puesto/PC tiene su propia impresora/rollo (entonces debería ser por dispositivo, como pasó con la config IA del OCR)?
4. ¿Algún tenant en prod ya tiene perfiles guardados propios?

## Fuentes
- Repo: `backend/src/modules/etiquetado/{services/food-label-zpl.service.ts,services/etiquetado-config.service.ts,constants/zpl-presets.ts}`, `frontend/src/hooks/use-food-labels.ts`, `frontend/src/app/dashboard/etiquetado/{nueva,[id]}/page.tsx`
- [Zebra ZD220 tech specs](https://www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd220-tech-specs-en-us.pdf)
- [myZebra 880175-031D (51×32)](https://www.myzebra.co.uk/en/label-z-perform-direct-thermal/5721-zebra-part-880175-031d.html)
- [Zolemba 800262-125 (57×32)](https://www.zolemba.com/en/white-labels-on-roll/zebra-800262-125-57x32mm)
