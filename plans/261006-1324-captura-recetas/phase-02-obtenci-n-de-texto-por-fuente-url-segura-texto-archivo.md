---
phase: 2
title: Obtención de texto por fuente (URL segura / texto / archivo)
status: in-progress
priority: P1
effort: 2d
dependencies:
  - 1
---

# Phase 2: Obtención de texto por fuente (URL segura / texto / archivo)

## Overview

Dos entregables independientes: (A) descarga segura de páginas y extracción de texto, ~1 día; (B) adjuntos y opciones por llamada en los adaptadores del asistente, ~1 día.

## Requirements

- Functional:
  - URL → HTML → texto para la IA (bloques `ld+json` en crudo + texto plano de la página).
  - Foto/PDF → adjunto `{ mimeType, dataBase64 }` para el modelo.
  - Los adaptadores admiten respuestas largas en JSON y llamadas lentas.
- Non-functional: el servidor nunca abre conexión a red privada; límites duros de tamaño y tiempo; el análisis de HTML es de coste lineal; sin dependencias nuevas; el chat no cambia de comportamiento.

## Architecture

### A. Descarga y extracción

```
backend/src/modules/recipe-capture/source/
  safe-page-fetcher.ts        # descarga con barrera SSRF
  recipe-html-extractor.ts    # funciones puras, sin red
```

**`common/utils/ssrf-safe-url.util.ts`** — el comprobador actual es privado, pensado para hosts literales y con huecos. Sustituirlo por `isPublicUnicastAddress(ip)` exportado:
- IPv4: denegar todos los bloques de uso especial (0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4, 255.255.255.255).
- IPv6: `::`, `::1`, `fc00::/7`, `fe80::/10` completo, `ff00::/8`; y **desenvolver** `::ffff:a.b.c.d`, NAT64 `64:ff9b::/96`, 6to4 `2002::/16` y Teredo `2001::/32` para revalidar la IPv4 interior.
- Trabajar sobre bytes parseados, no sobre `startsWith`. Test dirigido por tabla. `assertPublicHttpUrl` pasa a usarlo.

**`safe-page-fetcher.ts`** — `fetchPublicPage(url, deps?)`
- `assertPublicHttpUrl(url)`; además rechazar `user:pass@` y cualquier puerto que no sea 80/443.
- Resolver con `dns.promises.lookup(host, { all: true })`; rechazar si **alguna** dirección no es pública.
- Petición con **`node:http`/`node:https` `request`** (no `fetch`: el `fetch` global ignora agentes y resolvería una segunda vez) pasando una función `lookup` que devuelve únicamente la dirección ya validada. Debe soportar la firma con `all: true` (Node 20+).
- Redirecciones manuales (máx. 3), repitiendo toda la validación en cada salto.
- Timeout total 10 s.
- `Accept-Encoding: gzip, br`; descomprimir con `node:zlib` en streaming y cortar a **2 MB ya descomprimidos**.
- Juego de caracteres: del `Content-Type`, si no del `<meta charset>` en los primeros 2 KB, si no UTF-8; decodificar con `TextDecoder`.
- Solo `text/html` o `application/xhtml+xml`.
- User-Agent de navegador genérico y `Accept-Language: es`.
- El resolvedor y el `request` se inyectan (`deps`) para poder probarlos.
- Errores para el usuario: "La web no respondió", "La web bloquea el acceso automático", "La dirección no es una página web pública".

**`recipe-html-extractor.ts`** — `extractRecipeSourceText(html): string`
- Escáner **lineal** con `indexOf` (sin regex con cuantificadores perezosos sobre la entrada): la página es hostil y el proceso es único para todos los tenants.
- Recoge el contenido en crudo de los `<script type="application/ld+json">` (máx. 10 bloques, 20 000 caracteres en total). No se interpreta: la IA lo lee igual.
- Texto plano: descarta `script/style/noscript/svg/nav/header/footer`, bloque → salto de línea, entidades básicas, espacios colapsados.
- Salida: bloques JSON-LD + texto, recortado a **30 000 caracteres** en total.

### B. Adaptadores del asistente

`provider-adapter.interface.ts`:

```ts
export interface ChatAttachment { mimeType: string; dataBase64: string }
// ChatMessage gana: attachments?: ChatAttachment[]   (solo role "user")

export interface ChatOptions {
  maxOutputTokens?: number; // por defecto, el actual de cada adaptador
  timeoutMs?: number;       // por defecto 30 s
  jsonMode?: boolean;       // OpenAI response_format, Gemini responseMimeType
  noRetry?: boolean;        // no reenviar cuerpos grandes
}
// ProviderChatResult gana: truncated?: boolean

chat(apiKey, model, messages, tools, options?): Promise<ProviderChatResult>
```

