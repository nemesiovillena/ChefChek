import { Test, TestingModule } from "@nestjs/testing";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModulesController],
      providers: [{ provide: ModulesService, useValue: mockModulesService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
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
    it("should toggle module activation state", async () => {
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

      const result = await controller.toggleModule(moduleId, dto, mockReq);

      expect(mockModulesService.toggleModule).toHaveBeenCalledWith(
        mockReq.tenantId,
        moduleId,
        dto,
        mockReq.user.id,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
