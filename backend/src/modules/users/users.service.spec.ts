import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../../common/services/prisma.service";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

const mockPrismaService = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
};

describe("UsersService", () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createUserDto = {
      tenantId: "tenant-id",
      email: "user@test.com",
      password: "password123",
      name: "Test User",
      role: "USER" as const,
      isActive: true,
    };

    const mockTenant = {
      id: "tenant-id",
      isActive: true,
    };

    const mockUser = {
      id: "user-id",
      tenantId: "tenant-id",
      email: "user@test.com",
      name: "Test User",
      role: "USER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create a user successfully", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto, "tenant-id");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-id" },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email: "user@test.com",
            tenantId: "tenant-id",
          },
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe("user@test.com");
      expect(result.message).toBe("User created successfully");
    });

    it("should throw ForbiddenException if tenantId does not match requestTenantId", async () => {
      await expect(
        service.create(createUserDto, "different-tenant-id"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create(createUserDto, "different-tenant-id"),
      ).rejects.toThrow("Cannot create user for different tenant");
    });

    it("should throw NotFoundException if tenant does not exist", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        "Tenant not found",
      );
    });

    it("should throw ForbiddenException if tenant is inactive", async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        isActive: false,
      });

      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        "Tenant is not active",
      );
    });

    it("should throw ConflictException if user already exists in tenant", async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto, "tenant-id")).rejects.toThrow(
        "User already exists in this tenant",
      );
    });

    it("should use default role if not provided", async () => {
      const dtoWithoutRole = {
        tenantId: "tenant-id",
        email: "user@test.com",
        password: "password123",
        name: "Test User",
      };

      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.user.create.mockResolvedValue(mockUser);

      await service.create(dtoWithoutRole, "tenant-id");

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe("USER");
    });

    it("should use default isActive if not provided", async () => {
      const dtoWithoutIsActive = {
        tenantId: "tenant-id",
        email: "user@test.com",
        password: "password123",
        name: "Test User",
        role: "USER" as const,
      };

      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      prisma.user.create.mockResolvedValue(mockUser);

      await service.create(dtoWithoutIsActive, "tenant-id");

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
    });
  });

  describe("findAll", () => {
    const mockUsers = [
      {
        id: "user-1",
        email: "user1@test.com",
        name: "User 1",
        role: "ADMIN",
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: "user-2",
        email: "user2@test.com",
        name: "User 2",
        role: "USER",
        isActive: true,
        createdAt: new Date(),
      },
    ];

    it("should return paginated users for a tenant", async () => {
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll("tenant-id", 1, 20);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-id" },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { tenantId: "tenant-id" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it("should use default pagination values", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.findAll("tenant-id");

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it("should calculate correct skip for page 3", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(50);

      await service.findAll("tenant-id", 3, 10);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe("findOne", () => {
    const mockUser = {
      id: "user-id",
      email: "user@test.com",
      name: "Test User",
      role: "USER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return a user by id", async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne("user-id", "tenant-id");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: "user-id",
          tenantId: "tenant-id",
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("user-id");
    });

    it("should throw NotFoundException if user not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne("non-existent", "tenant-id"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne("non-existent", "tenant-id"),
      ).rejects.toThrow("User not found");
    });

    it("should not return user from different tenant", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne("user-id", "different-tenant"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    const mockUser = {
      id: "user-id",
      tenantId: "tenant-id",
      email: "user@test.com",
      name: "Test User",
      role: "USER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateUserDto = {
      name: "Updated User",
      role: "ADMIN" as const,
    };

    it("should update a user successfully", async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
      });

      const result = await service.update(
        "user-id",
        updateUserDto,
        "tenant-id",
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated User");
      expect(result.message).toBe("User updated successfully");
    });

    it("should throw NotFoundException if user not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update("non-existent", updateUserDto, "tenant-id"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update("non-existent", updateUserDto, "tenant-id"),
      ).rejects.toThrow("User not found");
    });

    it("should hash password if provided", async () => {
      const dtoWithPassword = {
        password: "newpassword123",
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-new-password");
      prisma.user.update.mockResolvedValue(mockUser);

      await service.update("user-id", dtoWithPassword, "tenant-id");

      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).toBe("hashed-new-password");
      expect(updateCall.data.password).toBeUndefined();
    });

    it("should not allow updating user from different tenant", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update("user-id", updateUserDto, "different-tenant"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update isActive status", async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.update(
        "user-id",
        { isActive: false },
        "tenant-id",
      );

      expect(result.success).toBe(true);
    });
  });

  describe("remove", () => {
    const mockUser = {
      id: "user-id",
      tenantId: "tenant-id",
    };

    it("should delete a user successfully", async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove("user-id", "tenant-id");

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user-id" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe("User deleted successfully");
    });

    it("should throw NotFoundException if user not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.remove("non-existent", "tenant-id")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove("non-existent", "tenant-id")).rejects.toThrow(
        "User not found",
      );
    });

    it("should not allow deleting user from different tenant", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.remove("user-id", "different-tenant"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByEmail", () => {
    const mockUser = {
      id: "user-id",
      tenantId: "tenant-id",
      email: "user@test.com",
      passwordHash: "hashed-password",
      name: "Test User",
      role: "USER",
      isActive: true,
    };

    it("should return user by email and tenantId", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail("user@test.com", "tenant-id");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email: "user@test.com",
            tenantId: "tenant-id",
          },
        },
      });
      expect(result).toEqual({
        id: "user-id",
        email: "user@test.com",
        passwordHash: "hashed-password",
        name: "Test User",
        role: "USER",
        tenantId: "tenant-id",
        isActive: true,
      });
    });

    it("should return null if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail(
        "nonexistent@test.com",
        "tenant-id",
      );

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    const mockUser = {
      id: "user-id",
      tenantId: "tenant-id",
      email: "user@test.com",
      passwordHash: "hashed-password",
      name: "Test User",
      role: "USER",
      isActive: true,
    };

    it("should return user by id", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById("user-id");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-id" },
      });
      expect(result).toEqual({
        id: "user-id",
        email: "user@test.com",
        passwordHash: "hashed-password",
        name: "Test User",
        role: "USER",
        tenantId: "tenant-id",
        isActive: true,
      });
    });

    it("should return null if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("validateUserPermissions", () => {
    const mockAdminUser = {
      id: "admin-id",
      role: "ADMIN",
      isActive: true,
    };

    const mockRegularUser = {
      id: "user-id",
      role: "USER",
      isActive: true,
    };

    const mockViewerUser = {
      id: "viewer-id",
      role: "VIEWER",
      isActive: true,
    };

    const mockInactiveUser = {
      id: "inactive-id",
      role: "ADMIN",
      isActive: false,
    };

    beforeEach(() => {
      // Spy on findById to control the returned user
      jest.spyOn(service, "findById");
    });

    it("should return true for ADMIN with required role ADMIN", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockAdminUser);

      const result = await service.validateUserPermissions("admin-id", [
        "ADMIN",
      ]);

      expect(result).toBe(true);
    });

    it("should return true for ADMIN with required role USER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockAdminUser);

      const result = await service.validateUserPermissions("admin-id", [
        "USER",
      ]);

      expect(result).toBe(true);
    });

    it("should return true for ADMIN with required role VIEWER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockAdminUser);

      const result = await service.validateUserPermissions("admin-id", [
        "VIEWER",
      ]);

      expect(result).toBe(true);
    });

    it("should return true for USER with required role USER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.validateUserPermissions("user-id", ["USER"]);

      expect(result).toBe(true);
    });

    it("should return true for USER with required role VIEWER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.validateUserPermissions("user-id", [
        "VIEWER",
      ]);

      expect(result).toBe(true);
    });

    it("should return false for USER with required role ADMIN", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.validateUserPermissions("user-id", [
        "ADMIN",
      ]);

      expect(result).toBe(false);
    });

    it("should return true for VIEWER with required role VIEWER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockViewerUser);

      const result = await service.validateUserPermissions("viewer-id", [
        "VIEWER",
      ]);

      expect(result).toBe(true);
    });

    it("should return false for VIEWER with required role USER", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockViewerUser);

      const result = await service.validateUserPermissions("viewer-id", [
        "USER",
      ]);

      expect(result).toBe(false);
    });

    it("should return false for inactive user", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockInactiveUser);

      const result = await service.validateUserPermissions("inactive-id", [
        "VIEWER",
      ]);

      expect(result).toBe(false);
    });

    it("should return false if user not found", async () => {
      (service.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUserPermissions("non-existent", [
        "VIEWER",
      ]);

      expect(result).toBe(false);
    });

    it("should return true if user has any of the required roles", async () => {
      (service.findById as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.validateUserPermissions("user-id", [
        "ADMIN",
        "USER",
      ]);

      expect(result).toBe(true);
    });

    it("should handle unknown roles gracefully", async () => {
      const mockUnknownRoleUser = {
        id: "unknown-id",
        role: "UNKNOWN",
        isActive: true,
      };

      (service.findById as jest.Mock).mockResolvedValue(mockUnknownRoleUser);

      const result = await service.validateUserPermissions("unknown-id", [
        "VIEWER",
      ]);

      expect(result).toBe(false);
    });
  });
});
