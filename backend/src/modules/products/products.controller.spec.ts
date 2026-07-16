import { Test, TestingModule } from "@nestjs/testing";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";
import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe("ProductsController", () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    calculateProductCost: jest.fn(),
    getCategories: jest.fn(),
    getSuppliers: jest.fn(),
    createSupplier: jest.fn(),
    getProductPriceHistory: jest.fn(),
    getSupplierProducts: jest.fn(),
    getSupplierPriceHistory: jest.fn(),
  };

  const mockProductSupplierOffersService = {
    listOffers: jest.fn(),
    upsertOffer: jest.fn(),
    setPreferred: jest.fn(),
    removeOffer: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        {
          provide: ProductSupplierOffersService,
          useValue: mockProductSupplierOffersService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a product and return success response", async () => {
      const createDto = {
        name: "Test Product",
        description: "Test Description",
        purchasePrice: 100,
        purchaseUnit: "Kilogramo",
        wastePercentage: 10,
        profitMargin: 20,
      } as any;

      const mockProduct = {
        id: "product-1",
        ...createDto,
        tenantId: mockReq.tenantId,
      };
      mockProductsService.create.mockResolvedValue({
        success: true,
        data: mockProduct,
        message: "Product created successfully",
      });

      const result = await controller.create(createDto, mockReq);

      expect(mockProductsService.create).toHaveBeenCalledWith(
        createDto,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
    });
  });

  describe("findAll", () => {
    it("should return paginated list of products", async () => {
      const query: ProductsQueryDto = { page: 1, limit: 20 };
      const mockProducts = [{ id: "product-1", name: "Product 1" }];

      mockProductsService.findAll.mockResolvedValue({
        success: true,
        data: mockProducts,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await controller.findAll(query, mockReq);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(
        query,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProducts);
      expect(result.meta.total).toBe(1);
    });

    it("should filter products by search term", async () => {
      const query: ProductsQueryDto = { search: "test", page: 1, limit: 20 };

      mockProductsService.findAll.mockResolvedValue({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const result = await controller.findAll(query, mockReq);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(
        query,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
    });

    it("should filter products by category", async () => {
      const query: ProductsQueryDto = {
        category: "category-1",
        page: 1,
        limit: 20,
      };

      mockProductsService.findAll.mockResolvedValue({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll(query, mockReq);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(
        query,
        mockReq.tenantId,
      );
    });
  });

  describe("getCategories", () => {
    it("should return list of product categories", async () => {
      const mockCategories = ["category-1", "category-2"];
      mockProductsService.getCategories.mockResolvedValue({
        success: true,
        data: mockCategories,
      });

      const result = await controller.getCategories(mockReq);

      expect(mockProductsService.getCategories).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCategories);
    });
  });

  describe("getSuppliers", () => {
    it("should return list of suppliers", async () => {
      const mockSuppliers = ["supplier-1", "supplier-2"];
      mockProductsService.getSuppliers.mockResolvedValue({
        success: true,
        data: mockSuppliers,
      });

      const result = await controller.getSuppliers(
        undefined as any,
        undefined as any,
        mockReq,
      );

      expect(mockProductsService.getSuppliers).toHaveBeenCalledWith(
        mockReq.tenantId,
        undefined,
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSuppliers);
    });
  });

  describe("calculateCost", () => {
    it("should calculate product cost", async () => {
      const productId = "product-1";
      const mockCostData = {
        productId,
        productName: "Test Product",
        costPerPurchaseUnit: 100,
        costPerStorageUnit: 10,
        costPerRecipeUnit: 1,
      };

      mockProductsService.calculateProductCost.mockResolvedValue({
        success: true,
        data: mockCostData,
      });

      const result = await controller.calculateCost(productId, mockReq);

      expect(mockProductsService.calculateProductCost).toHaveBeenCalledWith(
        productId,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data.productId).toBe(productId);
    });
  });

  describe("findOne", () => {
    it("should return a product by ID", async () => {
      const productId = "product-1";
      const mockProduct = { id: productId, name: "Test Product" };

      mockProductsService.findOne.mockResolvedValue({
        success: true,
        data: mockProduct,
      });

      const result = await controller.findOne(productId, mockReq);

      expect(mockProductsService.findOne).toHaveBeenCalledWith(
        productId,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
    });
  });

  describe("update", () => {
    it("should update a product", async () => {
      const productId = "product-1";
      const updateDto: UpdateProductDto = { name: "Updated Product" };
      const mockUpdated = { id: productId, name: "Updated Product" };

      mockProductsService.update.mockResolvedValue({
        success: true,
        data: mockUpdated,
      });

      const result = await controller.update(productId, updateDto, mockReq);

      expect(mockProductsService.update).toHaveBeenCalledWith(
        productId,
        updateDto,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Product");
    });
  });

  describe("remove", () => {
    it("should delete a product and return no content", async () => {
      const productId = "product-1";

      mockProductsService.remove.mockResolvedValue({
        success: true,
        data: null,
      });

      await controller.remove(productId, mockReq);

      expect(mockProductsService.remove).toHaveBeenCalledWith(
        productId,
        mockReq.tenantId,
      );
    });
  });

  describe("createSupplier", () => {
    it("creates supplier when name is provided", async () => {
      mockProductsService.createSupplier.mockResolvedValue({
        success: true,
        data: { id: "supplier-1" },
      });

      const result = await controller.createSupplier(mockReq, {
        name: "Proveedor 1",
      } as any);

      expect(mockProductsService.createSupplier).toHaveBeenCalledWith(
        mockReq.tenantId,
        { name: "Proveedor 1" },
      );
      expect(result.success).toBe(true);
    });

    it("throws BadRequest when name is empty or whitespace", async () => {
      await expect(
        controller.createSupplier(mockReq, { name: "" } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createSupplier(mockReq, { name: "   " } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest when name is missing", async () => {
      await expect(
        controller.createSupplier(mockReq, {} as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getProductPriceHistory", () => {
    it("throws BadRequest when productId is missing", async () => {
      await expect(
        controller.getProductPriceHistory(undefined as any, undefined, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns history with productId only", async () => {
      mockProductsService.getProductPriceHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getProductPriceHistory("product-1", undefined, mockReq);

      expect(mockProductsService.getProductPriceHistory).toHaveBeenCalledWith(
        "product-1",
        mockReq.tenantId,
        undefined,
      );
    });

    it("passes supplierId when provided", async () => {
      mockProductsService.getProductPriceHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getProductPriceHistory(
        "product-1",
        "supplier-1",
        mockReq,
      );

      expect(mockProductsService.getProductPriceHistory).toHaveBeenCalledWith(
        "product-1",
        mockReq.tenantId,
        "supplier-1",
      );
    });
  });

  describe("getSupplierProducts", () => {
    it("uses default page=1 and limit=20 when not provided", async () => {
      mockProductsService.getSupplierProducts.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getSupplierProducts("supplier-1", mockReq);

      expect(mockProductsService.getSupplierProducts).toHaveBeenCalledWith(
        "supplier-1",
        mockReq.tenantId,
        1,
        20,
      );
    });

    it("parses page and limit when provided as strings", async () => {
      mockProductsService.getSupplierProducts.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getSupplierProducts("supplier-1", mockReq, "3", "50");

      expect(mockProductsService.getSupplierProducts).toHaveBeenCalledWith(
        "supplier-1",
        mockReq.tenantId,
        3,
        50,
      );
    });
  });

  describe("getSupplierPriceHistory", () => {
    it("uses default limit=30 when not provided", async () => {
      mockProductsService.getSupplierPriceHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getSupplierPriceHistory("supplier-1", mockReq);

      expect(mockProductsService.getSupplierPriceHistory).toHaveBeenCalledWith(
        "supplier-1",
        mockReq.tenantId,
        30,
      );
    });

    it("parses limit when provided as string", async () => {
      mockProductsService.getSupplierPriceHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getSupplierPriceHistory("supplier-1", mockReq, "10");

      expect(mockProductsService.getSupplierPriceHistory).toHaveBeenCalledWith(
        "supplier-1",
        mockReq.tenantId,
        10,
      );
    });
  });

  describe("uploadImage", () => {
    it("throws BadRequest when no file is provided", async () => {
      await expect(controller.uploadImage(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequest for an unsupported mimetype", async () => {
      const file = {
        buffer: Buffer.from("data"),
        originalname: "file.txt",
        mimetype: "text/plain",
      } as Express.Multer.File;

      await expect(controller.uploadImage(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("uploads a valid image and creates the uploads dir when missing", async () => {
      (fs.existsSync as unknown as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as unknown as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as unknown as jest.Mock).mockReturnValue(undefined);

      const file = {
        buffer: Buffer.from("img-data"),
        originalname: "photo.png",
        mimetype: "image/png",
      } as Express.Multer.File;

      const result = await controller.uploadImage(file);

      expect(result.success).toBe(true);
      expect(result.data.url).toContain("/uploads/products/");
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("uploads a valid image reusing the existing uploads dir", async () => {
      (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as unknown as jest.Mock).mockReturnValue(undefined);

      const file = {
        buffer: Buffer.from("img-data"),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      const result = await controller.uploadImage(file);

      expect(result.success).toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});
