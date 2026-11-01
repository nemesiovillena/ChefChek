import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type {
  FetchMessageObject,
  ImapFlow,
  ListResponse,
  MessageAddressObject,
} from "imapflow";
import { simpleParser } from "mailparser";
import { ImapClientService } from "./imap-client.service";
import {
  collectMailParts,
  findMailPart,
  hasRealAttachments,
  MailPartInfo,
} from "./mail-body-structure";
import { CidImageMap, sanitizeMailHtml } from "./mail-html-sanitizer";
import { OriginalForReply } from "./mail-reply-builder";

/**
 * Lectura del buzón: carpetas, lista por cursor, detalle saneado y adjuntos.
 * Todo por UID + UIDVALIDITY y con los buzones abiertos en solo lectura
 * (EXAMINE): nada de lo que se haga aquí marca un correo como leído.
 */
export const PAGE_SIZE = 50;
export const MAX_MESSAGE_BYTES = 15 * 1024 * 1024;
const MAX_ENCODED_PART_BYTES = Math.ceil(MAX_MESSAGE_BYTES * 1.4);
const MAX_INLINE_IMAGES_BYTES = 5 * 1024 * 1024;
const CACHE_MS = 30_000;
const SAFE_INLINE_IMAGE = /^image\/(png|jpe?g|gif|webp)$/i;

const MAILBOX_CHANGED = "El buzón ha cambiado, recarga la lista.";

const SPECIAL_USE: Record<string, { label: string; order: number }> = {
  "\\Inbox": { label: "Bandeja de entrada", order: 0 },
  "\\Sent": { label: "Enviados", order: 1 },
  "\\Drafts": { label: "Borradores", order: 2 },
  "\\Archive": { label: "Archivo", order: 3 },
  "\\Junk": { label: "Spam", order: 4 },
  "\\Trash": { label: "Papelera", order: 5 },
};

export interface MailFolder {
  path: string;
  name: string;
  specialUse?: string;
}

export interface MailAddress {
  name?: string;
  address?: string;
}

export interface MailSummary {
  uid: number;
  from: MailAddress[];
  to: MailAddress[];
  subject: string;
  date: string | null;
  seen: boolean;
  hasAttachments: boolean;
  size: number;
}

export interface MailListPage {
  uidValidity: string;
  messages: MailSummary[];
  nextBeforeUid: number | null;
}

export interface MailDetail extends MailSummary {
  folder: string;
  uidValidity: string;
  messageId?: string;
  cc: MailAddress[];
  replyTo: MailAddress[];
  tooLarge: boolean;
  html: string | null;
  text: string | null;
  attachments: MailPartInfo[];
}

export interface OriginalAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailPartDownload {
  buffer: Buffer;
  filename: string;
  messageId?: string;
  subject: string;
  from: string;
}

const addresses = (list?: MessageAddressObject[]): MailAddress[] =>
  (list ?? []).map((a) => ({
    name: a.name || undefined,
    address: a.address || undefined,
  }));

