---
title: 'Captura de recetas desde URL, texto o foto/PDF'
description: >-
  Módulo nuevo: la IA convierte una receta externa (URL, texto pegado o
  foto/PDF) a nuestro formato, queda en un listado de revisión y se pasa a
  Recetas con un clic.
status: completed
priority: P2
branch: feat/captura-recetas
tags:
  - recetas
  - ia
  - modulo-nuevo
blockedBy: []
blocks: []
created: '2026-10-06T11:30:51.267Z'
createdBy: 'ck:plan'
source: skill
---

# Captura de recetas desde URL, texto o foto/PDF

## Overview

Módulo nuevo `captura-recetas`. El usuario aporta una receta externa (URL, texto pegado o foto/PDF); la IA configurada en Configuración → Asistente IA la convierte a nuestro formato y la guarda en el listado "Captura de recetas". Tras revisarla, "Pasar a Recetas" crea la receta real y la abre en edición.

Rama: crear `feat/captura-recetas` desde `develop` (no trabajar sobre `feat/conector-cuiner`, que tiene cambios sin commitear).

Esfuerzo estimado: ~9 días (0,5 + 2 + 2 + 1,5 + 1 + 2).

## Decisiones cerradas (usuario, 2026-10-06)

| Tema | Decisión |
|------|----------|
| Ingredientes al pasar | Los vinculados a un artículo pasan como líneas reales; el resto se copia como texto en `Recipe.notes` |
| Motor IA | Config del Asistente IA del tenant (`AiAssistantConfigService`), sin config propia |
| Ubicación | Módulo independiente activable por tenant (`captura-recetas`) con sección propia en permisos por rol |
| Fuentes v1 | URL + texto pegado + foto/PDF |
| Receta con ingredientes sin vincular | Se crea **inactiva**, con el bloque de ingredientes pendientes visible en notas; la activa el usuario al completarla |
| Dependencia de módulos | Solo `recipes`. No exige el módulo `asistente-ia` (el chat puede estar apagado) |

## Decisiones técnicas (derivadas del código y de la revisión adversarial)

- **Staging propio**: `RecipeIngredient.productId` es obligatorio, así que la captura vive en `RecipeCapture` + `RecipeCaptureIngredient` con ingredientes en texto libre y `matchedProductId` opcional.
- **Background + polling**: crear devuelve al instante en `PROCESANDO`; el frontend sondea cada 3 s. Las capturas huérfanas se pasan a `ERROR` de forma persistente (no solo en pantalla).
- **Descarte por estado** (`DESCARTADA`), no por `deletedAt`: el middleware de borrado lógico es una lista cerrada y no cubriría el modelo nuevo.
- **Foto/PDF por los adaptadores del asistente, no por el OCR Python** (sus endpoints devuelven albaranes estructurados). Los adaptadores ganan adjuntos **y** opciones por llamada (tokens de salida, timeout, modo JSON, sin reintento): hoy Anthropic corta a 1024 tokens y el timeout es de 30 s.
- **`AiAssistantService` no se toca**: servicio nuevo `AssistantCompletionService` al lado; solo se extrae a un archivo compartido la función que traduce errores del proveedor a mensajes legibles.
- **Emparejador propio de ingredientes**: `LineMatchingService` está afinado para líneas de albarán (similitud de cadena completa ≥ 0,8) y no vincularía nombres genéricos.
- **HTML sin dependencia nueva y sin regex con retroceso**: escáner lineal; los bloques `ld+json` se pasan en crudo a la IA (no se interpreta el JSON-LD).
- **SSRF**: `assertPublicHttpUrl` solo valida el host literal. El fetcher nuevo usa `node:http(s).request` con la IP ya validada fijada en `lookup` (el `fetch` global no admite agente), redirecciones manuales revalidadas, solo puertos 80/443, sin `user:pass@`, y un comprobador de rangos ampliado.
- **Pasar a Recetas recuperable**: estado intermedio `PASANDO` + id de receta reservado antes de crear, para no duplicar si falla a medias.
- **`Recipe.notes` y `Recipe.sourceUrl`** existen en el esquema pero ni se escriben ni se muestran: se cablean de extremo a extremo (DTO, servicio, respuesta, modal y vista).

