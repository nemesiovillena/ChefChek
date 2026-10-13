# Captura de recetas: módulo completo en seis fases, PR #290

**Fecha**: 2026-10-07 22:55
**Severity**: Media (sin incidencias en producción; un defecto grave de memoria y varios medios cazados en revisión antes de salir de la rama)
**Componente**: `backend/src/modules/recipe-capture/`, `backend/src/modules/ai-assistant/{assistant-completion.service,provider-error-message.util,providers/}`, `backend/src/common/utils/ssrf-safe-url.util.ts`, `backend/src/modules/recipes/recipes.service.ts`, `frontend/src/app/dashboard/captura-recetas/`, `frontend/src/app/dashboard/recipes/`
**Estado**: PR #290 abierto contra `develop`, las cuatro comprobaciones en verde, pendiente de fusionar

## Qué pasó

Módulo nuevo `captura-recetas` (activable por cliente, apagado por defecto): una receta externa entra por enlace, texto pegado o foto/PDF; la IA del Asistente la convierte a nuestro formato en segundo plano; queda en revisión con un artículo sugerido por ingrediente; "Pasar a Recetas" crea la receta real y la abre en edición. Plan en `plans/261006-1324-captura-recetas/`, seis fases, siete commits.

## La verdad brutal

**El plan inicial no habría funcionado.** Lo escribí en 5,5 días de estimación y la revisión adversarial (cuatro revisores, 38 hallazgos, 15 tras deduplicar) le encontró tres fallos que decidían si la función servía:

- `Recipe.notes` era una columna muerta: sin DTO, sin servicio, sin pantalla. Los ingredientes sin vincular se habrían guardado donde nadie los ve.
- El emparejador de albaranes (`LineMatchingService`) compara cadenas completas con umbral 0,8: "harina" contra "HARINA TRIGO T55 SACO 25KG" da 0,2. No habría sugerido casi nada.
- Los adaptadores de IA estaban ajustados al chat: Anthropic cortaba a 1024 tokens y el timeout era de 30 s. Cualquier receta larga habría fallado siempre.

La estimación subió a 9 días. Mereció la pena pasar la revisión antes de escribir código.

**La revisión de código de la fase 2 cazó una bomba de descompresión.** El límite de 2 MB recortaba el resultado pero no paraba el descompresor: una respuesta brotli de 3 KB se expandía a 2 GB en memoria del proceso compartido por todos los clientes. Mi test solo miraba la longitud devuelta y no podía verlo. Arreglado (medido: +5 MB con la misma respuesta) y con un test que falla si se quita el arreglo.

**La prueba con IA real cambió el diseño dos veces.** "agua" sugería "PAN BARRA DE AGUA" con confianza máxima: ahora la primera palabra del artículo tiene que estar en el ingrediente. Y un 429 por cuota agotada se mostraba como "saturación temporal, no es tu configuración": ahora tiene su mensaje.

## Decisiones que conviene recordar

- **Paso a Recetas recuperable, no atómico.** `RecipesService.create` confirma la fila y luego sigue consultando, así que puede fallar con la receta ya creada; revertir sin más la habría duplicado al reintentar. Se reclama la captura (`PASANDO`) con un id de receta reservado y, si algo falla, ese id dice si la receta llegó a existir.
- **Descarte por estado (`DESCARTADA`), no por `deletedAt`.** El middleware de borrado lógico es una lista cerrada; un `deletedAt` nuevo habría obligado a filtrar a mano en cada consulta.
- **Descarga con `node:http(s).request`, no con `fetch`.** Es la única forma de conectar a la IP ya validada; `fetch` resuelve el DNS por su cuenta y dejaría pasar un cambio de respuesta hacia la LAN o Tailscale.
- **Foto/PDF por los adaptadores del asistente, no por el OCR Python.** El OCR devuelve albaranes estructurados y usa otra configuración de claves.
- **Receta inactiva si queda algún ingrediente sin vincular** (decisión del usuario), y por eso el OWNER pasa a ver las inactivas igual que el ADMIN.
- **Los pendientes van en un bloque "Pendiente de completar", no en "Notas".** El campo que el formulario de Recetas llama "Notas" guarda en realidad `description`.

## Lo que queda sin verificar

- Con IA real solo se probó Gemini: texto, URL y PDF. Imagen, Anthropic y OpenAI solo con respuestas simuladas.
- `gemini-flash-latest` no respondía el día de la prueba; se usó `gemini-flash-lite-latest` con la misma clave.
- Sin probar en móvil ni en modo claro.
- Un ingrediente en unidades contra un artículo comprado por kilo (huevos, ajos) va a pendientes aunque el artículo tenga peso medio por unidad.

## Hallazgos previos que no se tocaron

- `useApiQuery` envuelve los errores en `Error` plano, así que la regla "no reintentar 4xx" no se aplica: un 4xx tarda unos 7 s en mostrarse y se pausa si la pestaña no está en primer plano.
- `GET /ai-assistant/config` devuelve a un SUPERADMIN sin cliente la configuración mezclada de todos los clientes (proveedor y modelo, no la clave).
- El e2e del asistente deja sus dos clientes de prueba borrados lógicamente y falla en la segunda ejecución por slug único.
- El hook `scout-block` bloquea cualquier comando con la palabra `build`, incluido el texto de un PR.
