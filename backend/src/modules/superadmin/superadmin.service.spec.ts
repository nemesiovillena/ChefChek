import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SuperadminService } from "./superadmin.service";
import { ModulesService } from "../modules/modules.service";
import { TenantsService } from "../tenants/tenants.service";

describe("SuperadminService", () => {
  let service: SuperadminService;
  let modulesService: jest.Mocked<
    Pick<ModulesService, "getModules" | "toggleModule">
  >;
  let tenantsService: jest.Mocked<
    Pick<TenantsService, "findAll" | "findOne" | "update">
  >;

  beforeEach(async () => {
    const mockModulesService = {
      getModules: jest.fn(),
      toggleModule: jest.fn(),
    };
    const mockTenantsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperadminService,
        { provide: ModulesService, useValue: mockModulesService },
        { provide: TenantsService, useValue: mockTenantsService },
      ],
    }).compile();

    service = module.get<SuperadminService>(SuperadminService);
    modulesService = module.get(ModulesService);
    tenantsService = module.get(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listTenants", () => {
    it("should delegate to tenantsService.findAll with pagination", async () => {
      const expected = {
        success: true,
        data: [{ id: "t-1", name: "Tenant 1" }],
        meta: { total: 1, page: 1, limit: 20 },
      };
      tenantsService.findAll.mockResolvedValue(expected as any);

      const result = await service.listTenants(1, 20);

      expect(tenantsService.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(expected);
    });
  });

  describe("getTenantModules", () => {
    it("should assert tenant exists and return its modules", async () => {
      const modules = [
        {
          id: "core",
          name: "Core",
          enabled: true,
          alwaysActive: true,
          dependencies: [],
          description: "Core",
        },
      ];
      tenantsService.findOne.mockResolvedValue({ success: true } as any);
      modulesService.getModules.mockResolvedValue(modules as any);

      const result = await service.getTenantModules("t-1");

      expect(tenantsService.findOne).toHaveBeenCalledWith("t-1");
      expect(modulesService.getModules).toHaveBeenCalledWith("t-1");
      expect(result).toEqual(modules);
    });

    it("should throw when tenant does not exist", async () => {
      tenantsService.findOne.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(service.getTenantModules("missing")).rejects.toThrow(
        NotFoundException,
      );
      expect(modulesService.getModules).not.toHaveBeenCalled();
    });
  });

  describe("toggleTenantModule", () => {
    it("should assert tenant exists and delegate toggle to modulesService", async () => {
      const dto = { enabled: false };
      tenantsService.findOne.mockResolvedValue({ success: true } as any);
      modulesService.toggleModule.mockResolvedValue({
        id: "almacenes",
        enabled: false,
      } as any);

      const result = await service.toggleTenantModule(
        "t-1",
        "almacenes",
        dto,
        "sa-user-1",
      );

      expect(tenantsService.findOne).toHaveBeenCalledWith("t-1");
      expect(modulesService.toggleModule).toHaveBeenCalledWith(
        "t-1",
        "almacenes",
        dto,
        "sa-user-1",
      );
      expect(result).toEqual({ id: "almacenes", enabled: false });
    });

    it("should throw when tenant does not exist", async () => {
      tenantsService.findOne.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        service.toggleTenantModule(
          "missing",
          "almacenes",
          { enabled: true },
          "u",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(modulesService.toggleModule).not.toHaveBeenCalled();
    });
  });

  describe("updateTenant", () => {
    it("should assert tenant exists and delegate update to tenantsService", async () => {
      const dto = { name: "New Name" };
      tenantsService.findOne.mockResolvedValue({ success: true } as any);
      tenantsService.update.mockResolvedValue({
        success: true,
        data: { id: "t-1", name: "New Name" },
      } as any);

      const result = await service.updateTenant("t-1", dto);

      expect(tenantsService.findOne).toHaveBeenCalledWith("t-1");
      expect(tenantsService.update).toHaveBeenCalledWith("t-1", dto);
      expect(result.data.name).toBe("New Name");
    });

    it("should throw when tenant does not exist", async () => {
      tenantsService.findOne.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        service.updateTenant("missing", { name: "x" }),
      ).rejects.toThrow(NotFoundException);
      expect(tenantsService.update).not.toHaveBeenCalled();
    });
  });
});
