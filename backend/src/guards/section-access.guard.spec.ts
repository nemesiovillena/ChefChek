import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import {
  SectionAccessGuard,
  SECTION_METADATA_KEY,
  SECTION_ANY_METADATA_KEY,
} from "./section-access.guard";
import { RoleAccessService } from "../modules/role-access/role-access.service";

describe("SectionAccessGuard", () => {
  let guard: SectionAccessGuard;
  let reflector: Reflector;
  let roleAccess: { isSectionAllowed: jest.Mock };

  const makeContext = (
    classKeys: string[] | undefined,
    handlerKeys: string[] | undefined,
    req: any,
    anyKeys?: string[],
  ): ExecutionContext => {
    jest.spyOn(reflector, "get").mockImplementation((key: any, target: any) => {
      if (key === SECTION_ANY_METADATA_KEY) {
        return target === "HANDLER" ? anyKeys : undefined;
      }
      if (key !== SECTION_METADATA_KEY) {
        return undefined;
      }
      return target === "CLASS" ? classKeys : handlerKeys;
    });
    return {
      getClass: () => "CLASS",
      getHandler: () => "HANDLER",
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    roleAccess = { isSectionAllowed: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SectionAccessGuard,
        Reflector,
        { provide: RoleAccessService, useValue: roleAccess },
      ],
    }).compile();
    guard = moduleRef.get(SectionAccessGuard);
    reflector = moduleRef.get(Reflector);
  });

  afterEach(() => jest.clearAllMocks());

  it("allows when no metadata is present", async () => {
    const ctx = makeContext(undefined, undefined, { user: { role: "USER" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(roleAccess.isSectionAllowed).not.toHaveBeenCalled();
  });

  it("allows ADMIN without consulting the service", async () => {
    const ctx = makeContext(["recipes"], undefined, {
      user: { role: "ADMIN" },
      tenantId: "t1",
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(roleAccess.isSectionAllowed).not.toHaveBeenCalled();
  });

  it("allows a USER with the section granted", async () => {
    roleAccess.isSectionAllowed.mockResolvedValue(true);
    const ctx = makeContext(["recipes"], undefined, {
      user: { role: "USER" },
      tenantId: "t1",
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("throws SECTION_HIDDEN for a USER without the section", async () => {
    roleAccess.isSectionAllowed.mockResolvedValue(false);
    const ctx = makeContext(["almacenes"], undefined, {
      user: { role: "USER" },
      tenantId: "t1",
    });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { error: "SECTION_HIDDEN", section: "almacenes" },
    });
  });

  it("treats multiple keys on one level as OR", async () => {
    roleAccess.isSectionAllowed.mockImplementation(
      (_t: string, _r: string, key: string) =>
        Promise.resolve(key === "production.tasks"),
    );
    const ctx = makeContext(["production", "production.tasks"], undefined, {
      user: { role: "USER" },
      tenantId: "t1",
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("combines class and handler metadata with AND", async () => {
    roleAccess.isSectionAllowed.mockImplementation(
      (_t: string, _r: string, key: string) =>
        Promise.resolve(key === "recipes"), // recipes ok, recipes.cost not
    );
    const ctx = makeContext(["recipes"], ["recipes.cost"], {
      user: { role: "USER" },
      tenantId: "t1",
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("requires tenant context for a non-bypass role", async () => {
    const ctx = makeContext(["recipes"], undefined, { user: { role: "USER" } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  describe("@RequireSectionAny (handler overrides class)", () => {
    it("grants access on any listed key, IGNORING the denied class key", async () => {
      // production (class) denied, production.tasks (any) allowed → still passes
      roleAccess.isSectionAllowed.mockImplementation(
        (_t: string, _r: string, key: string) =>
          Promise.resolve(key === "production.tasks"),
      );
      const ctx = makeContext(
        ["production"],
        undefined,
        { user: { role: "USER" }, tenantId: "t1" },
        ["production", "production.tasks"],
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it("denies when none of the any-keys is allowed", async () => {
      roleAccess.isSectionAllowed.mockResolvedValue(false);
      const ctx = makeContext(
        ["production"],
        undefined,
        { user: { role: "USER" }, tenantId: "t1" },
        ["production", "production.tasks"],
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { error: "SECTION_HIDDEN" },
      });
    });

    it("still bypasses for ADMIN", async () => {
      const ctx = makeContext(
        ["production"],
        undefined,
        { user: { role: "ADMIN" }, tenantId: "t1" },
        ["production.tasks"],
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(roleAccess.isSectionAllowed).not.toHaveBeenCalled();
    });
  });
});
