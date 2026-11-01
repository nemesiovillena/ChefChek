/**
 * Documento del visor de correo (iframe `sandbox` sin scripts ni mismo origen).
 * La CSP va como primer elemento del <head>: es la barrera principal. Sin
 * "Mostrar imágenes" solo cargan imágenes `data:` (las incrustadas); con él,
 * también las https. Ningún otro recurso remoto (fuentes, CSS, formularios).
 */
const BASE_STYLE = `
  html, body { margin: 0; padding: 0; background: #fff; color: #1f1f1f; }
  body { padding: 16px; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  pre.plain { white-space: pre-wrap; font: inherit; margin: 0; }
  blockquote { margin: 0 0 0 .8ex; border-left: 2px solid #ccc; padding-left: 1ex; color: #555; }
`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function hasBlockedImages(html: string | null): boolean {
  return !!html && html.includes('data-blocked-src');
}

/** Solo toca <img>: pasa data-blocked-src a src (el HTML ya viene saneado del servidor). */
function revealImages(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img[data-blocked-src]').forEach((img) => {
    const src = img.getAttribute('data-blocked-src') ?? '';
    if (/^https:\/\//i.test(src)) img.setAttribute('src', src);
    img.removeAttribute('data-blocked-src');
  });
  return doc.body.innerHTML;
}

export function buildMailSrcdoc(
  content: { html: string | null; text: string | null },
  opts: { showImages: boolean },
): string {
  const imgSrc = opts.showImages ? 'data: https:' : 'data:';
  const csp = `default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'`;
  const body = content.html
    ? opts.showImages
      ? revealImages(content.html)
      : content.html
    : `<pre class="plain">${escapeHtml(content.text ?? '')}</pre>`;
  return (
    `<!doctype html><html><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta charset="utf-8"><base target="_blank"><style>${BASE_STYLE}</style>` +
    `</head><body>${body}</body></html>`
  );
}