## Fuera de alcance

- Redes sociales, vídeo, webs con muro de pago o renderizadas por JavaScript (quedan en `ERROR` con mensaje claro).
- Fotos HEIC (se rechazan con mensaje "usa JPG o PNG").
- Imagen de la receta.
- Crear artículos desde la pantalla de captura.
- Botón "Reintentar" en capturas con error (se vuelve a crear; el texto pegado se conserva para copiarlo).
- Cuota diaria de IA por tenant.
- Notas en el PDF de ficha técnica.
- Validar dependencias de módulos al activar (hoy solo se comprueban al desactivar; no se cambia aquí).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Modelo de datos y registro del módulo](./phase-01-modelo-de-datos-y-registro-del-m-dulo.md) | Completed |
| 2 | [Obtención de texto por fuente (URL segura / texto / archivo)](./phase-02-obtenci-n-de-texto-por-fuente-url-segura-texto-archivo.md) | Completed |
| 3 | [Estructuración con IA y API de capturas](./phase-03-estructuraci-n-con-ia-y-api-de-capturas.md) | Completed |
| 4 | [Pasar captura a Recetas](./phase-04-pasar-captura-a-recetas.md) | Completed |
| 5 | [Frontend listado y nueva captura](./phase-05-frontend-listado-y-nueva-captura.md) | Completed |
| 6 | [Frontend revisión y paso a Recetas](./phase-06-frontend-revisi-n-y-paso-a-recetas.md) | Completed |

Orden: 1 → 2 → 3 → 4 (backend); 5 depende de 3; 6 depende de 4 y 5.

## Acceptance criteria

- [ ] Con el módulo activo y la IA configurada (proveedor, modelo y clave), pegar la URL de una web de recetas produce una captura `PENDIENTE` con nombre, raciones, tiempos, pasos e ingredientes en español.
- [ ] Una receta larga (≥ 20 ingredientes, ≥ 12 pasos) se captura completa con los tres proveedores.
- [ ] Texto pegado y foto/PDF producen el mismo resultado por el mismo camino.
- [ ] Una URL hacia IP privada, loopback, LAN o Tailscale no llega a abrir conexión, tampoco tras redirección ni con DNS que cambia de respuesta.
- [ ] Sin IA configurada la pantalla lo avisa y enlaza a Configuración; no se crea captura.
- [ ] En un catálogo real, al menos la mitad de los ingredientes comunes reciben artículo sugerido.
- [ ] "Pasar a Recetas" crea una sola receta (doble clic, reintento tras fallo) con `sourceUrl`, líneas vinculadas y el resto visible en notas; se abre en edición.
- [ ] Si quedan ingredientes sin vincular, la receta se crea inactiva.
- [ ] Un ingrediente cuya unidad no es compatible con la del artículo va a notas, no a una línea con coste erróneo.
- [ ] Un usuario sin acceso a Recetas o sin `recipes.edit` no puede pasar capturas.
- [ ] Con el módulo desactivado, ni el menú ni la ruta ni la API responden.
- [ ] Exportar y restaurar un backup de tenant conserva capturas e ingredientes.
- [ ] El chat del asistente se comporta igual que antes.
- [ ] Tests backend (jest) en verde; `bun run build` de frontend en verde.

## Dependencies

- Ningún plan en curso solapa. `261005-1852-conector-cuiner-chefchek` toca `registry.ts` y `nav-config.ts`: posible conflicto trivial de merge.

## Open questions

1. PDF con OpenAI depende del modelo elegido por el tenant; se verifica contra la documentación actual en la fase 2. Si el modelo no admite adjuntos, la captura termina en `ERROR` con mensaje legible.
2. El límite de peticiones global va por IP y no se ha comprobado cómo llega la IP tras el proxy de producción. El plan no depende de él: usa un tope de capturas simultáneas por tenant.

## Verificación con IA real

2026-10-06: texto pegado verificado de principio a fin (Gemini `gemini-flash-latest`).

