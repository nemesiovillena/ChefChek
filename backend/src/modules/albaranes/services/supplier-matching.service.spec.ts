import { Test, TestingModule } from "@nestjs/testing";
import { SupplierMatchingService } from "./supplier-matching.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("SupplierMatchingService", () => {
  let service: SupplierMatchingService;
  let prisma: PrismaService;

  const mockTenantId = "tenant-123";
  const mockSupplier1 = {
    id: "supplier-1",
    name: "Proveedor Ejemplo SL",
    cifNif: "B12345678",
  };
  const mockSupplier2 = {
    id: "supplier-2",
    name: "Distribuidora Alimentación",
    cifNif: "A87654321",
  };
  const mockSupplier3 = {
    id: "supplier-3",
    name: "Proveedor Similar",
    cifNif: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierMatchingService,
        {
          provide: PrismaService,
          useValue: {
            supplier: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SupplierMatchingService>(SupplierMatchingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("matchSupplier", () => {
    describe("CIF exact match", () => {
      it("should return exact match when CIF matches (case-insensitive)", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier1] as any);

        const result = await service.matchSupplier({
          cifNif: "b12345678",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("CIF_EXACT");
        expect(result.supplierId).toBe("supplier-1");
        expect(result.confidence).toBe(1.0);
        expect(result.suggestions).toHaveLength(0);
      });

      it("should handle CIF with hyphens and spaces", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier1] as any);

        const result = await service.matchSupplier({
          cifNif: "B-12 34 56 78",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("CIF_EXACT");
        expect(result.supplierId).toBe("supplier-1");
      });

      it("should not match if CIF is different", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier1] as any);

        const result = await service.matchSupplier({
          cifNif: "B99999999",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NONE");
        expect(result.supplierId).toBeNull();
      });
    });

    describe("Name fuzzy match", () => {
      it("should return fuzzy match when name similarity >= 0.8", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier1] as any);

        const result = await service.matchSupplier({
          name: "Proveedor Ejemplo",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NAME_FUZZY");
        expect(result.supplierId).toBe("supplier-1");
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it("should return suggestions without auto-match for similarity 0.5-0.8", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier3, mockSupplier2] as any);

        const result = await service.matchSupplier({
          name: "Prov Similar", // Slightly different from "Proveedor Similar"
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NONE");
        expect(result.supplierId).toBeNull();
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions[0].similarity).toBeLessThan(0.8);
      });

      it("should return ranked suggestions by similarity", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier2, mockSupplier3] as any);

        const result = await service.matchSupplier({
          name: "Distribuidora",
          tenantId: mockTenantId,
        });

        expect(result.suggestions.length).toBeGreaterThan(0);
        // Verify sorted by similarity descending
        for (let i = 1; i < result.suggestions.length; i++) {
          expect(result.suggestions[i - 1].similarity).toBeGreaterThanOrEqual(
            result.suggestions[i].similarity,
          );
        }
      });
    });

    describe("No match scenarios", () => {
      it("should return NONE when no CIF match and no name provided", async () => {
        jest.spyOn(prisma.supplier, "findMany").mockResolvedValue([]);

        const result = await service.matchSupplier({
          cifNif: "B99999999",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NONE");
        expect(result.supplierId).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.suggestions).toHaveLength(0);
      });

      it("should return NONE when neither CIF nor name provided", async () => {
        const result = await service.matchSupplier({
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NONE");
        expect(result.supplierId).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.suggestions).toHaveLength(0);
      });

      it("should return NONE when name has low similarity", async () => {
        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValue([mockSupplier1] as any);

        const result = await service.matchSupplier({
          name: "Completely Different Name",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("NONE");
        expect(result.supplierId).toBeNull();
      });
    });

    describe("Priority: CIF over name", () => {
      it("should prioritize CIF exact match over name fuzzy match", async () => {
        const supplierWithMatchingCif = {
          id: "supplier-cif",
          name: "Other Name",
          cifNif: "B12345678",
        };
        const supplierWithMatchingName = {
          id: "supplier-name",
          name: "Proveedor Ejemplo SL",
          cifNif: "B99999999",
        };

        jest
          .spyOn(prisma.supplier, "findMany")
          .mockResolvedValueOnce([supplierWithMatchingCif] as any) // CIF search
          .mockResolvedValueOnce([supplierWithMatchingName] as any); // Name search (won't be called)

        const result = await service.matchSupplier({
          cifNif: "B12345678",
          name: "Proveedor Ejemplo",
          tenantId: mockTenantId,
        });

        expect(result.matchType).toBe("CIF_EXACT");
        expect(result.supplierId).toBe("supplier-cif");
        expect(prisma.supplier.findMany).toHaveBeenCalledTimes(1); // Only CIF search
      });
    });
  });
});
