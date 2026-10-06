import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AssistantCompletionError } from "../ai-assistant/assistant-completion.service";
import { RecipeCaptureService } from "./recipe-capture.service";
import { RecipeStructuringError } from "./recipe-structuring.service";
import * as fetcher from "./source/safe-page-fetcher";

jest.mock("./source/safe-page-fetcher", () => ({
  ...jest.requireActual("./source/safe-page-fetcher"),
  fetchPublicPage: jest.fn(),
}));

const recipe = {
  name: "Tarta",
  description: null,
  portions: 8,
  preparationTimeMinutes: 15,
  cookingTimeMinutes: 40,
  steps: [
    { description: "Hornear", equipment: null, time: null, temperature: null },
  ],
  ingredients: [
    {
      rawText: "500 g queso",
      name: "queso crema",
      quantity: 500,
      unit: "g",
      note: null,
    },
    { rawText: "sal", name: "sal", quantity: null, unit: null, note: null },
  ],
};

describe("RecipeCaptureService", () => {
  const prisma = {
    recipeCapture: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    recipeCaptureIngredient: {
      findFirst: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    product: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const completion = { assertConfigured: jest.fn() };
  const structuring = { structure: jest.fn() };
  const matcher = { match: jest.fn() };
  let service: RecipeCaptureService;

  /** Espera a que termine el trabajo en segundo plano lanzado por create. */
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
    prisma.recipeCapture.updateMany.mockResolvedValue({ count: 1 });
    prisma.recipeCapture.count.mockResolvedValue(0);
    prisma.recipeCapture.create.mockResolvedValue({
      id: "c1",
      status: "PROCESANDO",
    });
    matcher.match.mockResolvedValue(null);
    service = new RecipeCaptureService(
      prisma as any,
      completion as any,
      structuring as any,
      matcher as any,
    );
    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
  });

  describe("sin tenant", () => {
    // Un SUPERADMIN llega sin tenantId; Prisma ignoraría el filtro.
    it.each([
      ["findAll", () => service.findAll(undefined as any)],
      ["findOne", () => service.findOne(undefined as any, "c1")],
      ["createFromUrl", () => service.createFromUrl("", "u1", "https://x.es")],
      [
        "updateIngredient",
        () => service.updateIngredient("", "c1", "i1", null),
      ],
      ["discard", () => service.discard(undefined as any, "c1")],
    ])("%s falla sin consultar nada", async (_name, call) => {
      await expect(call()).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.recipeCapture.findMany).not.toHaveBeenCalled();
      expect(prisma.recipeCapture.findFirst).not.toHaveBeenCalled();
      expect(prisma.recipeCapture.updateMany).not.toHaveBeenCalled();
      expect(completion.assertConfigured).not.toHaveBeenCalled();
    });
  });

  describe("lectura", () => {
    it("lista solo las capturas del tenant que no están descartadas", async () => {
      prisma.recipeCapture.findMany.mockResolvedValue([]);

      await service.findAll("t1");

      expect(prisma.recipeCapture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "t1", status: { not: "DESCARTADA" } },
        }),
      );
    });

    it("al listar cierra como error las que llevan más de 10 min procesando", async () => {
      prisma.recipeCapture.findMany.mockResolvedValue([]);

      await service.findAll("t1");

      const stale = prisma.recipeCapture.updateMany.mock.calls[0][0];
      expect(stale.where).toMatchObject({
        tenantId: "t1",
        status: "PROCESANDO",
      });
      expect(
        Date.now() - stale.where.createdAt.lt.getTime(),
      ).toBeGreaterThanOrEqual(10 * 60 * 1000);
      expect(stale.data).toEqual({
        status: "ERROR",
        errorMessage: "Se interrumpió, vuelve a intentarlo",
      });
    });

    it("no devuelve capturas de otro tenant ni descartadas", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(null);

      await expect(service.findOne("t1", "c1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.recipeCapture.findFirst.mock.calls[0][0].where).toEqual({
        id: "c1",
        tenantId: "t1",
        status: { not: "DESCARTADA" },
      });
    });
  });

  describe("alta", () => {
    it("sin IA configurada no crea ninguna captura", async () => {
      completion.assertConfigured.mockRejectedValue(
        new BadRequestException("Configura el proveedor de IA"),
      );

      await expect(
        service.createFromText("t1", "u1", "texto de receta"),
      ).rejects.toThrow("Configura el proveedor de IA");
      expect(prisma.recipeCapture.create).not.toHaveBeenCalled();
    });

    it("rechaza con 429 si el tenant ya tiene 3 capturas procesándose", async () => {
      prisma.recipeCapture.count.mockResolvedValue(3);

      await expect(
        service.createFromText("t1", "u1", "texto de receta"),
      ).rejects.toMatchObject({ status: 429 });
      expect(prisma.recipeCapture.create).not.toHaveBeenCalled();
      expect(structuring.structure).not.toHaveBeenCalled();
    });

    it("rechaza formatos de archivo que la IA no lee", async () => {
      await expect(
        service.createFromFile("t1", "u1", {
          buffer: Buffer.from("x"),
          filename: "foto.heic",
          mimetype: "image/heic",
        }),
      ).rejects.toThrow("JPG o PNG");
      expect(prisma.recipeCapture.create).not.toHaveBeenCalled();
    });

    it("guarda el texto pegado y responde al instante en PROCESANDO", async () => {
      structuring.structure.mockReturnValue(new Promise(() => {}));

      const result = await service.createFromText(
        "t1",
        "u1",
        "texto de receta",
      );

      expect(result).toEqual({ id: "c1", status: "PROCESANDO" });
      expect(prisma.recipeCapture.create.mock.calls[0][0].data).toEqual({
        source: "TEXTO",
        sourceText: "texto de receta",
        tenantId: "t1",
        createdBy: "u1",
      });
    });
  });

  describe("proceso en segundo plano", () => {
    it("URL: descarga, extrae, estructura y deja la captura PENDIENTE con sugerencias", async () => {
      (fetcher.fetchPublicPage as jest.Mock).mockResolvedValue(
        "<html><body><p>500 g queso</p></body></html>",
      );
      structuring.structure.mockResolvedValue(recipe);
      matcher.match
        .mockResolvedValueOnce({ productId: "p1", confidence: 1 })
        .mockResolvedValueOnce(null);

      await service.createFromUrl("t1", "u1", "https://recetas.es/tarta");
      await settle();

      expect(fetcher.fetchPublicPage).toHaveBeenCalledWith(
        "https://recetas.es/tarta",
      );
      expect(structuring.structure).toHaveBeenCalledWith("t1", {
        text: expect.stringContaining("500 g queso"),
      });
      const final = prisma.recipeCapture.updateMany.mock.calls.at(-1)[0];
      expect(final.where).toEqual({ id: "c1", status: "PROCESANDO" });
      expect(final.data).toMatchObject({
        status: "PENDIENTE",
        name: "Tarta",
        portions: 8,
        elaboration: JSON.stringify({ steps: recipe.steps }),
      });
      expect(
        prisma.recipeCaptureIngredient.createMany.mock.calls[0][0].data,
      ).toEqual([
        {
          ...recipe.ingredients[0],
          captureId: "c1",
          sortOrder: 0,
          matchedProductId: "p1",
          matchConfidence: 1,
        },
        {
          ...recipe.ingredients[1],
          captureId: "c1",
          sortOrder: 1,
          matchedProductId: null,
          matchConfidence: null,
        },
      ]);
    });

    it("archivo: envía el contenido como adjunto en base64", async () => {
      structuring.structure.mockResolvedValue(recipe);

      await service.createFromFile("t1", "u1", {
        buffer: Buffer.from("pdf"),
        filename: "receta.pdf",
        mimetype: "application/pdf",
      });
      await settle();

      expect(structuring.structure).toHaveBeenCalledWith("t1", {
        attachment: {
          mimeType: "application/pdf",
          dataBase64: Buffer.from("pdf").toString("base64"),
        },
      });
    });

    it("un resultado tardío no pisa una captura que ya no está PROCESANDO", async () => {
      structuring.structure.mockResolvedValue(recipe);
      prisma.recipeCapture.updateMany.mockResolvedValue({ count: 0 });

      await service.createFromText("t1", "u1", "texto de receta");
      await settle();

      expect(prisma.recipeCaptureIngredient.createMany).not.toHaveBeenCalled();
    });

    it.each([
      [
        "descarga",
        new fetcher.PageFetchError("La web no respondió"),
        "La web no respondió",
      ],
      [
        "validación",
        new RecipeStructuringError("No se encontró una receta en la fuente"),
        "No se encontró una receta en la fuente",
      ],
      [
        "proveedor de IA",
        new AssistantCompletionError("El proveedor de IA está saturado"),
        "El proveedor de IA está saturado",
      ],
    ])(
      "error de %s: se guarda su mensaje para el usuario",
      async (_n, error, message) => {
        structuring.structure.mockRejectedValue(error);

        await service.createFromText("t1", "u1", "texto de receta");
        await settle();

        expect(prisma.recipeCapture.updateMany.mock.calls.at(-1)[0]).toEqual({
          where: { id: "c1", status: "PROCESANDO" },
          data: { status: "ERROR", errorMessage: message },
        });
      },
    );

    it("un error interno nunca se muestra tal cual al usuario", async () => {
      class PrismaClientKnownRequestError extends Error {}
      structuring.structure.mockRejectedValue(
        new PrismaClientKnownRequestError('relation "secreta" does not exist'),
      );

      await service.createFromText("t1", "u1", "texto de receta");
      await settle();

      expect(prisma.recipeCapture.updateMany.mock.calls.at(-1)[0].data).toEqual(
        {
          status: "ERROR",
          errorMessage: "No se pudo procesar la receta. Vuelve a intentarlo.",
        },
      );
    });
  });

  describe("vínculo de ingrediente", () => {
    const pending = { id: "i1", capture: { status: "PENDIENTE" } };

    it("busca el ingrediente dentro de la captura y del tenant", async () => {
      prisma.recipeCaptureIngredient.findFirst.mockResolvedValue(null);

      await expect(
        service.updateIngredient("t1", "c1", "i1", null),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        prisma.recipeCaptureIngredient.findFirst.mock.calls[0][0].where,
      ).toEqual({
        id: "i1",
        captureId: "c1",
        capture: { tenantId: "t1" },
      });
    });

    it.each(["PROCESANDO", "ERROR", "PASANDO", "PASADA"])(
      "no se edita una captura %s",
      async (status) => {
        prisma.recipeCaptureIngredient.findFirst.mockResolvedValue({
          id: "i1",
          capture: { status },
        });

        await expect(
          service.updateIngredient("t1", "c1", "i1", "p1"),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.recipeCaptureIngredient.update).not.toHaveBeenCalled();
      },
    );

    it("rechaza un artículo de otro tenant o borrado", async () => {
      prisma.recipeCaptureIngredient.findFirst.mockResolvedValue(pending);
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateIngredient("t1", "c1", "i1", "p-ajeno"),
      ).rejects.toThrow("Artículo no encontrado");
      expect(prisma.product.findFirst.mock.calls[0][0].where).toEqual({
        id: "p-ajeno",
        tenantId: "t1",
        deletedAt: null,
      });
      expect(prisma.recipeCaptureIngredient.update).not.toHaveBeenCalled();
    });

    it("al elegirlo el usuario deja de ser una sugerencia automática", async () => {
      prisma.recipeCaptureIngredient.findFirst.mockResolvedValue(pending);
      prisma.product.findFirst.mockResolvedValue({ id: "p1" });
      prisma.recipeCapture.findFirst.mockResolvedValue({ id: "c1" });

      await service.updateIngredient("t1", "c1", "i1", "p1");

      expect(prisma.recipeCaptureIngredient.update).toHaveBeenCalledWith({
        where: { id: "i1" },
        data: { matchedProductId: "p1", matchConfidence: null },
      });
    });
  });

  describe("descartar", () => {
    it("pasa la captura a DESCARTADA sin borrarla", async () => {
      await service.discard("t1", "c1");

      const call = prisma.recipeCapture.updateMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ id: "c1", tenantId: "t1" });
      expect(call.where.status.in).not.toContain("PASANDO");
      expect(call.data).toEqual({ status: "DESCARTADA" });
    });

    it("404 si no existe, es de otro tenant o se está pasando a Recetas", async () => {
      prisma.recipeCapture.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.discard("t1", "c1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
