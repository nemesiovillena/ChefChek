import type { MessageStructureObject } from "imapflow";

/**
 * Lectura de la estructura MIME (BODYSTRUCTURE) que devuelve el servidor:
 * permite listar adjuntos y descargarlos por número de parte (p. ej. "2.1")
 * sin bajar ni re-parsear el mensaje entero.
 */
export interface MailPartInfo {
  part: string;
  filename: string;
  contentType: string;
  /** Tamaño codificado en el servidor (base64 ≈ +33 %). */
  size: number;
  inline: boolean;
  contentId?: string;
}

export const MAIL_PART_PATTERN = /^\d+(\.\d+)*$/;

function partFilename(node: MessageStructureObject): string | undefined {
  return (
    node.dispositionParameters?.filename || node.parameters?.name || undefined
  );
}

function fallbackFilename(type: string, part: string): string {
  if (type === "message/rfc822") {
    return `mensaje-adjunto-${part}.eml`;
  }
  const ext = type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  return `adjunto-${part}.${ext}`;
}

/** Partes descargables: todo menos el texto/HTML del cuerpo y los contenedores multipart. */
export function collectMailParts(
  root?: MessageStructureObject,
): MailPartInfo[] {
  const out: MailPartInfo[] = [];
  const walk = (node: MessageStructureObject) => {
    const type = (node.type || "application/octet-stream").toLowerCase();
    const part = node.part || "1";
    // Un correo reenviado como adjunto se ofrece entero, sin abrir sus partes
    if (type !== "message/rfc822" && node.childNodes?.length) {
      node.childNodes.forEach(walk);
      return;
    }
    if (type.startsWith("multipart/")) {
      return;
    }
    const filename = partFilename(node);
    const disposition = node.disposition?.toLowerCase();
    const isBodyText =
      (type === "text/plain" || type === "text/html") &&
      !filename &&
      disposition !== "attachment";
    if (isBodyText) {
      return;
    }
    out.push({
      part,
      filename: filename || fallbackFilename(type, part),
      contentType: type,
      size: node.size ?? 0,
      inline:
        disposition === "inline" ||
        (Boolean(node.id) && disposition !== "attachment"),
      contentId: node.id ? node.id.replace(/^<|>$/g, "") : undefined,
    });
  };
  if (root) {
    walk(root);
  }
  return out;
}

export function hasRealAttachments(root?: MessageStructureObject): boolean {
  return collectMailParts(root).some((p) => !p.inline);
}

export function findMailPart(
  root: MessageStructureObject | undefined,
  part: string,
): MailPartInfo | undefined {
  return collectMailParts(root).find((p) => p.part === part);
}
