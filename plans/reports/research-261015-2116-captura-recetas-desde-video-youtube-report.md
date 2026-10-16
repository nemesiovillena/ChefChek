# Research: Captura de recetas desde vídeo (YouTube)

Fecha: 2026-10-15 21:16 (Europe/Madrid)

## Resumen

**Recomendación:** que Gemini vea el vídeo directamente. Gemini acepta una URL pública de YouTube como `fileData.fileUri` y analiza imagen y audio. Así no hay que descargar nada ni pedir transcripciones a YouTube, que bloquea las IP de servidores (VPS/nube, nuestro caso en Hostinger). La salida sigue siendo el mismo `StructuredRecipe`, con el mismo prompt y el mismo flujo de revisión y paso a Recetas.

**Límite:** solo funciona con proveedor **Gemini**. Anthropic, OpenAI y OpenCode no aceptan URLs de YouTube. Si el proveedor configurado no es Gemini, el plan B es pasar el **título y la descripción** del vídeo como texto. Muchos canales de cocina ponen ahí la lista de ingredientes. No da para extraer los pasos dichos en voz.

## Cómo está hoy el módulo

- Fuentes: `URL`, `TEXTO` y `ARCHIVO` (`dto/create-recipe-capture.dto.ts`, enum `RecipeCaptureSource`).
- `RecipeCaptureService.toStructuringInput()` convierte cada fuente en `StructuringInput { text? | attachment? }`.
- `ChatAttachment` = `{ mimeType, dataBase64 }` (solo inline). El adaptador Gemini lo convierte en `inlineData` (`gemini-provider.adapter.ts:140`).
- Config IA propia por tenant (`recipe_capture.provider/model/apiKey`), en segundo plano (PROCESANDO→PENDIENTE/ERROR), con `TIMEOUT_MS=120s`.
- Hoy, si se pega una URL de YouTube en "URL", `fetchPublicPage` descarga el HTML de YouTube: no hay receta, solo metadatos o un muro de consentimiento. Resultado: «No se encontró una receta» o algo parcial.

## Opciones evaluadas

| Opción | Pasos hablados | Coste/infra | Fiabilidad en servidor | Veredicto |
|---|---|---|---|---|
| **A. Gemini + `fileUri` YouTube** | Sí (audio + imagen) | Solo tokens Gemini | Alta (descarga Google, no nosotros) | **Elegida** |
| B. Transcripción (youtube-transcript-api, yt-dlp, timedtext) | Sí, si hay subtítulos | Proxies residenciales de pago | Baja: YouTube bloquea IP de nube (RequestBlocked/IpBlocked) | Descartada |
| C. API transcripción de pago (Supadata, TranscriptAPI…) | Sí | Suscripción + otro tercero con datos | Media-alta | Descartada (YAGNI, dependencia extra) |
| D. YouTube Data API `videos.list` (descripción) | No | 1 unidad/llamada, 10k/día gratis; requiere API key Google | Alta | Fallback no-Gemini, opcional |
| E. oEmbed / HTML de la página | No | 0 | Media (consentimiento UE) | Solo para el título |
| F. Descargar vídeo (yt-dlp) + subir a File API | Sí | ffmpeg/python en imagen Docker, GBs | Baja (mismo bloqueo IP) y gris por ToS | Descartada |

`captions.download` de la API oficial exige ser editor del vídeo: no sirve para vídeos ajenos.

## Detalles de Gemini con YouTube (docs oficiales)

- Parte `{ fileData: { fileUri: "https://www.youtube.com/watch?v=..." } }` + parte de texto con el prompt.
- Solo vídeos **públicos**. Privados y ocultos no funcionan.
- Plan gratuito: máx. 8 h de vídeo de YouTube al día. De pago: sin límite por duración.
- Gemini 2.5+: hasta 10 vídeos por petición (aquí basta con 1).
- Tokens: unos 300 tokens/s con resolución por defecto, unos 100 tokens/s con `mediaResolution: LOW`. **Un vídeo de 10 min ≈ 180k tokens (≈60k en LOW).** Para leer una receta basta LOW. La ventana de 1M de tokens permite vídeos de unos 45-50 min en defecto (no se ha comprobado con un vídeo real).
- Hay un bug reportado en el foro («Total file count exceeding 10000») sin fichero subido. No está confirmado: tratarlo como error reintentable.
- Shorts: la URL `youtube.com/shorts/ID` hay que normalizarla a `watch?v=ID`.

## Diseño propuesto (mínimo)

```
Frontend: modo «Vídeo» (o detectar youtube.com|youtu.be en «URL»)
   │  POST /recipe-captures { source: "VIDEO", url }
Backend: CreateRecipeCaptureDto → IsIn([... "VIDEO"]), url validada a dominio YouTube
   │  normalizeYouTubeUrl() → https://www.youtube.com/watch?v=<11 chars>
   │  toStructuringInput(): { attachment: { mimeType: "video/*", fileUri } }
   │  imagen del plato: https://i.ytimg.com/vi/<id>/hqdefault.jpg (vía fetchPublicImage)
Gemini adapter: si attachment.fileUri → parts.push({ fileData: { fileUri } })
   │  + generationConfig.mediaResolution = MEDIA_RESOLUTION_LOW (solo si hay vídeo)
RecipeStructuringService: mismo SYSTEM_PROMPT (añadir "vídeo" a fuentes; leer
   cantidades dichas o en pantalla; si no se dicen → quantity null)
```

