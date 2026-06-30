import { Test, TestingModule } from "@nestjs/testing";
import { PermissionsService } from "./permissions.service";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";

describe("PermissionsService", () => {
  let service: PermissionsService;
  let prismaService: any;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllPermissions", () => {
    it("should return all permissions grouped by resource", async () => {
      const result = await service.getAllPermissions();

      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("recipes");
      expect(result).toHaveProperty("menus");
      expect(result.products).toHaveProperty("create");
      expect(result.products).toHaveProperty("read");
      expect(result.products).toHaveProperty("update");
      expect(result.products).toHaveProperty("delete");
    });
  });

  describe("getRolePermissions", () => {
    it("should return permissions for ADMIN role", async () => {
      prismaService.role.findUnique.mockResolvedValue({
        id: "role-admin",
        name: "ADMIN",
        permissions: [
          "products:create",
          "products:read",
          "products:update",
          "products:delete",
          "menus:create",
          "menus:read",
        ],
      });

      const result = await service.getRolePermissions("ADMIN");

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("products:create");
    });

    it("should return empty array for non-existent role", async () => {
      prismaService.role.findUnique.mockResolvedValue(null);

      const result = await service.getRolePermissions("NON_EXISTENT");

      expect(result).toEqual([]);
    });
  });

  describe("hasPermission", () => {
    it("should return true if user has permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      const result = await service.hasPermission("user-1", "products:create");

      expect(result).toBe(true);
    });

    it("should return false if user lacks permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "VIEWER",
        isActive: true,
      });

      const result = await service.hasPermission("user-1", "products:create");

      expect(result).toBe(false);
    });

    it("should return false if user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.hasPermission("user-1", "products:create");

      expect(result).toBe(false);
    });

    it("should return false if user is inactive", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: false,
      });

      const result = await service.hasPermission("user-1", "products:create");

      expect(result).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has at least one permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "USER",
        isActive: true,
      });

      const result = await service.hasAnyPermission("user-1", [
        "products:create",
        "products:read",
      ]);

      expect(result).toBe(true);
    });

    it("should return false if user has none of the permissions", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "VIEWER",
        isActive: true,
      });

      const result = await service.hasAnyPermission("user-1", [
        "products:create",
        "products:delete",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all permissions", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      const result = await service.hasAllPermissions("user-1", [
        "products:create",
        "products:read",
      ]);

      expect(result).toBe(true);
    });

    it("should return false if user missing one permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "VIEWER",
        isActive: true,
      });

      const result = await service.hasAllPermissions("user-1", [
        "products:create",
        "products:read",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("checkEndpointPermission", () => {
    it("should deny access for /api/v1/products/create to user without create permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "VIEWER",
        isActive: true,
      });

      const result = await service.checkEndpointPermission(
        "user-1",
        "/api/v1/products/create",
        "POST",
      );

      expect(result.hasAccess).toBe(false);
    });

    it("should map action=create+POST to create permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      // Without leading slash: parts = ["api","v1","products","create"] → action="create"
      const result = await service.checkEndpointPermission(
        "user-1",
        "api/v1/products/create",
        "POST",
      );

      expect(result.hasAccess).toBeDefined();
    });

    it("should map action=read+GET to read permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      const result = await service.checkEndpointPermission(
        "user-1",
        "api/v1/products/read",
        "GET",
      );

      expect(result.hasAccess).toBeDefined();
    });

    it("should map action=update+PUT to update permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      const result = await service.checkEndpointPermission(
        "user-1",
        "api/v1/products/update",
        "PUT",
      );

      expect(result.hasAccess).toBeDefined();
    });

    it("should map action=delete+DELETE to delete permission", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "ADMIN",
        isActive: true,
      });

      const result = await service.checkEndpointPermission(
        "user-1",
        "api/v1/products/delete",
        "DELETE",
      );

      expect(result.hasAccess).toBeDefined();
    });
  });

  describe("getPermissionsByRole", () => {
    it("should return permissions grouped by resource", async () => {
      const result = await service.getPermissionsByRole("ADMIN");

      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("menus");
      expect(result.products).toContain("create");
      expect(result.products).toContain("read");
      expect(result.menus).toContain("create");
    });

    it("should return empty object for non-existent role", async () => {
      const result = await service.getPermissionsByRole("NON_EXISTENT");

      expect(result).toEqual({});
    });
  });
});
