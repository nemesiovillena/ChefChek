import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { RecipeCapturePromotionService } from "./recipe-capture-promotion.service";

const capture = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  tenantId: "t1",
  status: "PENDIENTE",
  name: "Tarta de queso",
  description: "Al horno",
  elaboration: JSON.stringify({ steps: [{ description: "Hornear" }] }),
  portions: 8,
  preparationTimeMinutes: 15,
  cookingTimeMinutes: 40,
  sourceUrl: "https://recetas.es/tarta",
  imageUrl: "https://cdn.test/plato.jpg",
  reservedRecipeId: null,
  claimedAt: null,
  recipeId: null,
  ...overrides,
});

const linked = {
  rawText: "500 g de queso crema",
  quantity: 500,
  unit: "g",
  note: null,
  matchedProduct: { id: "p1", referenceUnit: "kg", deletedAt: null },
};
const unlinked = {
  rawText: "sal al gusto",
  quantity: null,
  unit: null,
  note: null,
  matchedProduct: null,
};

describe("RecipeCapturePromotionService", () => {
  const prisma = {
    recipeCapture: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    recipeCaptureIngredient: { findMany: jest.fn() },
    recipe: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const recipes = { create: jest.fn() };
  const modules = { isModuleEnabled: jest.fn() };
  const roleAccess = { isSectionAllowed: jest.fn() };
  let service: RecipeCapturePromotionService;

  /** Datos con los que se hizo cada updateMany de la captura, en orden. */
  const transitions = () =>
    prisma.recipeCapture.updateMany.mock.calls.map(
      ([call]) => call.data.status,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    modules.isModuleEnabled.mockResolvedValue(true);
    roleAccess.isSectionAllowed.mockResolvedValue(true);
    prisma.recipeCapture.findFirst.mockResolvedValue(capture());
    prisma.recipeCapture.updateMany.mockResolvedValue({ count: 1 });
    prisma.recipeCaptureIngredient.findMany.mockResolvedValue([
      linked,
      unlinked,
    ]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.recipe.findFirst.mockResolvedValue({ id: "r1" });
    recipes.create.mockResolvedValue({ id: "ignorado" });
    service = new RecipeCapturePromotionService(
      prisma as any,
      recipes as any,
      modules as any,
      roleAccess as any,
    );
    jest.spyOn((service as any).logger, "warn").mockImplementation(() => {});
  });

  describe("permisos: lo mismo que crear una receta a mano", () => {
    it("sin tenant no consulta nada", async () => {
      await expect(service.promote("", "ADMIN", "c1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.recipeCapture.findFirst).not.toHaveBeenCalled();
    });

    it("403 si el módulo Recetas está apagado", async () => {
      modules.isModuleEnabled.mockResolvedValue(false);

      await expect(service.promote("t1", "USER", "c1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(modules.isModuleEnabled).toHaveBeenCalledWith("t1", "recipes");
      expect(recipes.create).not.toHaveBeenCalled();
    });

    it.each(["recipes", "recipes.edit"])(
      "403 si el rol tiene oculta la sección %s",
      async (hidden) => {
        roleAccess.isSectionAllowed.mockImplementation(
          async (_tenant: string, _role: string, section: string) =>
            section !== hidden,
        );

        await expect(
          service.promote("t1", "USER", "c1"),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.recipeCapture.updateMany).not.toHaveBeenCalled();
      },
    );
  });

  it("404 si la captura no existe, es de otro tenant o está descartada", async () => {
    prisma.recipeCapture.findFirst.mockResolvedValue(null);

    await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.recipeCapture.findFirst.mock.calls[0][0].where).toEqual({
      id: "c1",
      tenantId: "t1",
      status: { not: "DESCARTADA" },
    });
  });

  it.each(["PROCESANDO", "ERROR"])(
    "409 si la captura está %s",
    async (status) => {
      prisma.recipeCapture.findFirst.mockResolvedValue(capture({ status }));

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(recipes.create).not.toHaveBeenCalled();
    },
  );

  describe("paso normal", () => {
    it("crea la receta con las líneas vinculadas, el resto en notas, la fuente y el id reservado", async () => {
      const result = await service.promote("t1", "ADMIN", "c1");

      const claim = prisma.recipeCapture.updateMany.mock.calls[0][0];
      expect(claim.where).toEqual({
        id: "c1",
        tenantId: "t1",
        status: "PENDIENTE",
        claimedAt: null,
      });
      expect(claim.data.status).toBe("PASANDO");
      const reservedId = claim.data.reservedRecipeId;
      expect(reservedId).toEqual(expect.any(String));

      const [tenantId, dto, opts] = recipes.create.mock.calls[0];
      expect(tenantId).toBe("t1");
      expect(opts).toEqual({ id: reservedId });
      expect(dto).toMatchObject({
        name: "Tarta de queso",
        portions: 8,
        preparationTimeMinutes: 15,
        cookingTimeMinutes: 40,
        sourceUrl: "https://recetas.es/tarta",
        imageUrl: "https://cdn.test/plato.jpg",
        ingredients: [{ productId: "p1", quantity: 500, unit: "g" }],
        notes:
          "Ingredientes pendientes de vincular (alérgenos incompletos):\n- sal al gusto",
        isPublic: false,
      });

      expect(prisma.recipeCapture.updateMany.mock.calls[1][0]).toEqual({
        where: { id: "c1", status: "PASANDO", reservedRecipeId: reservedId },
        data: { status: "PASADA", recipeId: reservedId },
      });
      expect(result).toEqual({ recipeId: reservedId, lines: 1, toNotes: 1 });
    });

    it("con ingredientes pendientes la receta se crea inactiva", async () => {
      await service.promote("t1", "ADMIN", "c1");

      expect(recipes.create.mock.calls[0][1].isActive).toBe(false);
    });

    it("con todos los ingredientes vinculados se crea activa y sin notas", async () => {
      prisma.recipeCaptureIngredient.findMany.mockResolvedValue([linked]);

      await service.promote("t1", "ADMIN", "c1");

      const dto = recipes.create.mock.calls[0][1];
      expect(dto.isActive).toBe(true);
      expect(dto.notes).toBeUndefined();
    });

    it("un artículo borrado tras la revisión va a notas, no a una línea", async () => {
      prisma.recipeCaptureIngredient.findMany.mockResolvedValue([
        {
          ...linked,
          matchedProduct: { ...linked.matchedProduct, deletedAt: new Date() },
        },
      ]);

      await service.promote("t1", "ADMIN", "c1");

      const dto = recipes.create.mock.calls[0][1];
      expect(dto.ingredients).toEqual([]);
      expect(dto.notes).toContain("- 500 g de queso crema");
    });

    it("una captura sin nombre no llega a crear la receta y vuelve a PENDIENTE", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(capture({ name: null }));

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(recipes.create).not.toHaveBeenCalled();
      expect(transitions()).toEqual(["PASANDO", "PENDIENTE"]);
    });
  });

  describe("nunca dos recetas de una captura", () => {
    it("una captura ya pasada devuelve su receta sin crear otra", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(
        capture({ status: "PASADA", recipeId: "r1" }),
      );

      const result = await service.promote("t1", "ADMIN", "c1");

      expect(result).toEqual({ recipeId: "r1", lines: null, toNotes: null });
      expect(recipes.create).not.toHaveBeenCalled();
      expect(prisma.recipeCapture.updateMany).not.toHaveBeenCalled();
    });

    it("409 si la receta de una captura pasada se eliminó (nunca devuelve un id nulo)", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(
        capture({ status: "PASADA", recipeId: null }),
      );

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("409 si la receta de una captura pasada está borrada (borrado lógico: el enlace sigue ahí)", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(
        capture({ status: "PASADA", recipeId: "r1" }),
      );
      prisma.recipe.findFirst.mockResolvedValue(null);

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.recipe.findFirst.mock.calls[0][0].where).toEqual({
        id: "r1",
        tenantId: "t1",
        deletedAt: null,
      });
    });

    it("si otra petición re-reclamó la captura mientras se creaba la receta, devuelve la de esa petición", async () => {
      prisma.recipeCapture.updateMany
        .mockResolvedValueOnce({ count: 1 }) // reclamo
        .mockResolvedValueOnce({ count: 0 }); // cierre: ya no es nuestro id
      prisma.recipeCapture.findUnique.mockResolvedValue({ recipeId: "r-otra" });

      const result = await service.promote("t1", "ADMIN", "c1");

      expect(result.recipeId).toBe("r-otra");
    });

    it("409 mientras otra petición la está pasando", async () => {
      prisma.recipeCapture.findFirst.mockResolvedValue(
        capture({
          status: "PASANDO",
          claimedAt: new Date(),
          reservedRecipeId: "r1",
        }),
      );

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toThrow(
        "Ya se está pasando a Recetas",
      );
      expect(recipes.create).not.toHaveBeenCalled();
    });

    it("409 si otra petición gana el reclamo entre la lectura y la escritura", async () => {
      prisma.recipeCapture.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(recipes.create).not.toHaveBeenCalled();
    });

    it("si crear la receta falla sin llegar a guardarla, la captura vuelve a PENDIENTE", async () => {
      recipes.create.mockRejectedValue(new Error("fallo de base de datos"));
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.promote("t1", "ADMIN", "c1")).rejects.toThrow(
        "fallo de base de datos",
      );
      expect(transitions()).toEqual(["PASANDO", "PENDIENTE"]);
      expect(prisma.recipeCapture.updateMany.mock.calls[1][0].data).toEqual({
        status: "PENDIENTE",
        reservedRecipeId: null,
        claimedAt: null,
      });
    });

    it("si crear la receta falla DESPUÉS de guardarla, la captura queda enlazada y no se libera", async () => {
      recipes.create.mockRejectedValue(
        new Error("fallo al montar la respuesta"),
      );
      prisma.$queryRaw.mockResolvedValue([{ id: "existe" }]);

      const result = await service.promote("t1", "ADMIN", "c1");

      const reservedId =
        prisma.recipeCapture.updateMany.mock.calls[0][0].data.reservedRecipeId;
      expect(result.recipeId).toBe(reservedId);
      expect(transitions()).toEqual(["PASANDO", "PASADA"]);
    });

    describe("paso interrumpido hace más de 2 minutos", () => {
      const stale = capture({
        status: "PASANDO",
        claimedAt: new Date(Date.now() - 5 * 60 * 1000),
        reservedRecipeId: "r-reservada",
      });

      it("si la receta reservada existe, solo la enlaza", async () => {
        prisma.recipeCapture.findFirst.mockResolvedValue(stale);
        prisma.$queryRaw.mockResolvedValue([{ id: "r-reservada" }]);

        const result = await service.promote("t1", "ADMIN", "c1");

        expect(result.recipeId).toBe("r-reservada");
        expect(recipes.create).not.toHaveBeenCalled();
        expect(transitions()).toEqual(["PASADA"]);
      });

      it("si no existe, vuelve a reclamar la captura y crea la receta una vez", async () => {
        prisma.recipeCapture.findFirst.mockResolvedValue(stale);
        prisma.$queryRaw.mockResolvedValue([]);

        await service.promote("t1", "ADMIN", "c1");

        const claim = prisma.recipeCapture.updateMany.mock.calls[0][0];
        expect(claim.where).toMatchObject({
          status: "PASANDO",
          claimedAt: stale.claimedAt,
        });
        expect(claim.data.reservedRecipeId).not.toBe("r-reservada");
        expect(recipes.create).toHaveBeenCalledTimes(1);
        expect(transitions()).toEqual(["PASANDO", "PASADA"]);
      });
    });
  });
});