Cambios concretos:

1. **Prisma**: `RecipeCaptureSource` + `VIDEO`. Migración con `ALTER TYPE ... ADD VALUE` (ojo con [[prisma-migrate-diff-shared-dev-db-drops-other-branch-tables]]). Reutilizar `sourceUrl`.
2. **DTO**: `source: "URL" | "TEXTO" | "VIDEO"`, con `url` validada para el host `youtube.com`/`youtu.be`/`m.youtube.com`.
3. **`ChatAttachment`**: hacer opcional `dataBase64` y añadir `fileUri?`. **Solo el adaptador Gemini** lo soporta. Los demás deben lanzar un error claro.
4. **Validación al crear**: si la config resuelta de captura no es `gemini`, devolver 400 con «La captura desde vídeo necesita Gemini en Ajustes → Captura de recetas». No pasar al fallback salvo que se decida lo contrario (ver preguntas).
5. **Timeout**: con LOW, 120 s suele bastar para vídeos <15 min. Subir a ~180 s solo para VIDEO, porque los vídeos largos tardan más.
6. **Reintentar**: ya funciona con `sourceUrl` (`toCaptureWork` añade la rama VIDEO).
7. **Frontend**: pestaña o opción «Vídeo» en `recipe-capture-create-form.tsx`, con texto de ayuda («vídeo público de YouTube; requiere Gemini»). En el listado, icono de vídeo en lugar del de URL.
8. **Tests**: normalizador de URL (watch, youtu.be, shorts, embed, con `t=`/`si=`), mapeo `fileData` en el adaptador Gemini, rechazo con proveedor no Gemini.

Tamaño estimado: pequeño-medio. Unos 8-10 ficheros, sin servicios nuevos ni dependencias.

## Riesgos y trampas

- **Coste**: un vídeo largo con resolución por defecto puede costar más de 10 veces lo que cuesta una página web. Forzar LOW y quizá limitar la duración (sin API de YouTube no se conoce la duración antes de llamar; Gemini fallará con vídeos muy largos y el error ya se muestra).
- **Errores 503/429 de Gemini** (ver [[asistente-ia-gemini-503-needs-retry]]): el reintento existente se aplica igual.
- **Recetas sin cantidades**: muchos vídeos dicen "un chorrito". Lo absorbe el flujo de revisión (quantity null), pero el prompt debe pedir que no se inventen cantidades.
- **Prompt injection** desde el audio o los textos del vídeo: el SYSTEM_PROMPT ya trata la fuente como dato.
- **ToS de YouTube**: la opción A no descarga nada. Es la vía que ofrece Google.
- **Instagram/TikTok**: no tienen un equivalente. Gemini no acepta esas URLs y descargar de ellas plantea los mismos problemas (bloqueos, ToS). Queda fuera.

## Próximos pasos

1. Confirmar el alcance (preguntas abajo).
2. `/ck:plan` con las fases: modelo + DTO → adaptador Gemini `fileUri` → servicio/prompt → frontend → prueba real con 2-3 vídeos (receta hablada, receta con ingredientes en la descripción, Short).

## Fuentes

- [Gemini API: video understanding](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding)
- [Foro Gemini: bug «Total file count exceeding 10000» con YouTube](https://discuss.ai.google.dev/t/gemini-api-total-file-count-exceeding-10000-error-fires-with-0-files-listed-and-no-video-attached/177198)
- [youtube-transcript-api #593: bloqueo de IP de nube](https://github.com/jdepoix/youtube-transcript-api/issues/593)
- [HF forum: IP bans youtube-transcript-api](https://discuss.huggingface.co/t/how-to-avoid-ip-bans-when-using-youtube-transcript-api-to-fetch-youtube-video-transcripts/165346)
- [YouTube Data API: coste de cuota](https://developers.google.com/youtube/v3/determine_quota_cost)
- [TranscriptAPI: diagnóstico de bloqueos (blog de un proveedor, sesgado)](https://transcriptapi.com/blog/youtube-transcript-api-not-working)

## Preguntas sin resolver

1. ¿El tenant usa Gemini para capturas en prod? Si no, ¿basta con «requiere Gemini» o se quiere el fallback del título y la descripción con otros proveedores?
2. ¿Opción «Vídeo» separada en el formulario, o detección automática de YouTube dentro de «URL»? (Recomiendo la detección automática: un campo menos.)
3. ¿Límite de duración o de coste por captura?
4. ¿Solo YouTube, o también Instagram/TikTok más adelante? (Recomiendo solo YouTube.)
