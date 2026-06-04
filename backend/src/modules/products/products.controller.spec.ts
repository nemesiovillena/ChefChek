import { Test, TestingModule } from "@nestjs/testing";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

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
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
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

      const result = await controller.getSuppliers(mockReq);

      expect(mockProductsService.getSuppliers).toHaveBeenCalledWith(
        mockReq.tenantId,
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
});
