---
phase: 4
title: "Frontend bandeja de correo"
status: done
priority: P2
dependencies: [2, 3]
effort: "1-1.5 días"
---

# Phase 4: Frontend bandeja de correo

## Overview
Página `/dashboard/correo` (carpetas + lista + lector) y sección "Correo del restaurante" en Ajustes.

## Requirements
- Escritorio: 3 columnas. Móvil/iPad: lista → detalle a pantalla completa con "Volver".
- Pestañas «Bandeja» y «Accesos» (`role=tablist`, `useState`; memoria: no `<nav>`). «Accesos» solo para gerencia: tabla persona · fecha · carpeta · asunto · remitente, «Cargar más». <!-- Updated: Validation Session 1 - pestaña Accesos -->
- Lista: remitente, asunto, fecha relativa, negrita si no leído (según Hostinger), clip si adjuntos. "Cargar más" por cursor `beforeUid`. "Actualizar" → `fresh=1`. [RT#15]
- Lector: cabeceras + cuerpo en `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc=…>` (sin `allow-scripts`, sin `allow-same-origin`).
- **CSP dentro del `srcdoc`** como primer elemento del `<head>`: [RT#3]
  - por defecto `default-src 'none'; img-src data: <API_ORIGIN>; style-src 'unsafe-inline'`
  - al pulsar "Mostrar imágenes": `img-src data: https: <API_ORIGIN>`
  - la reescritura `data-blocked-src → src` solo toca `img` (DOMParser sobre el HTML ya saneado).
- **Adjuntos: nunca abrir en pestaña ni navegar al blob.** Blob siempre `application/octet-stream` + `<a download={filename}>` con clic programático. Vista previa solo para `application/pdf` e `image/png|jpeg|gif|webp` (PDF en visor del navegador vía `<a download>`; imágenes en `<img>`). HTML/SVG/otros: solo descarga. **No reutilizar el patrón de `use-rrhh.ts:156-157`.** [RT#1]
- Hooks del correo con `retry: false` y `staleTime: 30_000` (evitar ráfagas de LOGIN contra Hostinger). [RT#6]
- Consultas activadas solo cuando `map !== null && canSee('correo')` (`useSectionAccess()` sin argumentos y permisivo mientras carga). [RT#9]
- 409 (buzón cambiado) → aviso + recargar lista. 503 → "Buzón no disponible, reinténtalo en unos minutos".
- Estados: no configurado (gerencia ve enlace a Ajustes; resto "Pídelo a gerencia"), error, vacío, cargando.
- Ajustes: sección nueva `mail-inbox-config-section.tsx`, ancla `correo-restaurante`, entrada de índice `{ id:'correo-restaurante', label:'Correo del restaurante', moduleId:'correo', managerOnly:true }`; renombrar la existente a "Correo de envío (SMTP)". [RT#12]
- Español, tokens del tema, dark mode, inputs ≥16px, sin `useEffect` directo.

## Architecture
- Hooks: `useMailAccessLog` (infinite, solo gerencia), `useMailFolders`, `useMailMessages(folder)` (`useInfiniteQuery`, `getNextPageParam` = último uid), `useMailMessage(folder, uid, uidValidity)`, `useMailConfig`, `useSaveMailConfig`, `useTestMailConfig`, `downloadMailPart()`.
- Altura del iframe fija con scroll interno (sin `allow-same-origin` no se puede medir).

## Related Code Files
- Create: `frontend/src/app/dashboard/correo/page.tsx`
- Create: `frontend/src/features/correo/hooks/use-correo.ts`
- Create: `frontend/src/features/correo/lib/build-mail-srcdoc.ts` (CSP + base + CSS legible)
- Create: `frontend/src/features/correo/components/mail-access-log-table.tsx`
- Create: `frontend/src/features/correo/components/mail-folder-list.tsx`, `mail-message-list.tsx`, `mail-message-reader.tsx`, `mail-attachment-list.tsx`
- Create: `frontend/src/app/dashboard/settings/components/mail-inbox-config-section.tsx` (patrón `smtp-config-section.tsx`)
- Modify: `frontend/src/app/dashboard/settings/page.tsx` (`:450` junto al bloque SMTP)
- Modify: `frontend/src/app/dashboard/settings/components/settings-section-index.tsx` (`:30`)

## Implementation Steps
1. Hooks + tipos (`retry:false`).
2. `build-mail-srcdoc(html, { showImages })` → `<!doctype html><head><meta http-equiv="Content-Security-Policy" …><base target="_blank"><style>…</style></head><body>…`.
3. Lista, lector, adjuntos (descarga segura).
4. Sección de Ajustes + entrada del índice + renombrado SMTP.

## Success Criteria
- [ ] Chrome escritorio, Safari iPad e iPhone.
- [ ] Correo con `<script>`, `<img onerror>`, `<td background=https://…>`, `style=url(https://…)` → nada se ejecuta ni se pide fuera (pestaña Red vacía) hasta "Mostrar imágenes".
- [ ] Adjunto `factura.html` con script → solo se descarga; no se ejecuta.
- [ ] Pestaña «Accesos» visible solo para gerencia y muestra cada apertura.
- [ ] Ajustes: el índice "Correo de envío (SMTP)" y "Correo del restaurante" llevan a sitios distintos.

## Risk Assessment
- Newsletters con CSS complejo se verán algo distintas a Outlook → aceptable.
- iOS y `<a download>`: Safari abre la vista de compartir/archivo; aceptable y seguro (no ejecuta en el origen).
