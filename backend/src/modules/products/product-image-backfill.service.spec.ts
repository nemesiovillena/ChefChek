import { Test, TestingModule } from "@nestjs/testing";
import { ProductImageBackfillService } from "./product-image-backfill.service";
import { PrismaService } from "../../common/services/prisma.service";
import { PexelsImageSearchService } from "./pexels-image-search.service";

describe("ProductImageBackfillService", () => {
  let service: ProductImageBackfillService;

  const mockPrisma = {
    product: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockPexelsImageSearchService = {
    search: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductImageBackfillService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: PexelsImageSearchService,
          useValue: mockPexelsImageSearchService,
        },
      ],
    }).compile();

    service = module.get<ProductImageBackfillService>(
      ProductImageBackfillService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("only queries products missing imageUrl for the given tenant", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.backfillImages("tenant-1");

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          deletedAt: null,
          isActive: true,
          OR: [{ imageUrl: null }, { imageUrl: "" }],
        }),
      }),
    );
  });

  it("updates imageUrl with the first Pexels result and counts it", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "p1", name: "Aceite Girasol", brand: null },
    ]);
    mockPexelsImageSearchService.search.mockResolvedValue([
      { url: "https://images.pexels.com/full.jpg" },
      { url: "https://images.pexels.com/other.jpg" },
    ]);
    mockPrisma.product.count.mockResolvedValue(0);

    const result = await service.backfillImages("tenant-1");

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { imageUrl: "https://images.pexels.com/full.jpg" },
    });
    expect(result).toEqual({
      processed: 1,
      updated: 1,
      skipped: 0,
      failed: [],
      remaining: 0,
    });
  });

  it("skips (does not fail) products with zero search results", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "p1", name: "Producto raro", brand: null },
    ]);
    mockPexelsImageSearchService.search.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(1);

    const result = await service.backfillImages("tenant-1");

    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.remaining).toBe(1);
  });

  it("collects failures without aborting the whole batch", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "p1", name: "Producto A", brand: null },
      { id: "p2", name: "Producto B", brand: null },
    ]);
    mockPexelsImageSearchService.search
      .mockRejectedValueOnce(new Error("Pexels no disponible"))
      .mockResolvedValueOnce([{ url: "https://images.pexels.com/b.jpg" }]);
    mockPrisma.product.count.mockResolvedValue(0);

    const result = await service.backfillImages("tenant-1");

    expect(result.updated).toBe(1);
    expect(result.failed).toEqual([
      { id: "p1", name: "Producto A", reason: "Pexels no disponible" },
    ]);
  });

  it("clamps the batch limit between 1 and 100", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.backfillImages("tenant-1", 500);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
