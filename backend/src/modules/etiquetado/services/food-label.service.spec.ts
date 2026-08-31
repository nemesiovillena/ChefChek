import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FoodLabelService } from "./food-label.service";
import { LotNumberService } from "./lot-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("FoodLabelService", () => {
  let service: FoodLabelService;

  const mockPrisma = {
    recipe: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    lot: { findFirst: jest.fn(), findMany: jest.fn() },
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
    maxRetries: 5,
  };

  const TENANT = "t1";
  const USER = { id: "u1", name: "Ana López" };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodLabelService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LotNumberService, useValue: mockLotNumber },
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
});
