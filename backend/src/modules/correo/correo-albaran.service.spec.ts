import { BadRequestException } from "@nestjs/common";
import {
  albaranFileType,
  CorreoAlbaranService,
  nameKey,
  senderMatchesSupplier,
  senderMatchesSupplierName,
} from "./correo-albaran.service";

const pdf = Buffer.from("%PDF-1.7\n...");

function setup(orders: any[] = [], fileBuffer = pdf) {
  const prisma: any = {
    purchaseOrder: { findMany: jest.fn().mockResolvedValue(orders) },
  };
  const mailbox: any = {
    downloadPart: jest.fn().mockResolvedValue({
      buffer: fileBuffer,
      filename: "FRA 123.pdf",
      contentType: "application/octet-stream",
      subject: "FRA. BODEGAS VILLENA",
      from: "bv@bodegasvillena.es",
    }),
  };
  const albaranes: any = {
    createFromUpload: jest.fn().mockResolvedValue({ id: "alb-1" }),
  };
  return {
    service: new CorreoAlbaranService(prisma, mailbox, albaranes),
    prisma,
    mailbox,
    albaranes,
  };
}

const order = (id: string, email: string | null) => ({
  id,
  orderNumber: `PED-${id}`,
  status: "ENVIADO",
  sentAt: new Date("2026-11-01T10:00:00Z"),
  createdAt: new Date("2026-11-01T09:00:00Z"),
  expectedTotal: 100,
  supplier: { name: `Prov ${id}`, email },
});

describe("senderMatchesSupplier", () => {
  it.each([
    ["bv@bodegasvillena.es", "pedidos@bodegasvillena.es", true],
    ["BV@BodegasVillena.es", "bv@bodegasvillena.es", true],
    ["ana@gmail.com", "pepe@gmail.com", false],
    ["ana@gmail.com", "ana@gmail.com", true],
    ["bv@bodegasvillena.es", null, false],
    ["bv@bodegasvillena.es", "otro@seur.es", false],
  ])("%s vs %s → %s", (from, sup, expected) =>
    expect(senderMatchesSupplier(from, sup)).toBe(expected),
  );
});

describe("senderMatchesSupplierName (proveedor sin email)", () => {
  it("quita tildes, signos y forma jurídica", () => {
    expect(nameKey("Bodegas Villena, S.L.")).toBe("bodegasvillena");
    expect(nameKey("BARDISA Y CIA, S.L.")).toBe("bardisaycia");
  });

  it.each([
    [{ address: "bv@bodegasvillena.es" }, "Bodegas Villena", true],
    [
      { address: "x@bardisa.com", name: "bardisa" },
      "Bardisa y Cía, S.L.",
      true,
    ],
    [{ address: "x@gmail.com", name: "Juan" }, "Bodegas Villena", false],
    [{ address: "info@seur.es" }, "Carnes Soria", false],
    [{ address: "a@sa.es" }, "SA", false],
  ])("%j vs %s → %s", (sender, supplier, expected) =>
    expect(senderMatchesSupplierName(sender, supplier)).toBe(expected),
  );
});

describe("albaranFileType", () => {
  it("reconoce PDF e imágenes por sus bytes, no por el nombre", () => {
    expect(albaranFileType(pdf)).toBe("application/pdf");
    expect(albaranFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(
      albaranFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBe("image/png");
    expect(albaranFileType(Buffer.from("<html>"))).toBeNull();
  });
});

describe("CorreoAlbaranService", () => {
  it("pedidos abiertos: primero los del proveedor que envía el correo", async () => {
    const { service, prisma } = setup([
      order("1", "otro@seur.es"),
      order("2", "pedidos@bodegasvillena.es"),
    ]);
    const list = await service.openOrders("t1", {
      address: "bv@bodegasvillena.es",
    });
    expect(list.map((o) => [o.id, o.fromSender])).toEqual([
      ["2", true],
      ["1", false],
    ]);
    expect(prisma.purchaseOrder.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t1",
      status: { in: ["ENVIADO", "RECIBIDO_PARCIAL"] },
    });
  });

  it("crea el albarán con el adjunto como PDF aunque venga como octet-stream", async () => {
    const { service, albaranes } = setup();
    const res = await service.createFromAttachment("t1", {
      folder: "INBOX",
      uid: 5,
      uidValidity: "777",
      part: "2",
      purchaseOrderId: "po-1",
    });
    expect(res.albaranId).toBe("alb-1");
    const [files, tenantId, model, key, po] =
      albaranes.createFromUpload.mock.calls[0];
    expect(files[0]).toMatchObject({
      originalname: "FRA 123.pdf",
      mimetype: "application/pdf",
      size: pdf.length,
    });
    expect([tenantId, model, key, po]).toEqual([
      "t1",
      undefined,
      undefined,
      "po-1",
    ]);
  });

  it("un adjunto que no es PDF ni imagen → 400 sin llamar a la IA", async () => {
    const { service, albaranes } = setup([], Buffer.from("PK\u0003\u0004zip"));
    await expect(
      service.createFromAttachment("t1", {
        folder: "INBOX",
        uid: 5,
        uidValidity: "777",
        part: "2",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(albaranes.createFromUpload).not.toHaveBeenCalled();
  });
});