const isoDate = (d?: Date | string): string | null => {
  if (!d) {
    return null;
  }
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function summarize(msg: FetchMessageObject): MailSummary {
  const env = msg.envelope ?? {};
  return {
    uid: msg.uid,
    from: addresses(env.from),
    to: addresses(env.to),
    subject: env.subject || "(sin asunto)",
    date: isoDate(env.date ?? msg.internalDate),
    seen: msg.flags?.has("\\Seen") ?? false,
    hasAttachments: hasRealAttachments(msg.bodyStructure),
    size: msg.size ?? 0,
  };
}

export function toFolders(list: ListResponse[]): MailFolder[] {
  return list
    .filter((f) => !f.flags.has("\\Noselect") && !f.flags.has("\\NonExistent"))
    .map((f) => {
      const special =
        f.path.toUpperCase() === "INBOX" ? "\\Inbox" : f.specialUse;
      return {
        path: f.path,
        name: (special && SPECIAL_USE[special]?.label) || f.name,
        specialUse: special || undefined,
      };
    })
    .sort((a, b) => {
      const oa = SPECIAL_USE[a.specialUse ?? ""]?.order ?? 99;
      const ob = SPECIAL_USE[b.specialUse ?? ""]?.order ?? 99;
      return oa - ob || a.name.localeCompare(b.name, "es");
    });
}

/** Lista de UIDs (desc) → página de 50 anteriores a `beforeUid`. */
export function pageUids(
  uids: number[],
  beforeUid?: number,
): { page: number[]; nextBeforeUid: number | null } {
  const sorted = [...uids].sort((a, b) => b - a);
  const filtered = beforeUid ? sorted.filter((u) => u < beforeUid) : sorted;
  const page = filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;
  return { page, nextBeforeUid: hasMore ? page[page.length - 1] : null };
}

@Injectable()
export class CorreoMailboxService {
  private readonly folderCache = new Map<
    string,
    { at: number; data: MailFolder[] }
  >();
  private readonly firstPageCache = new Map<
    string,
    { at: number; data: MailListPage }
  >();

  constructor(private readonly imap: ImapClientService) {}

  /** Tras cambiar credenciales: olvidar lo cacheado del buzón anterior. */
  clearCache(tenantId: string): void {
    this.folderCache.delete(tenantId);
    for (const key of this.firstPageCache.keys()) {
      if (key.startsWith(`${tenantId}\u0000`)) {
        this.firstPageCache.delete(key);
      }
    }
  }

  /** "Probar conexión": login + abrir INBOX en solo lectura. */
  async testConnection(
    tenantId: string,
  ): Promise<{ ok: true; folders: number }> {
    return this.imap.withClient(tenantId, async (client) => {
      const folders = await this.foldersVia(client, tenantId, true);
      const lock = await client.getMailboxLock("INBOX", { readOnly: true });
      lock.release();
      return { ok: true as const, folders: folders.length };
    });
  }

  async listFolders(tenantId: string, fresh = false): Promise<MailFolder[]> {
    const cached = this.folderCache.get(tenantId);
    if (!fresh && cached && Date.now() - cached.at < CACHE_MS) {
      return cached.data;
    }
    return this.imap.withClient(tenantId, (client) =>
      this.foldersVia(client, tenantId, true),
    );
  }

  async listMessages(
    tenantId: string,
    folder: string,
    opts: { beforeUid?: number; uidValidity?: string; fresh?: boolean } = {},
  ): Promise<MailListPage> {
    const cacheKey = `${tenantId}\u0000${folder}`;
    const isFirstPage = !opts.beforeUid;
    if (isFirstPage && !opts.fresh) {
      const cached = this.firstPageCache.get(cacheKey);
      if (cached && Date.now() - cached.at < CACHE_MS) {
        return cached.data;
      }
    }

    const data = await this.imap.withClient(tenantId, async (client) => {
      await this.assertFolder(client, tenantId, folder, opts.fresh);
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const uidValidity = this.currentUidValidity(client);
        if (
          opts.beforeUid &&
          opts.uidValidity &&
          opts.uidValidity !== uidValidity
        ) {
          throw new ConflictException(MAILBOX_CHANGED);
        }
        const uids = (await client.search({ all: true }, { uid: true })) || [];
        const { page, nextBeforeUid } = pageUids(uids, opts.beforeUid);
        const messages: MailSummary[] = [];
        if (page.length > 0) {
          for await (const msg of client.fetch(
            page.join(","),
            {
              uid: true,
              envelope: true,
              flags: true,
              bodyStructure: true,
              size: true,
            },
            { uid: true },
          )) {
            messages.push(summarize(msg));
          }
        }
        messages.sort((a, b) => b.uid - a.uid);
        return { uidValidity, messages, nextBeforeUid };
      } finally {
        lock.release();
      }
    });

    if (isFirstPage) {
      this.firstPageCache.set(cacheKey, { at: Date.now(), data });
    }
    return data;
  }

  async getMessage(
    tenantId: string,
    folder: string,
    uid: number,
    uidValidity: string,
  ): Promise<MailDetail> {
    return this.imap.withClient(tenantId, async (client) => {
      await this.assertFolder(client, tenantId, folder);
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        this.assertUidValidity(client, uidValidity);
        const meta = await client.fetchOne(
          String(uid),
          {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
            size: true,
          },
          { uid: true },
        );
        if (!meta) {
          throw new NotFoundException("El correo ya no existe en el buzón.");
        }

        const summary = summarize(meta);
        const env = meta.envelope ?? {};
        const base: MailDetail = {
          ...summary,
          folder,
          uidValidity,
          messageId: env.messageId || undefined,
          cc: addresses(env.cc),
          replyTo: addresses(env.replyTo),
          tooLarge: (meta.size ?? 0) > MAX_MESSAGE_BYTES,
          html: null,
          text: null,
          attachments: collectMailParts(meta.bodyStructure),
        };
        // Mensaje enorme: solo cabeceras y lista de adjuntos, sin bajar el cuerpo
        if (base.tooLarge) {
          return base;
        }

        const full = await client.fetchOne(
          String(uid),
          { uid: true, source: true },
          { uid: true },
        );
        if (!full || !full.source) {
          return base;
        }
        const parsed = await simpleParser(full.source, {
          skipImageLinks: true,
        });

        const cidImages: CidImageMap = new Map();
        let inlineBytes = 0;
        for (const att of parsed.attachments ?? []) {
          const cid = att.contentId?.replace(/^<|>$/g, "");
          if (!cid || !SAFE_INLINE_IMAGE.test(att.contentType)) {
            continue;
          }
          inlineBytes += att.size;
          if (inlineBytes > MAX_INLINE_IMAGES_BYTES) {
            break;
          }
          cidImages.set(
            cid,
            `data:${att.contentType};base64,${att.content.toString("base64")}`,
          );
        }

        base.html =
          typeof parsed.html === "string"
            ? sanitizeMailHtml(parsed.html, cidImages)
            : null;
        base.text = parsed.text ?? null;
        return base;
      } finally {
        lock.release();
      }
    });
  }

  async downloadPart(
    tenantId: string,
    folder: string,
    uid: number,
    part: string,
    uidValidity: string,
  ): Promise<MailPartDownload> {
    return this.imap.withClient(tenantId, async (client) => {
      await this.assertFolder(client, tenantId, folder);
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        this.assertUidValidity(client, uidValidity);
        const meta = await client.fetchOne(
          String(uid),
          { uid: true, envelope: true, bodyStructure: true },
          { uid: true },
        );
        if (!meta) {
          throw new NotFoundException("El correo ya no existe en el buzón.");
        }
        const info = findMailPart(meta.bodyStructure, part);
        if (!info) {
          throw new NotFoundException("El adjunto no existe.");
        }
        if (info.size > MAX_ENCODED_PART_BYTES) {
          throw new PayloadTooLargeException(
            "Adjunto demasiado grande para abrirlo desde ChefChek: descárgalo desde el webmail.",
          );
        }

        const dl = await client.download(String(uid), part, {
          uid: true,
          maxBytes: MAX_MESSAGE_BYTES + 1,
        });
        if (!("content" in dl) || !dl.content) {
          throw new NotFoundException("El adjunto no existe.");
        }
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of dl.content) {
          total += chunk.length;
          if (total > MAX_MESSAGE_BYTES) {
            dl.content.destroy();
            throw new PayloadTooLargeException(
              "Adjunto demasiado grande para abrirlo desde ChefChek: descárgalo desde el webmail.",
            );
          }
          chunks.push(chunk);
        }

        const env = meta.envelope ?? {};
        return {
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          messageId: env.messageId || undefined,
          subject: env.subject || "(sin asunto)",
          from: env.from?.[0]?.address || env.from?.[0]?.name || "",
        };
      } finally {
        lock.release();
      }
    });
  }

  /**
   * Original de una respuesta o reenvío: cabeceras de hilo, texto para citar y,
   * al reenviar, sus adjuntos. Como el detalle, no baja mensajes > 15 MB.
   */
  async getOriginalForReply(
    tenantId: string,
    ref: { folder: string; uid: number; uidValidity: string },
    withAttachments: boolean,
  ): Promise<{
    original: OriginalForReply;
    attachments: OriginalAttachment[];
  }> {
    return this.imap.withClient(tenantId, async (client) => {
      await this.assertFolder(client, tenantId, ref.folder);
      const lock = await client.getMailboxLock(ref.folder, { readOnly: true });
      try {
        this.assertUidValidity(client, ref.uidValidity);
        const meta = await client.fetchOne(
          String(ref.uid),
          { uid: true, size: true },
          { uid: true },
        );
        if (!meta) {
          throw new NotFoundException(
            "El correo original ya no existe en el buzón.",
          );
        }
        if ((meta.size ?? 0) > MAX_MESSAGE_BYTES) {
          throw new PayloadTooLargeException(
            "El correo original es demasiado grande para responderlo o reenviarlo desde ChefChek.",
          );
        }
        const full = await client.fetchOne(
          String(ref.uid),
          { uid: true, source: true },
          { uid: true },
        );
        if (!full || !full.source) {
          throw new NotFoundException(
            "El correo original ya no existe en el buzón.",
          );
        }
        const parsed = await simpleParser(full.source);
        const refs = parsed.references;
        const html =
          typeof parsed.html === "string"
            ? // Para el destinatario: sin scripts, pero con sus imágenes originales
              sanitizeMailHtml(parsed.html).replace(
                /data-blocked-src=/g,
                "src=",
              )
            : null;
        return {
          original: {
            messageId: parsed.messageId || undefined,
            references: Array.isArray(refs) ? refs : refs ? [refs] : [],
            subject: parsed.subject || "(sin asunto)",
            from: parsed.from?.text ?? "",
            to: [parsed.to]
              .flat()
              .filter(Boolean)
              .map((a: any) => a.text)
              .join(", "),
            cc: [parsed.cc]
              .flat()
              .filter(Boolean)
              .map((a: any) => a.text)
              .join(", "),
            date: parsed.date ?? null,
            text: parsed.text ?? "",
            html,
          },
          attachments: withAttachments
            ? (parsed.attachments ?? [])
                .filter(
                  (a) => a.contentDisposition !== "inline" || !a.contentId,
                )
                .map((a) => ({
                  filename: a.filename || "adjunto",
                  content: a.content,
                  contentType: a.contentType,
                }))
            : [],
        };
      } finally {
        lock.release();
      }
    });
  }

  /** Copia del correo enviado en «Enviados» (Hostinger no la guarda solo). */
  async appendToSent(tenantId: string, raw: Buffer): Promise<boolean> {
    return this.imap.withClient(tenantId, async (client) => {
      const folders = await this.foldersVia(client, tenantId);
      const sent =
        folders.find((f) => f.specialUse === "\\Sent") ??
        folders.find((f) => /(^|[./])(sent|enviados?)$/i.test(f.path));
      if (!sent) {
        return false;
      }
      await client.append(sent.path, raw, ["\\Seen"]);
      this.firstPageCache.delete(`${tenantId}\u0000${sent.path}`);
      return true;
    });
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private async foldersVia(
    client: ImapFlow,
    tenantId: string,
    fresh = false,
  ): Promise<MailFolder[]> {
    const cached = this.folderCache.get(tenantId);
    if (!fresh && cached && Date.now() - cached.at < CACHE_MS) {
      return cached.data;
    }
    const data = toFolders(await client.list());
    this.folderCache.set(tenantId, { at: Date.now(), data });
    return data;
  }

  /** Solo se abren carpetas que el servidor ha listado (nunca una ruta inventada). */
  private async assertFolder(
    client: ImapFlow,
    tenantId: string,
    folder: string,
    fresh = false,
  ) {
    if (!folder) {
      throw new BadRequestException("Falta la carpeta.");
    }
    const folders = await this.foldersVia(client, tenantId, fresh);
    if (!folders.some((f) => f.path === folder)) {
      throw new NotFoundException("La carpeta no existe en el buzón.");
    }
  }

  private currentUidValidity(client: ImapFlow): string {
    const mailbox = client.mailbox;
    return mailbox ? String(mailbox.uidValidity) : "";
  }

  private assertUidValidity(client: ImapFlow, expected: string): void {
    if (!expected || this.currentUidValidity(client) !== expected) {
      throw new ConflictException(MAILBOX_CHANGED);
    }
  }
}
