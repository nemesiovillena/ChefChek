import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { RoleAccessService } from "./role-access.service";
import { PrismaService } from "../../common/services/prisma.service";
import { ModulesService } from "../modules/modules.service";
import { SECTION_REGISTRY } from "./constants/section-registry";

describe("RoleAccessService", () => {
  let service: RoleAccessService;
  let prisma: any;
  let modules: any;

  const tenantId = "tenant-1";
  const userId = "user-1";

  const allModulesEnabled = SECTION_REGISTRY.filter((s) => s.moduleId).map(
    (s) => ({ id: s.moduleId as string, enabled: true }),
  );

  beforeEach(async () => {
    prisma = {
      configuration: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    modules = {
      getModules: jest.fn().mockResolvedValue(allModulesEnabled),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RoleAccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: ModulesService, useValue: modules },
      ],
    }).compile();

    service = moduleRef.get(RoleAccessService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getRoleSectionMap", () => {
    it("returns every section allowed when there is no config", async () => {
      const map = await service.getRoleSectionMap(tenantId, "USER");
      for (const section of SECTION_REGISTRY) {
        expect(map[section.key]).toBe(true);
      }
    });

    it("honours an explicit false row", async () => {
      prisma.configuration.findMany.mockResolvedValue([
        { key: "roleAccess.USER.recipes.cost", value: "false" },
      ]);
      const map = await service.getRoleSectionMap(tenantId, "USER");
      expect(map["recipes.cost"]).toBe(false);
      expect(map["recipes"]).toBe(true);
    });

    it("forces a section to false when its module is disabled for the tenant", async () => {
      modules.getModules.mockResolvedValue(
        allModulesEnabled.map((m) =>
          m.id === "compras" ? { ...m, enabled: false } : m,
        ),
      );
      const map = await service.getRoleSectionMap(tenantId, "USER");
      expect(map["compras"]).toBe(false);
    });

    it("scopes config rows to the requested role prefix", async () => {
      prisma.configuration.findMany.mockResolvedValue([
        { key: "roleAccess.VIEWER.compras", value: "false" },
      ]);
      const map = await service.getRoleSectionMap(tenantId, "USER");
      // USER unaffected by a VIEWER row
      expect(map["compras"]).toBe(true);
    });
  });

  describe("isSectionAllowed", () => {
    it("bypasses gating for ADMIN / OWNER / SUPERADMIN", async () => {
      for (const role of ["ADMIN", "OWNER", "SUPERADMIN"]) {
        expect(await service.isSectionAllowed(tenantId, role, "compras")).toBe(
          true,
        );
      }
      expect(prisma.configuration.findMany).not.toHaveBeenCalled();
    });

    it("denies unknown or roleless callers", async () => {
      expect(
        await service.isSectionAllowed(tenantId, undefined, "recipes"),
      ).toBe(false);
      expect(await service.isSectionAllowed(tenantId, "GHOST", "recipes")).toBe(
        false,
      );
    });

    it("returns the configured value for USER", async () => {
      prisma.configuration.findMany.mockResolvedValue([
        { key: "roleAccess.USER.almacenes", value: "false" },
      ]);
      expect(
        await service.isSectionAllowed(tenantId, "USER", "almacenes"),
      ).toBe(false);
      expect(await service.isSectionAllowed(tenantId, "USER", "recipes")).toBe(
        true,
      );
    });

    it("treats an unknown section key as allowed", async () => {
      expect(
        await service.isSectionAllowed(tenantId, "USER", "not-a-section"),
      ).toBe(true);
    });
  });

  describe("updateRoleAccess", () => {
    it("upserts a Configuration row per (role, section) pair", async () => {
      await service.updateRoleAccess(tenantId, userId, {
        USER: { "recipes.cost": false, production: true },
      });
      expect(prisma.configuration.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: { tenantId, key: "roleAccess.USER.recipes.cost" },
          },
          create: expect.objectContaining({
            value: "false",
            category: "ROLE_ACCESS",
            updatedBy: userId,
          }),
          update: { value: "false", updatedBy: userId },
        }),
      );
    });

    it("rejects unknown section keys", async () => {
      await expect(
        service.updateRoleAccess(tenantId, userId, {
          USER: { "made.up": false },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.configuration.upsert).not.toHaveBeenCalled();
    });

    it("ignores roles that are not in the payload", async () => {
      await service.updateRoleAccess(tenantId, userId, {
        VIEWER: { compras: false },
      });
      expect(prisma.configuration.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: { tenantId, key: "roleAccess.VIEWER.compras" },
          },
        }),
      );
    });
  });

  describe("getRoleAccessConfig", () => {
    it("omits sections whose module is disabled", async () => {
      modules.getModules.mockResolvedValue(
        allModulesEnabled.map((m) =>
          m.id === "appcc" ? { ...m, enabled: false } : m,
        ),
      );
      const config = await service.getRoleAccessConfig(tenantId);
      expect(config.sections.find((s) => s.key === "appcc")).toBeUndefined();
      // transversal sections (no moduleId) always listed
      expect(config.sections.find((s) => s.key === "papelera")).toBeDefined();
      expect(config.USER).toBeDefined();
      expect(config.VIEWER).toBeDefined();
    });
  });
});