- Gemini: parte `inlineData`; `truncated` si `finishReason === "MAX_TOKENS"`.
- Anthropic: bloque `image` o `document` (PDF) en base64; `max_tokens` desde `options`; `truncated` si `stop_reason === "max_tokens"`.
- OpenAI: `image_url` con data URI o parte `file` (PDF); `truncated` si `finish_reason === "length"`.
- `postJsonWithRetry` ya acepta `timeoutMs` y `retryDelaysMs`: pasarlos desde `options` (`noRetry` → `retryDelaysMs: []`).
- Sin `options` ni adjuntos, el cuerpo enviado es idéntico al actual.

## Related Code Files

- Create: `backend/src/modules/recipe-capture/source/safe-page-fetcher.ts` (+ `.spec.ts`)
- Create: `backend/src/modules/recipe-capture/source/recipe-html-extractor.ts` (+ `.spec.ts`)
- Modify: `backend/src/common/utils/ssrf-safe-url.util.ts` (+ spec)
- Modify: `backend/src/modules/ai-assistant/providers/provider-adapter.interface.ts`
- Modify: `backend/src/modules/ai-assistant/providers/{gemini,anthropic,openai}-provider.adapter.ts` (+ specs)

## Implementation Steps

1. Reescribir el comprobador de rangos con su test por tabla (incluye `192.168.18.160`, `100.68.34.99`, `fe9a::1`, `::ffff:10.0.0.1`, `64:ff9b::c0a8:12a0`, `2002:c0a8:12a0::1`). Verificar que `python-ocr.service.ts` sigue funcionando con `assertPublicHttpUrl`.
2. Tests del fetcher antes del código:
   - host literal privado, puerto 8080, `user:pass@` → rechazo sin resolver;
   - dominio que resuelve a privada → rechazo;
   - **resolvedor que cambia de respuesta** (pública, luego privada): el `lookup` pasado a `request` devuelve solo la dirección validada y el resolvedor se llama una vez por salto;
   - **integración con un servidor HTTP local real**: el fetcher con el resolvedor real no abre ningún socket hacia `127.0.0.1` (el servidor cuenta conexiones = 0);
   - redirección pública → privada rechazada;
   - cuerpo gzip que descomprime a > 2 MB cortado; `content-type` no HTML rechazado; página ISO-8859-1 decodificada bien.
3. Implementar `fetchPublicPage`.
4. Tests del extractor: un fixture con JSON-LD, uno sin él, y uno **hostil** (2 MB con 200 000 `<script type="application/ld+json">` sin cerrar) que debe terminar en < 500 ms.
5. Implementar el extractor.
6. Adaptadores: consultar la documentación actual de cada API para adjuntos PDF y modo JSON (skill `claude-api` para Anthropic, `docs-seeker` para Gemini y OpenAI). No fiarse de la memoria.
7. Specs de adaptadores: con adjunto y `options` el cuerpo lleva las partes y límites correctos; respuesta truncada → `truncated: true`; sin `options` el cuerpo es idéntico al actual.

## Success Criteria

- [ ] Ninguna URL hacia rango no público abre conexión, verificado con servidor local real y con resolvedor cambiante.
- [ ] Extractor lineal: el fixture hostil termina en < 500 ms.
- [ ] Texto extraído ≤ 30 000 caracteres y legible.
- [ ] Los tres adaptadores aceptan imagen y PDF, respetan `maxOutputTokens`/`timeoutMs` y señalan truncado.
- [ ] Specs existentes del asistente en verde sin cambios de comportamiento.

## Risk Assessment

- **SSRF** es el riesgo real del módulo: producción ve la LAN (servidor Cuiner) y Tailscale. Mitigación: validación tras DNS, conexión a IP fijada, redirecciones revalidadas, puertos restringidos y tests que cuentan conexiones reales.
- **Cliente HTTP a mano** (redirecciones, descompresión, charset) es más código que `fetch`. Es el precio de poder fijar la IP; por eso la fase son 2 días.
- **Webs con anti-bot o render por JS**: no se resuelve; error claro y el usuario usa "pegar texto".
- **Formato de adjuntos por proveedor** cambia con frecuencia → paso 6.
