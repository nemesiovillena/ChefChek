/**
 * Construye el cuerpo y las cabeceras de hilo de un correo saliente:
 * responder (cita el original), reenviar (bloque «Mensaje reenviado») o nuevo.
 */
export type SendMode = "new" | "reply" | "replyAll" | "forward";

export interface OriginalForReply {
  messageId?: string;
  references: string[];
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: Date | null;
  text: string;
  /** HTML del original ya saneado y con las imágenes remotas restauradas. */
  html: string | null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const textToHtml = (text: string) => escapeHtml(text).replace(/\r?\n/g, "<br>");

function formatDate(date: Date | null): string {
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

/** In-Reply-To y References para que Outlook y el móvil agrupen el hilo. */
export function threadHeaders(
  original: OriginalForReply | null,
  mode: SendMode,
) {
  if (!original?.messageId || (mode !== "reply" && mode !== "replyAll")) {
    return {};
  }
  const refs = [...original.references, original.messageId].filter(
    (r, i, all) => all.indexOf(r) === i,
  );
  return { inReplyTo: original.messageId, references: refs.join(" ") };
}

function forwardHeaderLines(o: OriginalForReply): string[] {
  return [
    "---------- Mensaje reenviado ----------",
    `De: ${o.from}`,
    `Fecha: ${formatDate(o.date)}`,
    `Asunto: ${o.subject}`,
    `Para: ${o.to}`,
    ...(o.cc ? [`CC: ${o.cc}`] : []),
  ];
}

export function buildBody(
  userText: string,
  original: OriginalForReply | null,
  mode: SendMode,
): { text: string; html: string } {
  const own = userText.trimEnd();
  if (!original || mode === "new") {
    return { text: own, html: `<div>${textToHtml(own)}</div>` };
  }

  if (mode === "forward") {
    const header = forwardHeaderLines(original);
    const originalHtml =
      original.html ?? `<div>${textToHtml(original.text)}</div>`;
    return {
      text: `${own}\n\n${header.join("\n")}\n\n${original.text}`,
      html:
        `<div>${textToHtml(own)}</div><br>` +
        `<div>${header.map(escapeHtml).join("<br>")}</div><br>${originalHtml}`,
    };
  }

  const intro = `El ${formatDate(original.date)}, ${original.from} escribió:`;
  const quoted = original.text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  const originalHtml = original.html ?? textToHtml(original.text);
  return {
    text: `${own}\n\n${intro}\n${quoted}`,
    html:
      `<div>${textToHtml(own)}</div><br><div>${escapeHtml(intro)}</div>` +
      `<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${originalHtml}</blockquote>`,
  };
}
