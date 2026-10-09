/**
 * Convierte el HTML de una página en el texto que leerá la IA.
 *
 * La página es contenido hostil y el backend es un único proceso para todos
 * los tenants, así que todo el recorrido es de coste lineal: se avanza con
 * `indexOf` y nunca se aplica una regex con retroceso sobre la entrada.
 */

const MAX_JSON_LD_BLOCKS = 10;
const MAX_JSON_LD_CHARS = 20_000;
const MAX_TOTAL_CHARS = 30_000;
// Muchas webs publican la descripción (y a veces la receta entera) en <meta>.
const MAX_META_TAGS = 200;
const MAX_META_TEXT = 2000;
const MAX_META_URL = 2048;

// Elementos cuyo contenido no es texto de la receta.
const SKIPPED_ELEMENTS = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "header",
  "footer",
  "template",
  "iframe",
]);

const BLOCK_ELEMENTS = new Set([
  "p",
  "div",
  "br",
  "li",
  "ul",
  "ol",
  "tr",
  "table",
  "section",
  "article",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "dt",
  "dd",
]);

// Celdas de tabla: sin separador, "Leche | 1 | 50 ml" se leería "Leche150 ml".
const CELL_ELEMENTS = new Set(["td", "th"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  iquest: "¿",
  iexcl: "¡",
};

/**
 * Devuelve los datos estructurados de la página (bloques `ld+json`, que es
 * donde las webs de recetas publican schema.org/Recipe) seguidos del texto
 * visible. Los bloques van en crudo: los interpreta la IA, no este código.
 */
export function extractRecipeSourceText(html: string): string {
  // Minúsculas solo ASCII: `toLowerCase()` cambia la longitud de algunos
  // caracteres (İ → 2 unidades) y los índices dejarían de valer para `html`.
  const lower = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const jsonLd = collectJsonLdBlocks(html, lower);
  const text = htmlToText(html, lower);
  const meta = collectMeta(html, lower);

  const parts: string[] = [];
  // La descripción de <meta> a veces contiene la receta (pasos incluidos) que
  // no está en el texto visible: sin esto la IA no puede devolver los pasos.
  const metaText = [meta.title, meta.description]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  if (metaText) {
    parts.push(`TÍTULO Y METADATOS DE LA PÁGINA:\n${metaText}`);
  }
  if (jsonLd.length) {
    parts.push(`DATOS ESTRUCTURADOS DE LA PÁGINA:\n${jsonLd.join("\n")}`);
  }
  parts.push(`TEXTO DE LA PÁGINA:\n${text}`);
  return parts.join("\n\n").slice(0, MAX_TOTAL_CHARS);
}

/**
 * URL de la imagen principal de la receta (foto del plato), si la web la
 * publica: `og:image`/`twitter:image` o el campo `image` del schema.org. La
 * resuelve el llamante contra la URL de la página (puede ser relativa).
 */
export function extractRecipeImageUrl(html: string): string | null {
  const lower = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const meta = collectMeta(html, lower);
  if (meta.image) {
    return meta.image;
  }
  return findJsonLdImage(html, lower);
}

function collectJsonLdBlocks(html: string, lower: string): string[] {
  const blocks: string[] = [];
  let total = 0;
  let pos = 0;

  while (blocks.length < MAX_JSON_LD_BLOCKS && total < MAX_JSON_LD_CHARS) {
    const open = lower.indexOf("<script", pos);
    if (open === -1) {
      break;
    }
    const tagEnd = lower.indexOf(">", open);
    if (tagEnd === -1) {
      break;
    }
    const close = lower.indexOf("</script", tagEnd);
    if (close === -1) {
      // Sin cierre no hay más bloques completos: parar, no reintentar desde
      // cada apertura (eso sería cuadrático con miles de aperturas sin cerrar).
      break;
    }
    if (lower.slice(open, tagEnd).includes("application/ld+json")) {
      const content = html.slice(tagEnd + 1, close).trim();
      if (content) {
        const room = MAX_JSON_LD_CHARS - total;
        blocks.push(content.slice(0, room));
        total += Math.min(content.length, room);
      }
    }
    pos = close + 1;
  }
  return blocks;
}

const META_DESCRIPTION_KEYS = [
  "og:description",
  "twitter:description",
  "description",
];
const META_IMAGE_KEYS = ["og:image:secure_url", "og:image", "twitter:image"];

interface PageMeta {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * Título y metadatos útiles. Los `<meta>` no son texto visible pero suelen
 * llevar la descripción (a veces la receta entera) y la imagen principal.
 */
function collectMeta(html: string, lower: string): PageMeta {
  const values: Record<string, string> = {};

  let count = 0;
  let pos = 0;
  while (count < MAX_META_TAGS) {
    const open = lower.indexOf("<meta", pos);
    if (open === -1) {
      break;
    }
    const gt = lower.indexOf(">", open);
    if (gt === -1) {
      break;
    }
    if (readTagName(lower, open + 1, gt) === "meta") {
      // El contenido de un tag es corto: la regex va acotada, coste constante.
      const attrs = parseAttributes(html.slice(open + 5, gt));
      const key = (attrs.property || attrs.name || "").toLowerCase();
      const content = attrs.content;
      if (key && content && !(key in values)) {
        values[key] = decodeEntities(content).trim();
      }
      count++;
    }
    pos = gt + 1;
  }

  const pick = (keys: string[], max: number): string | null => {
    for (const key of keys) {
      const value = values[key];
      if (value) {
        return value.slice(0, max);
      }
    }
    return null;
  };

  return {
    title: readTitle(html, lower),
    description: pick(META_DESCRIPTION_KEYS, MAX_META_TEXT),
    image: pick(META_IMAGE_KEYS, MAX_META_URL),
  };
}

function readTitle(html: string, lower: string): string | null {
  const open = lower.indexOf("<title");
  if (open === -1) {
    return null;
  }
  const gt = lower.indexOf(">", open);
  const close = lower.indexOf("</title", gt);
  if (gt === -1 || close === -1) {
    return null;
  }
  const title = decodeEntities(html.slice(gt + 1, close))
    .trim()
    .slice(0, 300);
  return title || null;
}

/** Atributos de un tag: `name="x"`, `name='x'` o `name=x`. */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attrs;
}

function findJsonLdImage(html: string, lower: string): string | null {
  for (const block of collectJsonLdBlocks(html, lower)) {
    let data: unknown;
    try {
      data = JSON.parse(block);
    } catch {
      continue; // bloque no JSON o recortado: se ignora
    }
    const image = imageFromJsonLd(data);
    if (image) {
      return image.slice(0, MAX_META_URL);
    }
  }
  return null;
}

function imageFromJsonLd(data: unknown): string | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const image = imageFromJsonLd(item);
      if (image) {
        return image;
      }
    }
    return null;
  }
  if (data && typeof data === "object") {
    const node = data as Record<string, unknown>;
    const graph = imageFromJsonLd(node["@graph"]);
    if (graph) {
      return graph;
    }
    return imageValue(node.image);
  }
  return null;
}

function imageValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageValue(item);
      if (image) {
        return image;
      }
    }
    return null;
  }
  if (value && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string") {
      return url;
    }
  }
  return null;
}

function htmlToText(html: string, lower: string): string {
  const out: string[] = [];
  const length = html.length;
  // Elementos omitibles que ya se sabe que no tienen cierre: se buscan una
  // sola vez para que una página con miles de aperturas siga siendo lineal.
  const unclosed = new Set<string>();
  let pos = 0;

  while (pos < length) {
    const lt = html.indexOf("<", pos);
    if (lt === -1) {
      out.push(html.slice(pos));
      break;
    }
    if (lt > pos) {
      out.push(html.slice(pos, lt));
    }

    if (lower.startsWith("<!--", lt)) {
      const end = lower.indexOf("-->", lt + 4);
      pos = end === -1 ? length : end + 3;
      continue;
    }

    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      break;
    }
    const name = readTagName(lower, lt + 1, gt);

    if (
      SKIPPED_ELEMENTS.has(name) &&
      lower[lt + 1] !== "/" &&
      !unclosed.has(name)
    ) {
      const close = lower.indexOf(`</${name}`, gt);
      if (close !== -1) {
        const closeEnd = lower.indexOf(">", close);
        pos = closeEnd === -1 ? length : closeEnd + 1;
        out.push("\n");
        continue;
      }
      // Sin cierre (p. ej. un <iframe> suelto): no tirar el resto de la página.
      unclosed.add(name);
    }

    if (BLOCK_ELEMENTS.has(name)) {
      out.push("\n");
    } else if (CELL_ELEMENTS.has(name)) {
      out.push(" ");
    }
    pos = gt + 1;
  }

  return collapseWhitespace(decodeEntities(out.join("")));
}

/** Nombre de la etiqueta que empieza en `start` (sin la barra de cierre). */
function readTagName(lower: string, start: number, limit: number): string {
  let i = lower[start] === "/" ? start + 1 : start;
  const from = i;
  while (i < limit) {
    const code = lower.charCodeAt(i);
    const isLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (!isLetter && !isDigit) {
      break;
    }
    i++;
  }
  return lower.slice(from, i);
}

function decodeEntities(text: string): string {
  // Longitudes acotadas: cada intento de coincidencia es de coste constante.
  return text.replace(
    /&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g,
    (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return NAMED_ENTITIES[body] ?? match;
    },
  );
}

function collapseWhitespace(text: string): string {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw
      .split(/[ \t\r\f\v ]+/)
      .join(" ")
      .trim();
    if (line) {
      lines.push(line);
    }
  }
  return lines.join("\n");
}
