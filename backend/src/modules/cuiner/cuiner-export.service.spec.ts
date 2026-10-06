import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CuinerExportService } from "./cuiner-export.service";

const config = {
  tenantId: "t1",
  enabled: true,
  mode: "DRY_RUN",
  empresa: "01",
  centro: "02",
  almacen: "01",
  actUsuario: "3",
};

const albaranLine = (over: Record<string, unknown> = {}) => ({
  description: "MAYONESA INMACULADA 3,6KG",
  quantity: 1,
  unitPrice: 8.422,
  totalPrice: 7.58,
  vatPercent: 10,
  lot: null,
  lineStatus: "CONFIRMADO",
  matchedProductId: "p1",
  ...over,
});

const albaran = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  tenantId: "t1",
  status: "CONFIRMADO",
  supplierId: "s1",
  supplier: { name: "Proveedor 9" },
  date: new Date("2026-10-05T00:00:00.000Z"),
  albaranNumber: "PRUEBA-CHEFCHEK",
  lines: [albaranLine()],
  ...over,
});

function makePrisma(state: {
  config?: unknown;
  albaran?: unknown;
  supplierMap?: unknown;
  productMaps?: unknown[];
  articles?: unknown[];
  existingExport?: unknown;
}) {
  return {
    cuinerConfig: { findUnique: jest.fn(async () => state.config ?? null) },
    albaran: { findFirst: jest.fn(async () => state.albaran ?? null) },
    cuinerSupplierMap: {
      findUnique: jest.fn(async () => state.supplierMap ?? null),
    },
    cuinerProductMap: {
      findMany: jest.fn(async () => state.productMaps ?? []),
    },
    cuinerArticle: { findMany: jest.fn(async () => state.articles ?? []) },
    cuinerAlbaranExport: {
      findUnique: jest.fn(async () => state.existingExport ?? null),
      upsert: jest.fn(async (args: { create: unknown }) => args.create),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
}

const fullyMapped = {
  config,
  albaran: albaran(),
  supplierMap: { codigo: "00009" },
  productMaps: [{ productId: "p1", articulo: "05080005" }],
  articles: [{ codigo: "05080005", medida: 3.6 }],
};

const serviceWith = (prisma: ReturnType<typeof makePrisma>) =>
  new CuinerExportService(prisma as unknown as PrismaService);

describe("CuinerExportService.preview", () => {
  it("calcula el payload cuando todo está enlazado", async () => {
    const { problems, payload } = await serviceWith(
      makePrisma(fullyMapped),
    ).preview("t1", "a1");
    expect(problems).toEqual([]);
    expect(payload).toMatchObject({
      codigo: "00009",
      centro: "02",
      actUsuario: "3",
      notas: "CHEFCHEK:a1",
      total: 8.34,
    });
    expect(payload?.lineas[0]).toMatchObject({
      articulo: "05080005",
      costeUM: 2.1055,
    });
  });

  it("lista todo lo que impide el envío sin calcular payload", async () => {
    const prisma = makePrisma({
      config: { ...config, enabled: false },
      albaran: albaran({
        status: "REVISADO",
        lines: [
          albaranLine({ matchedProductId: null, description: "SIN VINCULAR" }),
          albaranLine({
            matchedProductId: "p2",
            description: "SIN ENLACE",
            vatPercent: 8,
          }),
        ],
      }),
    });
    const { problems, payload } = await serviceWith(prisma).preview("t1", "a1");
    expect(payload).toBeNull();
    expect(problems).toEqual([
      "El conector de Cuiner está desactivado",
      "Solo se pueden enviar albaranes confirmados",
      "El proveedor «Proveedor 9» no está enlazado con Cuiner",
      "La línea «SIN VINCULAR» no está vinculada a un artículo",
      "El artículo de la línea «SIN ENLACE» no está enlazado con Cuiner",
      "IVA 8% de «SIN ENLACE» no existe en Cuiner",
    ]);
  });

  it("ignora las líneas rechazadas", async () => {
    const prisma = makePrisma({
      ...fullyMapped,
      albaran: albaran({
        lines: [
          albaranLine(),
          albaranLine({ lineStatus: "RECHAZADO", matchedProductId: null }),
        ],
      }),
    });
    const { problems, payload } = await serviceWith(prisma).preview("t1", "a1");
    expect(problems).toEqual([]);
    expect(payload?.lineas).toHaveLength(1);
  });

  it("bloquea el envío si el total no cuadra con el del albarán (IVA mal leído)", async () => {
    // Caso real: verdura al 4 % leída por el OCR como 10 %.
    const prisma = makePrisma({
      ...fullyMapped,
      albaran: albaran({
        total: 164.84,
        lines: [
          albaranLine({ quantity: 1, unitPrice: 158.5, totalPrice: 158.5 }),
        ],
      }),
    });
    const { problems, payload } = await serviceWith(prisma).preview("t1", "a1");
    expect(payload).toBeNull();
    expect(problems).toEqual([
      "El total calculado (174,35 €) no cuadra con el total del albarán (164,84 €): revisa el IVA y los importes de las líneas",
    ]);
  });

  it("admite diferencias de redondeo de hasta 5 céntimos", async () => {
    const prisma = makePrisma({
      ...fullyMapped,
      albaran: albaran({ total: 8.37 }),
    });
    const { problems, payload } = await serviceWith(prisma).preview("t1", "a1");
    expect(problems).toEqual([]);
    expect(payload?.total).toBe(8.34);
  });

  it("avisa si el conector no está configurado", async () => {
    const prisma = makePrisma({ albaran: albaran() });
    const { problems } = await serviceWith(prisma).preview("t1", "a1");
    expect(problems).toEqual(["El conector de Cuiner no está configurado"]);
  });
});

describe("CuinerExportService.requestSend", () => {
  it("encola en PENDIENTE con el payload congelado", async () => {
    const prisma = makePrisma(fullyMapped);
    const result = (await serviceWith(prisma).requestSend(
      "t1",
      "a1",
      "u1",
    )) as unknown as {
      status: string;
      payload: { total: number };
      requestedBy: string;
    };
    expect(result.status).toBe("PENDIENTE");
    expect(result.payload.total).toBe(8.34);
    expect(result.requestedBy).toBe("u1");
  });

  it("no reenvía un albarán que ya está en Cuiner", async () => {
    const prisma = makePrisma({
      ...fullyMapped,
      existingExport: {
        tenantId: "t1",
        status: "ENVIADO",
        cuinerIdDocsCab: 21400,
      },
    });
    await expect(
      serviceWith(prisma).requestSend("t1", "a1", "u1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cuinerAlbaranExport.upsert).not.toHaveBeenCalled();
  });

  it("rechaza con la lista de problemas si falta algo", async () => {
    const prisma = makePrisma({ ...fullyMapped, supplierMap: null });
    await expect(
      serviceWith(prisma).requestSend("t1", "a1", "u1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cuinerAlbaranExport.upsert).not.toHaveBeenCalled();
  });
});

describe("CuinerExportService.recordResult", () => {
  it("solo transiciona desde PENDIENTE", async () => {
    const prisma = makePrisma({});
    await serviceWith(prisma).recordResult("t1", "e1", {
      ok: true,
      simulated: false,
      idDocsCab: 21400,
    });
    expect(prisma.cuinerAlbaranExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1", tenantId: "t1", status: "PENDIENTE" },
        data: expect.objectContaining({
          status: "ENVIADO",
          cuinerIdDocsCab: 21400,
        }),
      }),
    );
  });

  it("marca SIMULADO sin guardar id de Cuiner", async () => {
    const prisma = makePrisma({});
    const result = await serviceWith(prisma).recordResult("t1", "e1", {
      ok: true,
      simulated: true,
      idDocsCab: 999,
    });
    expect(result.status).toBe("SIMULADO");
    expect(prisma.cuinerAlbaranExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cuinerIdDocsCab: null }),
      }),
    );
  });

  it("registra el error del conector", async () => {
    const prisma = makePrisma({});
    const result = await serviceWith(prisma).recordResult("t1", "e1", {
      ok: false,
      simulated: false,
      error: "timeout",
    });
    expect(result.status).toBe("ERROR");
  });

  it("exige Id_DocsCab en un envío real correcto", async () => {
    await expect(
      serviceWith(makePrisma({})).recordResult("t1", "e1", {
        ok: true,
        simulated: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("falla si el envío ya no está pendiente (resultado tardío o repetido)", async () => {
    const prisma = makePrisma({});
    prisma.cuinerAlbaranExport.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      serviceWith(prisma).recordResult("t1", "e1", {
        ok: true,
        simulated: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
