import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import {
  CorreoSendService,
  MAX_UPLOAD_BYTES,
  parseRecipients,
} from "./correo-send.service";
import {
  buildBody,
  OriginalForReply,
  threadHeaders,
} from "./mail-reply-builder";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
jest.mock("./imap-host-validator", () => ({
  resolvePublicImapHost: jest.fn().mockResolvedValue("203.0.113.20"),
}));

const tenantId = "tenant-1";
const original: OriginalForReply = {
  messageId: "<orig@prov.es>",
  references: ["<root@prov.es>"],
  subject: "Pedido semana",
  from: "Ana <ana@prov.es>",
  to: "restaurante@warynessy.com",
  cc: "",
  date: new Date("2026-10-30T09:00:00Z"),
  text: "¿Confirmáis?\nGracias",
  html: "<p>¿Confirmáis?</p>",
};

function setup() {
  const sendMail = jest.fn().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({
    sendMail,
    close: jest.fn(),
  });
  const config: any = {
    getSecret: jest.fn().mockResolvedValue({
      host: "imap.hostinger.com",
      port: 993,
      user: "restaurante@warynessy.com",
      pass: "secreta",
      smtpHost: "smtp.hostinger.com",
      smtpPort: 465,
    }),
  };
  const mailbox: any = {
    getOriginalForReply: jest.fn().mockResolvedValue({
      original,
      attachments: [
        {
          filename: "albaran.pdf",
          content: Buffer.from("pdf"),
          contentType: "application/pdf",
        },
      ],
    }),
    appendToSent: jest.fn().mockResolvedValue(true),
  };
  const imap: any = {
    assertBreakerClosed: jest.fn(),
    reportExternalFailure: jest.fn(),
  };
  const prisma: any = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ name: "Warynessy" }) },
  };
  const service = new CorreoSendService(config, mailbox, imap, prisma);
  (service as any).logger = { warn: jest.fn() };
  return { service, sendMail, mailbox, imap };
}

const base = {
  mode: "new" as const,
  to: "ana@prov.es",
  subject: "Hola",
  text: "Buenos días",
};

describe("parseRecipients", () => {
  it("acepta comas, punto y coma y «Nombre <correo>»", () => {
    expect(parseRecipients("Ana <ana@prov.es>; luis@x.es, ", "Para")).toEqual([
      "ana@prov.es",
      "luis@x.es",
    ]);
  });
  it("rechaza direcciones no válidas", () => {
    expect(() => parseRecipients("ana@", "Para")).toThrow(BadRequestException);
  });
});

describe("cuerpo y cabeceras de hilo", () => {
  it("responder: In-Reply-To y References con el hilo previo", () => {
    expect(threadHeaders(original, "reply")).toEqual({
      inReplyTo: "<orig@prov.es>",
      references: "<root@prov.es> <orig@prov.es>",
    });
    expect(threadHeaders(original, "forward")).toEqual({});
  });
  it("responder cita el texto original con «>» y escapa el HTML del usuario", () => {
    const body = buildBody("Sí <b>vale</b>", original, "reply");
    expect(body.text).toContain("> ¿Confirmáis?");
    expect(body.html).toContain("Sí &lt;b&gt;vale&lt;/b&gt;");
    expect(body.html).toContain("<blockquote");
  });
  it("reenviar añade el bloque «Mensaje reenviado»", () => {
    expect(buildBody("", original, "forward").text).toContain(
      "Mensaje reenviado",
    );
  });
});

describe("CorreoSendService.send", () => {
  it("envía por SMTP TLS y guarda el mismo MIME en Enviados", async () => {
    const { service, sendMail, mailbox } = setup();
    const res = await service.send(tenantId, base, []);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "203.0.113.20",
        port: 465,
        secure: true,
        requireTLS: true,
      }),
    );
    const { envelope, raw } = sendMail.mock.calls[0][0];
    expect(envelope).toEqual({
      from: "restaurante@warynessy.com",
      to: ["ana@prov.es"],
    });
    expect(mailbox.appendToSent).toHaveBeenCalledWith(tenantId, raw);
    expect(res.savedToSent).toBe(true);
  });

  it("responder lleva In-Reply-To en el MIME", async () => {
    const { service, sendMail } = setup();
    await service.send(
      tenantId,
      {
        ...base,
        mode: "reply",
        subject: "Re: Pedido semana",
        refFolder: "INBOX",
        refUid: 4,
        refUidValidity: "7",
      },
      [],
    );
    const raw: string = sendMail.mock.calls[0][0].raw.toString();
    expect(raw).toMatch(/In-Reply-To: <orig@prov\.es>/i);
  });

  it("reenviar incluye los adjuntos del original", async () => {
    const { service, sendMail, mailbox } = setup();
    await service.send(
      tenantId,
      {
        ...base,
        mode: "forward",
        refFolder: "INBOX",
        refUid: 4,
        refUidValidity: "7",
      },
      [],
    );
    expect(mailbox.getOriginalForReply).toHaveBeenCalledWith(
      tenantId,
      expect.anything(),
      true,
    );
    expect(sendMail.mock.calls[0][0].raw.toString()).toContain("albaran.pdf");
  });

  it("adjunto con tildes: corrige el nombre que multer entrega en latin1", async () => {
    const { service, sendMail } = setup();
    const file = {
      originalname: Buffer.from("Menú otoño.pdf", "utf8").toString("latin1"),
      mimetype: "application/pdf",
      size: 3,
      buffer: Buffer.from("pdf"),
    };
    await service.send(tenantId, base, [file]);
    const parsed = await simpleParser(sendMail.mock.calls[0][0].raw);
    expect(parsed.attachments.map((a) => a.filename)).toEqual([
      "Menú otoño.pdf",
    ]);
  });

  it("adjuntos > 10 MB → 413 sin enviar", async () => {
    const { service, sendMail } = setup();
    const big = {
      originalname: "a.pdf",
      mimetype: "application/pdf",
      size: MAX_UPLOAD_BYTES + 1,
      buffer: Buffer.alloc(1),
    };
    await expect(service.send(tenantId, base, [big])).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("fallo de login SMTP → 400 genérico y cuenta para el breaker", async () => {
    const { service, sendMail, imap } = setup();
    sendMail.mockRejectedValue(
      Object.assign(new Error("535 auth"), { code: "EAUTH" }),
    );
    const err: any = await service.send(tenantId, base, []).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify(err.getResponse())).not.toContain("secreta");
    expect(imap.reportExternalFailure).toHaveBeenCalledWith(tenantId);
  });

  it("si falla la copia en Enviados el envío cuenta como hecho", async () => {
    const { service, mailbox } = setup();
    mailbox.appendToSent.mockRejectedValue(new Error("imap caído"));
    await expect(service.send(tenantId, base, [])).resolves.toMatchObject({
      savedToSent: false,
    });
  });
});
