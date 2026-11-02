import sanitizeHtml from "sanitize-html";

/**
 * Saneado del HTML de un correo antes de enviarlo al navegador. Es la segunda
 * barrera: la primera es la CSP y el iframe sandbox del visor (frontend).
 *
 * - Fuera scripts, estilos en bloque, formularios, iframes, objetos, medios…
 * - Fuera atributos on*, background, srcset, poster, formaction.
 * - `style` inline solo con propiedades de formato y sin url()/expression()/@import.
 * - Imágenes remotas → `data-blocked-src` (no cargan hasta "Mostrar imágenes").
 * - `cid:` → data URI de la imagen incrustada (si se conoce) o fuera.
 * - Enlaces → nueva pestaña sin referer ni acceso a la ventana de origen.
 */

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-align",
  "text-decoration",
  "text-transform",
  "line-height",
  "letter-spacing",
  "white-space",
  "vertical-align",
  "display",
  "width",
  "max-width",
  "min-width",
  "height",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-style",
  "border-width",
  "border-radius",
  "border-collapse",
  "border-spacing",
  "list-style-type",
]);

/** Cualquier valor que pueda pedir un recurso o ejecutar algo se descarta. */
const UNSAFE_STYLE_VALUE =
  /url\s*\(|expression\s*\(|@import|javascript:|\\|\/\*/i;

const SAFE_DATA_IMAGE =
  /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

export function filterInlineStyle(style: string): string {
  return style
    .split(";")
    .map((decl) => {
      const idx = decl.indexOf(":");
      if (idx <= 0) {
        return null;
      }
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop) || !value) {
        return null;
      }
      if (UNSAFE_STYLE_VALUE.test(value)) {
        return null;
      }
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function withSafeStyle(
  attribs: Record<string, string>,
): Record<string, string> {
  const next = { ...attribs };
  if (next.style !== undefined) {
    const filtered = filterInlineStyle(next.style);
    if (filtered) {
      next.style = filtered;
    } else {
      delete next.style;
    }
  }
  return next;
}

/** contentId (sin `<>`) → data URI de una imagen incrustada segura. */
export type CidImageMap = Map<string, string>;

export function sanitizeMailHtml(
  html: string,
  cidImages: CidImageMap = new Map(),
): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "font",
      "center",
      "big",
      "strike",
    ],
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "noscript",
      "title",
      "head",
      "iframe",
      "object",
      "svg",
      "math",
      "template",
    ],
    allowedAttributes: {
      "*": [
        "style",
        "align",
        "valign",
        "width",
        "height",
        "dir",
        "lang",
        "title",
        "bgcolor",
        "border",
        "cellpadding",
        "cellspacing",
        "colspan",
        "rowspan",
      ],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "data-blocked-src"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: {
      // Un transform por etiqueta sustituye al de "*": todos filtran `style`
      "*": (tagName, attribs) => ({ tagName, attribs: withSafeStyle(attribs) }),
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...withSafeStyle(attribs),
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      img: (tagName, attribs) => {
        const next = withSafeStyle(attribs);
        delete next["data-blocked-src"]; // solo lo pone el saneado, nunca el correo
        const src = (attribs.src ?? "").trim();
        delete next.src;
        if (/^cid:/i.test(src)) {
          const dataUri = cidImages.get(src.slice(4).replace(/^<|>$/g, ""));
          if (dataUri) {
            next.src = dataUri;
          }
        } else if (/^https?:\/\//i.test(src)) {
          next["data-blocked-src"] = src;
        } else if (/^\/\//.test(src)) {
          next["data-blocked-src"] = `https:${src}`;
        } else if (SAFE_DATA_IMAGE.test(src)) {
          next.src = src;
        }
        return { tagName, attribs: next };
      },
    },
  });
}
