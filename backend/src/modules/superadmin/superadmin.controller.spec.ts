import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SuperadminController } from "./superadmin.controller";
import { SuperadminService } from "./superadmin.service";
import { AuthGuard } from "../../guards/auth.guard";
import { SuperadminGuard } from "../../guards/superadmin.guard";

describe("SuperadminController", () => {
  let controller: SuperadminController;
  let service: jest.Mocked<SuperadminService>;

  const mockSuperadminService = {
    listTenants: jest.fn(),
    getTenantModules: jest.fn(),
    toggleTenantModule: jest.fn(),
    updateTenant: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuperadminController],
      providers: [
        { provide: SuperadminService, useValue: mockSuperadminService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperadminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SuperadminController>(SuperadminController);
    service = module.get(SuperadminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listTenants", () => {
    it("should list all tenants with default pagination", async () => {
      const expected = {
        success: true,
        data: [{ id: "t-1", name: "Tenant 1" }],
        meta: { total: 1, page: 1, limit: 20 },
      };
      service.listTenants.mockResolvedValue(expected as any);

      const result = await controller.listTenants();

      expect(service.listTenants).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(expected);
    });

    it("should coerce string pagination params to numbers", async () => {
      service.listTenants.mockResolvedValue({ success: true } as any);

      await controller.listTenants("2", "10");

      expect(service.listTenants).toHaveBeenCalledWith(2, 10);
    });
  });

  describe("getTenantModules", () => {
    it("should return modules for a specific tenant", async () => {
      const modules = [{ id: "core", name: "Core", enabled: true }];
      service.getTenantModules.mockResolvedValue(modules as any);

      const result = await controller.getTenantModules("t-1");

      expect(service.getTenantModules).toHaveBeenCalledWith("t-1");
      expect(result).toEqual(modules);
    });

    it("should propagate 404 when tenant does not exist", async () => {
      service.getTenantModules.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(controller.getTenantModules("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("toggleTenantModule", () => {
    it("should delegate toggle with the authenticated user id", async () => {
      const dto = { enabled: false };
      const updated = { id: "almacenes", enabled: false };
      service.toggleTenantModule.mockResolvedValue(updated as any);

      const result = await controller.toggleTenantModule(
        "t-1",
        "almacenes",
        dto,
        {
          user: { id: "sa-user-1" },
        },
      );

      expect(service.toggleTenantModule).toHaveBeenCalledWith(
        "t-1",
        "almacenes",
        dto,
        "sa-user-1",
      );
      expect(result).toEqual(updated);
    });

    it("should propagate 404 when tenant does not exist", async () => {
      service.toggleTenantModule.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        controller.toggleTenantModule(
          "missing",
          "almacenes",
          { enabled: true },
          { user: { id: "u" } },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateTenant", () => {
    it("should delegate tenant update", async () => {
      const dto = { name: "New Name" };
      const updated = {
        success: true,
        data: { id: "t-1", name: "New Name" },
      };
      service.updateTenant.mockResolvedValue(updated as any);

      const result = await controller.updateTenant("t-1", dto);

      expect(service.updateTenant).toHaveBeenCalledWith("t-1", dto);
      expect(result).toEqual(updated);
    });

    it("should propagate 404 when tenant does not exist", async () => {
      service.updateTenant.mockRejectedValue(
        new NotFoundException("Tenant not found"),
      );

      await expect(
        controller.updateTenant("missing", { name: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