2026-10-07: `gemini-flash-latest` no respondía (503 y timeouts incluso a una petición mínima), así que la prueba se hizo con la misma clave y `gemini-flash-lite-latest`, sin cambiar la configuración del tenant:
- [x] Captura por URL termina en `PENDIENTE` (web en inglés → receta en español, 15 ingredientes, 5 pasos, tiempos y raciones).
- [x] Captura por PDF (adjunto `inlineData` de Gemini): 7 ingredientes, 4 pasos.
- [x] Sugerencia de artículo en el catálogo real: 12 de 22 ingredientes (55 %), varias marcadas como "revisar".
- [ ] Captura por imagen (JPG/PNG).
- [ ] Adjuntos con Anthropic y OpenAI (solo comprobados con respuestas simuladas).
- [ ] Receta de ≥ 20 ingredientes y ≥ 12 pasos con los tres proveedores.

## Red Team Review

### Session — 2026-10-06
**Findings:** 15 tras deduplicar 38 (15 aceptados, 2 de ellos parcialmente; 0 rechazados)
**Severity breakdown:** 3 Critical, 11 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `Recipe.notes` es una columna muerta: sin DTO, servicio, respuesta ni UI | Critical | Accept | Completed |
| 2 | `LineMatchingService` no vincula nombres genéricos y se leía el campo equivocado | Critical | Accept | Completed |
| 3 | Adaptadores: 1024 tokens (Anthropic), 30 s sin reintento, sin opciones por llamada | Critical | Accept | Completed |
| 4 | El deep link `?recipe=` abre la vista de lectura, no la edición | High | Accept | Completed |
| 5 | Promote no atómico: duplicados al revertir y `PASADA` con `recipeId` nulo | High | Accept | Completed |
| 6 | Unidades incompatibles cuestan con factor 1; `ud` vs `units`; DTO sin validar; `name` nulo | High | Accept | Completed |
| 7 | Receta activa con alérgenos solo de ingredientes vinculados | High | Accept (decisión de usuario: inactiva) | Phase 4, Phase 6 |
| 8 | SUPERADMIN sin tenant: consultas sin filtro y clave de otro tenant | High | Accept | Phase 3 |
| 9 | Fijado de IP inviable con `fetch`; tests no lo prueban; rangos incompletos | High | Accept | Phase 2 |
| 10 | Regex sobre 2 MB de HTML hostil bloquea el proceso; JSON-LD redundante | High | Accept | Phase 2 |
| 11 | Throttle por IP, entradas a la IA sin tope en servidor, sin tope de concurrencia | High | Accept (parcial: sin cuota diaria) | Phase 3, Phase 5 |
| 12 | `PROCESANDO` huérfano solo se enmascara; polling infinito; texto pegado perdido | High | Accept (parcial: sin "Reintentar") | Phase 1, Phase 3, Phase 5 |
| 13 | Backup, borrado lógico y fusión de artículos no cubren las tablas nuevas | High | Accept | Phase 1 |
| 14 | Dependencias solo al desactivar; promote con menos permisos que crear receta | High | Accept (decisión de usuario: solo `recipes`) | Phase 1, Phase 4 |
| 15 | Refactor innecesario del chat; errores del proveedor en crudo; `hasApiKey` engañoso | Medium | Accept | Phase 3, Phase 5 |

### Whole-Plan Consistency Sweep

Delta de decisiones aplicado en todos los archivos:
- `deletedAt` → estado `DESCARTADA`; nuevo estado `PASANDO`; columnas nuevas `sourceText`, `reservedRecipeId`, `claimedAt`, `matchConfidence`.
- Dependencias `["recipes"]`; eliminado el criterio "no deja activarse sin…".
- `LineMatchingService` sustituido por `capture-ingredient-matcher.ts`.
- `chat(..., [])` → `chat(..., [], options)`; `AiAssistantService` sin cambios.
- JSON-LD interpretado → bloques en crudo; regex → escáner lineal.
- Roles sin SUPERADMIN; subida 10 MB → 5 MB; HEIC fuera.
- Deep link `?recipe=<id>` → `?recipe=<id>&edit=1`.
- `hasApiKey` → `isReady`.
- Receta creada "activa" → inactiva si hay ingredientes en notas.

Contradicciones sin resolver: ninguna.
