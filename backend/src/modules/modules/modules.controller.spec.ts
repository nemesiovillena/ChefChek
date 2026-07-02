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
    it("should return all active modules for the authenticated tenant", async () => {
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

      expect(service.getModules).toHaveBeenCalledWith(mockReq.tenantId);
      expect(result).toEqual(mockResult);
    });

    it("should work for any authenticated tenant role", async () => {
      // The endpoint is read-only for all tenant users (OWNER included).
      // Module management moved to the SUPERADMIN panel.
      mockModulesService.getModules.mockResolvedValue([]);

      await controller.getModules(mockReq);

      expect(service.getModules).toHaveBeenCalledTimes(1);
    });
  });
});
