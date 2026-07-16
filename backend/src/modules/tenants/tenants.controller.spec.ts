import { Test, TestingModule } from "@nestjs/testing";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto, UpdateTenantDto } from "./dto/create-tenant.dto";
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("TenantsController", () => {
  let controller: TenantsController;

  const mockTenantsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a tenant successfully", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "Test Restaurant",
        slug: "test-restaurant",
        domain: "test.com",
        adminEmail: "admin@test.com",
        adminPassword: "password123",
        adminName: "Admin User",
      };

      const expectedResult = {
        success: true,
        data: {
          id: "tenant-1",
          name: "Test Restaurant",
          slug: "test-restaurant",
          domain: "test.com",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "Tenant created successfully with admin user",
      };

      mockTenantsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createTenantDto);

      expect(mockTenantsService.create).toHaveBeenCalledWith(createTenantDto);
      expect(result).toEqual(expectedResult);
      expect(result.success).toBe(true);
    });

    it("should throw ConflictException if slug already exists", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "Test Restaurant",
        slug: "existing-slug",
        adminEmail: "admin@test.com",
        adminPassword: "password123",
        adminName: "Admin User",
      };

      mockTenantsService.create.mockRejectedValue(
        new ConflictException("Slug already exists"),
      );

      await expect(controller.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTenantsService.create).toHaveBeenCalledWith(createTenantDto);
    });

    it("should throw ConflictException if domain already exists", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "Test Restaurant",
        slug: "new-slug",
        domain: "existing-domain.com",
        adminEmail: "admin@test.com",
        adminPassword: "password123",
        adminName: "Admin User",
      };

      mockTenantsService.create.mockRejectedValue(
        new ConflictException("Domain already exists"),
      );

      await expect(controller.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated list of tenants with default pagination", async () => {
      const expectedResult = {
        success: true,
        data: [
          {
            id: "tenant-1",
            name: "Restaurant 1",
            slug: "restaurant-1",
            domain: "restaurant1.com",
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: "tenant-2",
            name: "Restaurant 2",
            slug: "restaurant-2",
            domain: "restaurant2.com",
            isActive: true,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 20,
        },
        message: "Tenants retrieved successfully",
      };

      mockTenantsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(mockTenantsService.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(expectedResult);
      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
    });

    it("should return paginated list with custom pagination", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: {
          total: 50,
          page: 2,
          limit: 10,
        },
        message: "Tenants retrieved successfully",
      };

      mockTenantsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll("2", "10");

      expect(mockTenantsService.findAll).toHaveBeenCalledWith(2, 10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
    });

    it("should handle string to number conversion for page and limit", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: { total: 0, page: 3, limit: 5 },
        message: "Tenants retrieved successfully",
      };

      mockTenantsService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll("3", "5");

      expect(mockTenantsService.findAll).toHaveBeenCalledWith(3, 5);
    });

    it("should use default values when page and limit are undefined", async () => {
      const expectedResult = {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20 },
        message: "Tenants retrieved successfully",
      };

      mockTenantsService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(undefined, undefined);

      expect(mockTenantsService.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  const reqAsOwnTenant = (tenantId: string) =>
    ({ user: { id: "user-1", role: "ADMIN", tenantId } }) as any;
  const reqAsSuperadmin = () =>
    ({ user: { id: "super-1", role: "SUPERADMIN", tenantId: null } }) as any;

  describe("findOne", () => {
    it("should return a tenant by ID", async () => {
      const tenantId = "tenant-1";
      const expectedResult = {
        success: true,
        data: {
          id: tenantId,
          name: "Test Restaurant",
          slug: "test-restaurant",
          domain: "test.com",
          isActive: true,
          users: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "Tenant retrieved successfully",
      };

      mockTenantsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(
        tenantId,
        reqAsOwnTenant(tenantId),
      );

      expect(mockTenantsService.findOne).toHaveBeenCalledWith(tenantId);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(tenantId);
    });

    it("should throw NotFoundException if tenant not found", async () => {
      const tenantId = "non-existent";

      mockTenantsService.findOne.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        controller.findOne(tenantId, reqAsOwnTenant(tenantId)),
      ).rejects.toThrow(NotFoundException);
      expect(mockTenantsService.findOne).toHaveBeenCalledWith(tenantId);
    });

    it("should throw ForbiddenException when requesting another tenant's data", async () => {
      await expect(
        controller.findOne("tenant-1", reqAsOwnTenant("tenant-2")),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTenantsService.findOne).not.toHaveBeenCalled();
    });

    it("should allow SUPERADMIN to fetch any tenant", async () => {
      const tenantId = "tenant-1";
      const expectedResult = { success: true, data: { id: tenantId } };
      mockTenantsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(tenantId, reqAsSuperadmin());

      expect(mockTenantsService.findOne).toHaveBeenCalledWith(tenantId);
      expect(result.success).toBe(true);
    });
  });

  describe("update", () => {
    it("should update a tenant successfully", async () => {
      const tenantId = "tenant-1";
      const updateTenantDto: UpdateTenantDto = {
        name: "Updated Restaurant",
        isActive: false,
      };

      const expectedResult = {
        success: true,
        data: {
          id: tenantId,
          name: "Updated Restaurant",
          slug: "test-restaurant",
          domain: "test.com",
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: "Tenant updated successfully",
      };

      mockTenantsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(
        tenantId,
        updateTenantDto,
        reqAsOwnTenant(tenantId),
      );

      expect(mockTenantsService.update).toHaveBeenCalledWith(
        tenantId,
        updateTenantDto,
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Restaurant");
    });

    it("should throw NotFoundException when updating non-existent tenant", async () => {
      const tenantId = "non-existent";
      const updateTenantDto: UpdateTenantDto = { name: "Updated Name" };

      mockTenantsService.update.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        controller.update(tenantId, updateTenantDto, reqAsOwnTenant(tenantId)),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException when updating to existing slug", async () => {
      const tenantId = "tenant-1";
      const updateTenantDto: UpdateTenantDto = { slug: "existing-slug" };

      mockTenantsService.update.mockRejectedValue(
        new ConflictException("Slug already exists"),
      );

      await expect(
        controller.update(tenantId, updateTenantDto, reqAsOwnTenant(tenantId)),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException when updating to existing domain", async () => {
      const tenantId = "tenant-1";
      const updateTenantDto: UpdateTenantDto = {
        domain: "existing-domain.com",
      };

      mockTenantsService.update.mockRejectedValue(
        new ConflictException("Domain already exists"),
      );

      await expect(
        controller.update(tenantId, updateTenantDto, reqAsOwnTenant(tenantId)),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ForbiddenException when updating another tenant", async () => {
      await expect(
        controller.update(
          "tenant-1",
          { name: "x" },
          reqAsOwnTenant("tenant-2"),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTenantsService.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete a tenant successfully", async () => {
      const tenantId = "tenant-1";
      const expectedResult = {
        success: true,
        data: null,
        message: "Tenant deleted successfully",
      };

      mockTenantsService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(tenantId);

      expect(mockTenantsService.remove).toHaveBeenCalledWith(tenantId);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should throw NotFoundException when deleting non-existent tenant", async () => {
      const tenantId = "non-existent";

      mockTenantsService.remove.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(controller.remove(tenantId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTenantsService.remove).toHaveBeenCalledWith(tenantId);
    });
  });
});
