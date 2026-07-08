import { Test, TestingModule } from "@nestjs/testing";
import { TenantsService } from "./tenants.service";
import { PrismaService } from "../../common/services/prisma.service";
import { ConflictException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

const mockPrismaService = {
  tenant: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  },
};

describe("TenantsService", () => {
  let service: TenantsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prisma = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createTenantDto = {
      name: "Test Tenant",
      slug: "test-tenant",
      domain: "test.com",
      adminEmail: "admin@test.com",
      adminPassword: "password123",
      adminName: "Admin User",
      adminRole: "ADMIN" as const,
    };

    const mockTenant = {
      id: "tenant-id",
      name: "Test Tenant",
      slug: "test-tenant",
      domain: "test.com",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      users: [
        {
          id: "user-id",
          email: "admin@test.com",
          name: "Admin User",
          role: "ADMIN",
        },
      ],
    };

    it("should create a tenant successfully", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce(null); // domain check

      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.tenant.create.mockResolvedValue(mockTenant);

      const result = await service.create(createTenantDto);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-tenant" },
      });
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { domain: "test.com" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(prisma.tenant.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.slug).toBe("test-tenant");
      expect(result.message).toBe(
        "Tenant created successfully with admin user",
      );
    });

    it("should throw ConflictException if slug already exists", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: "existing" });

      await expect(service.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw ConflictException if domain already exists", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ id: "existing" }); // domain check

      await expect(service.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should create tenant without domain", async () => {
      const dtoWithoutDomain = {
        ...createTenantDto,
        domain: undefined,
      };

      prisma.tenant.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        domain: null,
      });

      const result = await service.create(dtoWithoutDomain);

      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1); // Only slug check
      expect(result.success).toBe(true);
    });

    it("should use default admin role if not provided", async () => {
      const dtoWithoutRole = {
        name: "Test Tenant",
        slug: "test-tenant",
        adminEmail: "admin@test.com",
        adminPassword: "password123",
        adminName: "Admin User",
      };

      prisma.tenant.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.tenant.create.mockResolvedValue(mockTenant);

      await service.create(dtoWithoutRole);

      const createCall = prisma.tenant.create.mock.calls[0][0];
      expect(createCall.data.users.create.role).toBe("ADMIN");
    });
  });

  describe("findAll", () => {
    const mockTenants = [
      {
        id: "tenant-1",
        name: "Tenant 1",
        slug: "tenant-1",
        domain: "tenant1.com",
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: "tenant-2",
        name: "Tenant 2",
        slug: "tenant-2",
        domain: "tenant2.com",
        isActive: true,
        createdAt: new Date(),
      },
    ];

    it("should return paginated tenants", async () => {
      prisma.tenant.findMany.mockResolvedValue(mockTenants);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.findAll(1, 20);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          isActive: true,
          contactName: true,
          contactPosition: true,
          contactPhone: true,
          contactEmail: true,
          addressStreet: true,
          addressCity: true,
          addressPostalCode: true,
          cifNif: true,
          createdAt: true,
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it("should use default pagination values", async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      const result = await service.findAll();

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it("should calculate correct skip for page 2", async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(30);

      await service.findAll(2, 10);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe("findOne", () => {
    const mockTenant = {
      id: "tenant-id",
      name: "Test Tenant",
      slug: "test-tenant",
      domain: "test.com",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      users: [
        {
          id: "user-id",
          email: "admin@test.com",
          name: "Admin User",
          role: "ADMIN",
          isActive: true,
          createdAt: new Date(),
        },
      ],
    };

    it("should return a tenant with users", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findOne("tenant-id");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-id" },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("tenant-id");
    });

    it("should throw NotFoundException if tenant not found", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne("non-existent")).rejects.toThrow(
        "Tenant not found",
      );
    });
  });

  describe("findBySlug", () => {
    const mockTenant = {
      id: "tenant-id",
      name: "Test Tenant",
      slug: "test-tenant",
      users: [
        {
          id: "user-id",
          email: "admin@test.com",
          name: "Admin User",
          role: "ADMIN",
          isActive: true,
        },
      ],
    };

    it("should return a tenant by slug", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findBySlug("test-tenant");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-tenant" },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      });
      expect(result.slug).toBe("test-tenant");
    });

    it("should throw NotFoundException if tenant not found by slug", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        "Tenant not found",
      );
    });
  });

  describe("update", () => {
    const mockTenant = {
      id: "tenant-id",
      name: "Test Tenant",
      slug: "test-tenant",
      domain: "test.com",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateDto = {
      name: "Updated Tenant",
      slug: "updated-tenant",
      domain: "updated.com",
      isActive: false,
    };

    it("should update a tenant successfully", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(mockTenant) // existing tenant check
        .mockResolvedValueOnce(null) // new slug check
        .mockResolvedValueOnce(null); // new domain check

      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        ...updateDto,
      });

      const result = await service.update("tenant-id", updateDto);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Tenant");
      expect(result.message).toBe("Tenant updated successfully");
    });

    it("should throw NotFoundException if tenant not found", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.update("non-existent", updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update("non-existent", updateDto)).rejects.toThrow(
        "Tenant not found",
      );
    });

    it("should throw ConflictException if new slug already exists", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(mockTenant) // existing tenant check
        .mockResolvedValueOnce({ id: "other-tenant" }); // new slug check

      await expect(
        service.update("tenant-id", { slug: "existing-slug" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if new domain already exists", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(mockTenant) // existing tenant check
        .mockResolvedValueOnce({ id: "other-tenant" }); // new domain check

      await expect(
        service.update("tenant-id", { domain: "existing.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should allow update with same slug", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.update.mockResolvedValue(mockTenant);

      const result = await service.update("tenant-id", {
        slug: "test-tenant",
      });

      expect(result.success).toBe(true);
    });

    it("should allow update with same domain", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.update.mockResolvedValue(mockTenant);

      const result = await service.update("tenant-id", {
        domain: "test.com",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("remove", () => {
    const mockTenant = {
      id: "tenant-id",
      name: "Test Tenant",
    };

    it("should delete a tenant successfully", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.tenant.delete.mockResolvedValue(mockTenant);

      const result = await service.remove("tenant-id");

      expect(prisma.tenant.delete).toHaveBeenCalledWith({
        where: { id: "tenant-id" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe("Tenant deleted successfully");
    });

    it("should throw NotFoundException if tenant not found", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.remove("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove("non-existent")).rejects.toThrow(
        "Tenant not found",
      );
    });
  });

  describe("validateTenantExists", () => {
    it("should return true if tenant exists", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-id" });

      const result = await service.validateTenantExists("tenant-id");

      expect(result).toBe(true);
    });

    it("should return false if tenant does not exist", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.validateTenantExists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("validateTenantActive", () => {
    it("should return true if tenant is active", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ isActive: true });

      const result = await service.validateTenantActive("tenant-id");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-id" },
        select: { isActive: true },
      });
      expect(result).toBe(true);
    });

    it("should return false if tenant is inactive", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ isActive: false });

      const result = await service.validateTenantActive("tenant-id");

      expect(result).toBe(false);
    });

    it("should return false if tenant does not exist", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.validateTenantActive("non-existent");

      expect(result).toBe(false);
    });
  });
});
