import { Test, TestingModule } from "@nestjs/testing";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { RolesGuard, ROLES_KEY } from "../../guards/roles.guard";
import { UsersService } from "../../modules/users/users.service";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";

describe("ModulesController", () => {
  let controller: ModulesController;
  let service: ModulesService;

  const mockModulesService = {
    getModules: jest.fn(),
    toggleModule: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const mockUsersService = {
      validateUserPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModulesController],
      providers: [
        { provide: ModulesService, useValue: mockModulesService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: Reflector, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ModulesController>(ModulesController);
    service = module.get<ModulesService>(ModulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getModules", () => {
    it("should return all modules for a tenant", async () => {
      const mockResult = [
        {
          id: "core",
          name: "Core",
          description: "Core functionality",
          dependencies: [],
          alwaysActive: true,
          enabled: true,
        },
      ];
      mockModulesService.getModules.mockResolvedValue(mockResult);

      const result = await controller.getModules(mockReq);

      expect(mockModulesService.getModules).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("toggleModule", () => {
    it("should toggle module activation state for OWNER", async () => {
      const moduleId = "almacenes";
      const dto = { enabled: false };
      const mockResult = {
        id: "almacenes",
        name: "Almacenes",
        description: "Warehouse module",
        dependencies: [],
        alwaysActive: false,
        enabled: false,
      };
      mockModulesService.toggleModule.mockResolvedValue(mockResult);

      // Update mock req for OWNER user
      const mockOwnerReq = {
        tenantId: "tenant-test-123",
        user: { id: "user-owner-1", role: "OWNER" },
      };

      const result = await controller.toggleModule(moduleId, dto, mockOwnerReq);

      expect(mockModulesService.toggleModule).toHaveBeenCalledWith(
        mockOwnerReq.tenantId,
        moduleId,
        dto,
        mockOwnerReq.user.id,
      );
      expect(result).toEqual(mockResult);
    });

    it("should require OWNER role for toggleModule", () => {
      // Guards run at the HTTP layer, not on direct method calls. Verify the
      // @Roles("OWNER") metadata is applied to the handler — RolesGuard
      // enforces it when the request goes through Nest's guard pipeline.
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        ModulesController.prototype.toggleModule,
      );
      expect(roles).toEqual(["OWNER"]);
    });
  });
});
