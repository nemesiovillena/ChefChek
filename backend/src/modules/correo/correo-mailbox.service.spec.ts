import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  CorreoMailboxService,
  MAX_MESSAGE_BYTES,
  PAGE_SIZE,
  pageUids,
  toFolders,
} from "./correo-mailbox.service";
import { attachmentDisposition } from "./correo.controller";
import { collectMailParts } from "./mail-body-structure";

const tenantId = "tenant-1";

/** Cliente IMAP simulado: sin métodos de escritura (messageFlagsAdd, store…). */
function fakeClient(
  opts: {
    uids?: number[];
    size?: number;
    source?: Buffer;
    uidValidity?: bigint;
  } = {},
) {
  const client: any = {
    mailbox: { uidValidity: opts.uidValidity ?? 777n },
    list: jest.fn().mockResolvedValue([
      { path: "INBOX", name: "INBOX", flags: new Set(), specialUse: "\\Inbox" },
      {
        path: "INBOX.Sent",
        name: "Sent",
        flags: new Set(),
        specialUse: "\\Sent",
      },
    ]),
    getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
    search: jest.fn().mockResolvedValue(opts.uids ?? []),
    fetch: jest.fn((range: string) =>
      (async function* () {
        for (const uid of range.split(",").map(Number)) {
          yield {
            uid,
            envelope: { subject: `m${uid}` },
            flags: new Set(["\\Seen"]),
            size: 10,
          };
        }
      })(),
    ),
    fetchOne: jest.fn(async (_uid: string, query: any) =>
      query.source
        ? { uid: 1, source: opts.source }
        : {
            uid: 1,
            size: opts.size ?? 100,
            envelope: {
              subject: "Pedido",
              from: [{ name: "Ana", address: "ana@prov.es" }],
            },
            flags: new Set(),
            bodyStructure: {
              type: "multipart/mixed",
              childNodes: [
                { part: "1", type: "text/html" },
                {
                  part: "2",
                  type: "application/pdf",
                  disposition: "attachment",
                  dispositionParameters: { filename: "Albarán_peña.pdf" },
                  size: 1000,
                },
              ],
            },
          },
    ),
  };
  return client;
}

function serviceWith(client: any) {
  const imap: any = {
    withClient: jest.fn((_t: string, fn: any) => fn(client)),
    resetBreaker: jest.fn(),
  };
  return { service: new CorreoMailboxService(imap), imap };
}

describe("pageUids (cursor beforeUid)", () => {
  const uids = Array.from({ length: 120 }, (_, i) => i + 1);

  it("primera página: los 50 más nuevos, en orden descendente", () => {
    const { page, nextBeforeUid } = pageUids(uids);
    expect(page).toHaveLength(PAGE_SIZE);
    expect(page[0]).toBe(120);
    expect(nextBeforeUid).toBe(71);
  });

  it("si llegan correos nuevos entre páginas no se duplica ni salta ninguno", () => {
    const first = pageUids(uids);
    const withNew = [...uids, 121, 122, 123];
    const second = pageUids(withNew, first.nextBeforeUid!);
    expect(second.page[0]).toBe(70);
    expect(new Set([...first.page, ...second.page]).size).toBe(100);
  });

  it("última página: sin cursor siguiente", () => {
    expect(pageUids(uids, 21).nextBeforeUid).toBeNull();
  });
});

