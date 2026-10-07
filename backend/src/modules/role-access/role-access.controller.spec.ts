import { Test, TestingModule } from "@nestjs/testing";
import { RoleAccessController } from "./role-access.controller";
import { RoleAccessService } from "./role-access.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("RoleAccessController", () => {
  let controller: RoleAccessController;
  const service = {
    getRoleAccessConfig: jest.fn(),
    getRoleSectionMap: jest.fn(),
    getSectionMapForUserRole: jest.fn(),
    updateRoleAccess: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoleAccessController],
      providers: [{ provide: RoleAccessService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(RoleAccessController);
  });

  afterEach(() => jest.clearAllMocks());

  it("getConfig delegates with the tenant id", async () => {
    service.getRoleAccessConfig.mockResolvedValue({ sections: [] });
    await controller.getConfig({ tenantId: "t1" });
    expect(service.getRoleAccessConfig).toHaveBeenCalledWith("t1");
  });

  it("getMine returns {} for ADMIN (all allowed)", async () => {
    service.getSectionMapForUserRole.mockResolvedValue(null);
    const res = await controller.getMine({
      tenantId: "t1",
      user: { role: "ADMIN" },
    });
    expect(res).toEqual({});
  });

  it("getMine returns the section map for USER", async () => {
    service.getSectionMapForUserRole.mockResolvedValue({ recipes: true });
    const res = await controller.getMine({
      tenantId: "t1",
      user: { role: "USER" },
    });
    expect(service.getSectionMapForUserRole).toHaveBeenCalledWith("t1", "USER");
    expect(res).toEqual({ recipes: true });
  });

  it("getMine returns the inherited map for USER_CUINER", async () => {
    service.getSectionMapForUserRole.mockResolvedValue({ albaranes: true });
    const res = await controller.getMine({
      tenantId: "t1",
      user: { role: "USER_CUINER" },
    });
    expect(service.getSectionMapForUserRole).toHaveBeenCalledWith(
      "t1",
      "USER_CUINER",
    );
    expect(res).toEqual({ albaranes: true });
  });

  it("update forwards tenant, user id and dto", async () => {
    const dto = { USER: { "recipes.cost": false } };
    await controller.update({ tenantId: "t1", user: { id: "u1" } }, dto);
    expect(service.updateRoleAccess).toHaveBeenCalledWith("t1", "u1", dto);
  });
});
