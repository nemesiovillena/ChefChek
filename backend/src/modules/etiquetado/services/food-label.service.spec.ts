import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FoodLabelService } from "./food-label.service";
import { LotNumberService } from "./lot-number.service";
import { EtiquetadoConfigService } from "./etiquetado-config.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("FoodLabelService", () => {
  let service: FoodLabelService;

  const mockPrisma = {
    recipe: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    lot: { findFirst: jest.fn(), findMany: jest.fn() },
    albaranLine: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    foodLabel: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const mockLotNumber = {
    generateElaboratedLot: jest.fn().mockResolvedValue("JARR-310826-01"),
    formatDatePart: jest.fn().mockReturnValue("020926"),
    maxRetries: 5,
  };

  const mockEtiquetadoConfig = {
    getExpiryWarningDays: jest.fn().mockResolvedValue(5),
  };

  const TENANT = "t1";
  const USER = { id: "u1", name: "Ana López" };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(5);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodLabelService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LotNumberService, useValue: mockLotNumber },
        { provide: EtiquetadoConfigService, useValue: mockEtiquetadoConfig },
      ],
    }).compile();
    service = module.get(FoodLabelService);
  });

  describe("create — ELABORATED", () => {
    const recipe = {
      id: "r1",
      name: "Jarrete de ternera",
      allergens: [1, 7],
      shelfLifeDays: 5,
      shelfLifeFrozenDays: null,
      storageCondition: "REFRIGERATED",
      storageTempMin: 0,
      storageTempMax: 4,
    };

    it("generates the lot, computes use-by from recipe shelf life, snapshots name/allergens/user", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "ELABORATED",
        recipeId: "r1",
        preparedAt: "2026-08-31T10:00:00.000Z",
      });

      expect(mockLotNumber.generateElaboratedLot).toHaveBeenCalled();
      expect(result.lotNumber).toBe("JARR-310826-01");
      expect(result.itemName).toBe("Jarrete de ternera");
      expect(result.allergens).toEqual([1, 7]);
      expect(result.createdByName).toBe("Ana López");
      expect(result.shelfLifeDaysApplied).toBe(5);
      // 31 ago + 5 días = 5 sep
      expect(new Date(result.useByDate).getDate()).toBe(5);
    });

    it("rejects when there is no shelf life and no explicit use-by date", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({
        ...recipe,
        shelfLifeDays: null,
      });
      await expect(
        service.create(TENANT, USER, {
          labelType: "ELABORATED",
          recipeId: "r1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("frozen label: consumption date comes from the frozen shelf life, not the refrigerated one", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({
        ...recipe,
        shelfLifeFrozenDays: 90,
      });
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "ELABORATED",
        recipeId: "r1",
        preparedAt: "2026-08-31T10:00:00.000Z",
        frozenAt: "2026-08-31T10:00:00.000Z",
        freeze: true,
      });

      // 31 ago + 90 días de congelado = 29 nov (no el 5 sep de la vida útil normal)
      expect(new Date(result.useByDate).getDate()).toBe(29);
      expect(result.useByDate).toEqual(result.frozenUseByDate);
      expect(result.shelfLifeDaysApplied).toBe(5);
    });

    it("frozen label without frozen shelf life is rejected even if the normal one exists", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      await expect(
        service.create(TENANT, USER, {
          labelType: "ELABORATED",
          recipeId: "r1",
          freeze: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when no storage condition can be resolved", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({
        ...recipe,
        storageCondition: null,
      });
      await expect(
        service.create(TENANT, USER, {
          labelType: "ELABORATED",
          recipeId: "r1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("retries lot generation on a unique-constraint collision", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      });
      mockPrisma.foodLabel.create
        .mockRejectedValueOnce(p2002)
        .mockImplementationOnce(({ data }: any) => ({ id: "fl2", ...data }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "ELABORATED",
        recipeId: "r1",
        preparedAt: "2026-08-31T10:00:00.000Z",
      });
      expect(result.id).toBe("fl2");
      expect(mockPrisma.foodLabel.create).toHaveBeenCalledTimes(2);
    });

    it("responsibleName (free text) overrides the session user as createdByName", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "ELABORATED",
        recipeId: "r1",
        preparedAt: "2026-08-31T10:00:00.000Z",
        responsibleName: "Marta Ruiz",
      });

      expect(result.createdByName).toBe("Marta Ruiz");
      expect(result.createdByUserId).toBe(USER.id);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("responsibleUserId resolves the current name of that user (not client-supplied text)", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.user.findFirst.mockResolvedValue({ name: "Iñaki Etxeberria" });
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "ELABORATED",
        recipeId: "r1",
        preparedAt: "2026-08-31T10:00:00.000Z",
        responsibleUserId: "staff1",
        responsibleName: "texto que debe ignorarse",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: "staff1", tenantId: TENANT },
        select: { name: true },
      });
      expect(result.createdByName).toBe("Iñaki Etxeberria");
    });

    it("rejects a responsibleUserId that does not exist in the tenant", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT, USER, {
          labelType: "ELABORATED",
          recipeId: "r1",
          responsibleUserId: "ghost",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("create — HANDLED", () => {
    it("uses the source lot number and pre-loads manufacturer expiry from the lot", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: "p1",
        name: "Lubina",
        allergens: [4],
        secondaryShelfLifeDays: 3,
        shelfLifeFrozenDays: null,
        storageCondition: "REFRIGERATED",
        storageTempMin: 0,
        storageTempMax: 4,
      });
      mockPrisma.lot.findFirst.mockResolvedValue({
        id: "lot1",
        lotNumber: "MAKRO-8842",
        expiryDate: new Date("2026-09-10T00:00:00.000Z"),
        productId: "p1",
      });
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl3",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "HANDLED",
        productId: "p1",
        sourceLotId: "lot1",
        preparedAt: "2026-08-31T10:00:00.000Z",
      });

      expect(result.lotNumber).toBe("MAKRO-8842");
      expect(new Date(result.manufacturerExpiryDate).getMonth()).toBe(8);
      expect(result.shelfLifeDaysApplied).toBe(3);
    });

    it("rejects a source lot that belongs to another product", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: "p1",
        name: "Lubina",
        allergens: [],
        secondaryShelfLifeDays: 3,
        shelfLifeFrozenDays: null,
        storageCondition: "REFRIGERATED",
        storageTempMin: null,
        storageTempMax: null,
      });
      mockPrisma.lot.findFirst.mockResolvedValue({
        id: "lot1",
        lotNumber: "X",
        expiryDate: null,
        productId: "OTHER",
      });
      await expect(
        service.create(TENANT, USER, {
          labelType: "HANDLED",
          productId: "p1",
          sourceLotId: "lot1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    const rodaballo = {
      id: "p2",
      name: "Rodaballo de Makro",
      allergens: [4],
      secondaryShelfLifeDays: 3,
      shelfLifeFrozenDays: null,
      storageCondition: "REFRIGERATED",
      storageTempMin: 0,
      storageTempMax: 4,
      supplier: { name: "Makro" },
    };

    it("no lot: anchors on the chosen purchase (date + supplier), generates an internal id", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(rodaballo);
      mockPrisma.albaranLine.findFirst.mockResolvedValue({
        matchedProductId: "p2",
        albaran: {
          date: new Date("2026-09-02T00:00:00.000Z"),
          supplier: { name: "Makro" },
        },
      });
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl9",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "HANDLED",
        productId: "p2",
        sourcePurchaseLineId: "line1",
        preparedAt: "2026-09-10T10:00:00.000Z",
      });

      expect(result.supplierName).toBe("Makro");
      expect(new Date(result.purchaseDate).getDate()).toBe(2);
      expect(result.sourceLotId).toBeNull();
      // identificador interno, no vacío (satisface @@unique)
      expect(result.lotNumber).toMatch(/^[A-Z0-9]+-C020926/);
    });

    it("no lot and no purchase chosen is rejected", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(rodaballo);
      await expect(
        service.create(TENANT, USER, {
          labelType: "HANDLED",
          productId: "p2",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("snapshots the supplier name from the source lot", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(rodaballo);
      mockPrisma.lot.findFirst.mockResolvedValue({
        id: "lot2",
        lotNumber: "L-777",
        expiryDate: null,
        productId: "p2",
        receivedAt: new Date("2026-09-01T00:00:00.000Z"),
        supplier: { name: "Pescados SL" },
      });
      mockPrisma.foodLabel.create.mockImplementation(({ data }: any) => ({
        id: "fl10",
        ...data,
      }));

      const result: any = await service.create(TENANT, USER, {
        labelType: "HANDLED",
        productId: "p2",
        sourceLotId: "lot2",
      });

      expect(result.lotNumber).toBe("L-777");
      expect(result.supplierName).toBe("Pescados SL");
      expect(result.purchaseDate).toBeNull();
    });

    it("rejects with a clear message when the supplier lot number is already used (e.g. after void+recreate)", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(rodaballo);
      mockPrisma.lot.findFirst.mockResolvedValue({
        id: "lot2",
        lotNumber: "L-777",
        expiryDate: null,
        productId: "p2",
        receivedAt: new Date("2026-09-01T00:00:00.000Z"),
        supplier: { name: "Pescados SL" },
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      });
      mockPrisma.foodLabel.create.mockRejectedValueOnce(p2002);

      await expect(
        service.create(TENANT, USER, {
          labelType: "HANDLED",
          productId: "p2",
          sourceLotId: "lot2",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("void", () => {
    it("sets voidedAt and reason", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue({
        id: "fl1",
        voidedAt: null,
      });
      mockPrisma.foodLabel.update.mockResolvedValue({ id: "fl1" });
      await service.void(TENANT, "fl1", "error de fecha");
      expect(mockPrisma.foodLabel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ voidReason: "error de fecha" }),
        }),
      );
    });

    it("rejects double void", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue({
        id: "fl1",
        voidedAt: new Date(),
      });
      await expect(
        service.void(TENANT, "fl1", undefined),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("update", () => {
    const editableLabel = () => ({
      id: "fl1",
      tenantId: TENANT,
      labelType: "ELABORATED",
      recipeId: "r1",
      productId: null,
      preparedAt: new Date("2026-08-31T10:00:00.000Z"),
      manufacturerExpiryDate: null,
      useByDate: new Date("2026-09-05T12:00:00.000Z"),
      frozenAt: null,
      frozenUseByDate: null,
      storageCondition: "REFRIGERATED",
      storageTempMin: 0,
      storageTempMax: 4,
      shelfLifeDaysApplied: 5,
      quantity: 2,
      quantityUnit: "kg",
      portions: 8,
      notes: null,
      createdByName: "Warynessy",
      editLog: null,
      reprintCount: 0,
      voidedAt: null,
      createdAt: new Date(),
    });

    const recipe = {
      id: "r1",
      name: "Jarrete de ternera",
      allergens: [1, 7],
      shelfLifeDays: 5,
      shelfLifeFrozenDays: 90,
      storageCondition: "REFRIGERATED",
      storageTempMin: 0,
      storageTempMax: 4,
    };

    it("switching to frozen recomputes the use-by date from the frozen shelf life and logs the change", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue(editableLabel());
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.foodLabel.update.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.update(TENANT, USER, "fl1", {
        freeze: true,
        frozenAt: "2026-08-31T10:00:00.000Z",
      });

      // 31 ago + 90 días de congelado = 29 nov
      expect(new Date(result.useByDate).getDate()).toBe(29);
      expect(result.frozenUseByDate).toEqual(result.useByDate);
      expect(result.editCount).toEqual({ increment: 1 });
      expect(result.editedByName).toBe("Ana López");
      const entry = result.editLog[0];
      expect(entry.by).toBe("Ana López");
      expect(entry.changes.frozenAt).toBeDefined();
      expect(entry.changes.useByDate).toBeDefined();
    });

    it("corrects the responsible name (createdByName) without touching editedByName", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue(editableLabel());
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.foodLabel.update.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.update(TENANT, USER, "fl1", {
        responsibleName: "Marta Ruiz",
      });

      expect(result.createdByName).toBe("Marta Ruiz");
      expect(result.editedByName).toBe("Ana López");
      expect(result.editLog[0].changes.createdByName).toEqual({
        from: "Warynessy",
        to: "Marta Ruiz",
      });
    });

    it("rejects a voided label", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue({
        ...editableLabel(),
        voidedAt: new Date(),
      });
      await expect(
        service.update(TENANT, USER, "fl1", { notes: "x" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("allows correcting a label that has already been reprinted (same day)", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue({
        ...editableLabel(),
        reprintCount: 2,
      });
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.foodLabel.update.mockImplementation(({ data }: any) => ({
        id: "fl1",
        ...data,
      }));

      const result: any = await service.update(TENANT, USER, "fl1", {
        notes: "corregido tras reimprimir",
      });

      expect(result.notes).toBe("corregido tras reimprimir");
    });

    it("rejects a label created on a previous day", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue({
        ...editableLabel(),
        createdAt: new Date("2020-01-01T09:00:00.000Z"),
      });
      await expect(
        service.update(TENANT, USER, "fl1", { notes: "x" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("returns the label untouched when nothing actually changed", async () => {
      const label = editableLabel();
      mockPrisma.foodLabel.findFirst.mockResolvedValue(label);
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);

      const result = await service.update(TENANT, USER, "fl1", {
        notes: null as unknown as string,
      });

      // No toBe(label): update() ahora envuelve el resultado con los campos
      // derivados de caducidad (nueva referencia), aunque los datos base no
      // cambien y no se llame a prisma.update.
      expect(result).toMatchObject(label);
      expect(mockPrisma.foodLabel.update).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("excludes voided labels unless includeVoided is set", async () => {
      mockPrisma.foodLabel.findMany.mockResolvedValue([]);
      mockPrisma.foodLabel.count.mockResolvedValue(0);
      await service.list(TENANT, {});
      const where = mockPrisma.foodLabel.findMany.mock.calls[0][0].where;
      expect(where.voidedAt).toBeNull();

      jest.clearAllMocks();
      mockPrisma.foodLabel.findMany.mockResolvedValue([]);
      mockPrisma.foodLabel.count.mockResolvedValue(0);
      await service.list(TENANT, { includeVoided: true });
      const where2 = mockPrisma.foodLabel.findMany.mock.calls[0][0].where;
      expect(where2.voidedAt).toBeUndefined();
    });
  });

  describe("expiry fields (daysUntilExpiry / expiryStatus)", () => {
    const DAY = 86_400_000;
    const baseLabel = (overrides: Record<string, unknown> = {}) => ({
      id: "fl1",
      tenantId: TENANT,
      useByDate: new Date(Date.now() + 10 * DAY),
      frozenUseByDate: null,
      voidedAt: null,
      ...overrides,
    });

    it("marks 'ok' when far from the configured threshold", async () => {
      mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(2);
      mockPrisma.foodLabel.findFirst.mockResolvedValue(
        baseLabel({ useByDate: new Date(Date.now() + 10 * DAY) }),
      );
      const result: any = await service.getById(TENANT, "fl1");
      expect(result.expiryStatus).toBe("ok");
      expect(result.daysUntilExpiry).toBeGreaterThan(2);
    });

    it("marks 'expiring_soon' (not 'expired') exactly at daysUntilExpiry === 0", async () => {
      mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(2);
      // Mismo instante que "ahora": floor((0)/DAY) = 0, el límite exacto
      // entre 'expired' (< 0) y 'expiring_soon' (<= warningDays). El reloj se
      // congela: con el reloj real, si avanza 1 ms entre crear la fecha y que
      // el servicio lea Date.now(), el resultado sería floor(-1ms/DAY) = -1.
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(now);
      try {
        mockPrisma.foodLabel.findFirst.mockResolvedValue(
          baseLabel({ useByDate: new Date(now) }),
        );
        const result: any = await service.getById(TENANT, "fl1");
        expect(result.daysUntilExpiry).toBe(0);
        expect(result.expiryStatus).toBe("expiring_soon");
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("marks 'expiring_soon' when within the configured threshold", async () => {
      mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(2);
      mockPrisma.foodLabel.findFirst.mockResolvedValue(
        baseLabel({ useByDate: new Date(Date.now() + 1 * DAY) }),
      );
      const result: any = await service.getById(TENANT, "fl1");
      expect(result.expiryStatus).toBe("expiring_soon");
    });

    it("marks 'expired' when the effective date is in the past", async () => {
      mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(2);
      mockPrisma.foodLabel.findFirst.mockResolvedValue(
        baseLabel({ useByDate: new Date(Date.now() - 1 * DAY) }),
      );
      const result: any = await service.getById(TENANT, "fl1");
      expect(result.expiryStatus).toBe("expired");
      expect(result.daysUntilExpiry).toBeLessThan(0);
    });

    it("uses frozenUseByDate over useByDate when the label is frozen", async () => {
      mockEtiquetadoConfig.getExpiryWarningDays.mockResolvedValue(2);
      mockPrisma.foodLabel.findFirst.mockResolvedValue(
        baseLabel({
          useByDate: new Date(Date.now() - 1 * DAY), // ya caducado en fresco
          frozenUseByDate: new Date(Date.now() + 30 * DAY), // congelado, lejos
        }),
      );
      const result: any = await service.getById(TENANT, "fl1");
      expect(result.expiryStatus).toBe("ok");
    });

    it("returns null expiry fields for a voided label", async () => {
      mockPrisma.foodLabel.findFirst.mockResolvedValue(
        baseLabel({
          voidedAt: new Date(),
          useByDate: new Date(Date.now() - 1 * DAY),
        }),
      );
      const result: any = await service.getById(TENANT, "fl1");
      expect(result.daysUntilExpiry).toBeNull();
      expect(result.expiryStatus).toBeNull();
    });

    it("list: expiringWithinDays filters by effective expiry (frozen or not)", async () => {
      mockPrisma.foodLabel.findMany.mockResolvedValue([]);
      mockPrisma.foodLabel.count.mockResolvedValue(0);
      await service.list(TENANT, { expiringWithinDays: 3 });
      const where = mockPrisma.foodLabel.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0].frozenUseByDate.not).toBeNull();
      expect(where.OR[1].frozenUseByDate).toBeNull();
    });

    it("list: sortBy=useByDate orders ascending instead of preparedAt desc", async () => {
      mockPrisma.foodLabel.findMany.mockResolvedValue([]);
      mockPrisma.foodLabel.count.mockResolvedValue(0);
      await service.list(TENANT, { sortBy: "useByDate" });
      const orderBy = mockPrisma.foodLabel.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ useByDate: "asc" });
    });
  });
});