describe("CorreoMailboxService", () => {
  it("abre los buzones en solo lectura y no modifica flags", async () => {
    const client = fakeClient({ uids: [1, 2, 3] });
    const { service } = serviceWith(client);
    const page = await service.listMessages(tenantId, "INBOX");
    expect(page.messages.map((m) => m.uid)).toEqual([3, 2, 1]);
    expect(page.uidValidity).toBe("777");
    expect(client.getMailboxLock).toHaveBeenCalledWith("INBOX", {
      readOnly: true,
    });
    expect(client.messageFlagsAdd).toBeUndefined();
  });

  it("carpeta que el servidor no lista → 404", async () => {
    const { service } = serviceWith(fakeClient());
    await expect(
      service.listMessages(tenantId, "../../etc"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("la primera página se cachea 30 s; fresh=1 la salta", async () => {
    const client = fakeClient({ uids: [1] });
    const { service, imap } = serviceWith(client);
    await service.listMessages(tenantId, "INBOX");
    await service.listMessages(tenantId, "INBOX");
    expect(imap.withClient).toHaveBeenCalledTimes(1);
    await service.listMessages(tenantId, "INBOX", { fresh: true });
    expect(imap.withClient).toHaveBeenCalledTimes(2);
  });

  it("uidValidity distinta → 409 en detalle y en 'cargar más'", async () => {
    const { service } = serviceWith(
      fakeClient({ uids: [1, 2], uidValidity: 999n }),
    );
    await expect(
      service.getMessage(tenantId, "INBOX", 1, "777"),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.listMessages(tenantId, "INBOX", {
        beforeUid: 2,
        uidValidity: "777",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("mensaje > 15 MB: solo cabeceras y adjuntos, sin bajar el cuerpo", async () => {
    const client = fakeClient({ size: MAX_MESSAGE_BYTES + 1 });
    const { service } = serviceWith(client);
    const detail = await service.getMessage(tenantId, "INBOX", 1, "777");
    expect(detail.tooLarge).toBe(true);
    expect(detail.html).toBeNull();
    expect(detail.attachments.map((a) => a.filename)).toEqual([
      "Albarán_peña.pdf",
    ]);
    expect(client.fetchOne).toHaveBeenCalledTimes(1); // sin la segunda llamada con source
  });

  it("detalle normal: HTML saneado y texto", async () => {
    const source = Buffer.from(
      'From: a@b.es\r\nSubject: Hola\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hola</p><script>x()</script><img src="https://t.es/p.gif">',
    );
    const { service } = serviceWith(fakeClient({ source }));
    const detail = await service.getMessage(tenantId, "INBOX", 1, "777");
    expect(detail.html).toContain("<p>Hola</p>");
    expect(detail.html).not.toContain("script");
    expect(detail.html).toContain("data-blocked-src");
  });
});

describe("estructura MIME y descarga", () => {
  it("lista adjuntos por número de parte y omite el cuerpo de texto", () => {
    const parts = collectMailParts({
      type: "multipart/mixed",
      childNodes: [
        {
          part: "1",
          type: "multipart/alternative",
          childNodes: [
            { part: "1.1", type: "text/plain" },
            { part: "1.2", type: "text/html" },
          ],
        },
        {
          part: "2",
          type: "image/png",
          id: "<logo@x>",
          disposition: "inline",
          size: 10,
        },
        {
          part: "3",
          type: "message/rfc822",
          childNodes: [{ part: "3.1", type: "text/plain" }],
        },
      ],
    } as any);
    expect(parts.map((p) => [p.part, p.inline])).toEqual([
      ["2", true],
      ["3", false],
    ]);
    expect(parts[0].contentId).toBe("logo@x");
  });

  it("cabecera de descarga con ñ y tildes (ASCII + filename*)", () => {
    const h = attachmentDisposition('Albarán_peña "1".pdf');
    expect(h).toContain('filename="Albar_n_pe_a _1_.pdf"');
    expect(h).toContain(
      "filename*=UTF-8''Albar%C3%A1n_pe%C3%B1a%20%221%22.pdf",
    );
    expect(h).toMatch(/^[\x20-\x7e]+$/); // sin caracteres que rompan la cabecera
  });

  it("carpetas: INBOX primero con etiqueta en español", () => {
    const folders = toFolders([
      {
        path: "INBOX.Trash",
        name: "Trash",
        flags: new Set(),
        specialUse: "\\Trash",
      },
      { path: "INBOX", name: "INBOX", flags: new Set() },
      { path: "Raiz", name: "Raiz", flags: new Set(["\\Noselect"]) },
    ] as any);
    expect(folders.map((f) => f.name)).toEqual([
      "Bandeja de entrada",
      "Papelera",
    ]);
  });
});
