import { Test, TestingModule } from "@nestjs/testing";
import { TenantMiddleware } from "./tenant.middleware";
import { TenantsService } from "../modules/tenants/tenants.service";

describe("TenantMiddleware", () => {
  let middleware: TenantMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantMiddleware, { provide: TenantsService, useValue: {} }],
    }).compile();
    middleware = module.get<TenantMiddleware>(TenantMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  it("skips tenant resolution for public routes", async () => {
    const req: any = { path: "/health", user: { tenantId: "t1" } };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.tenantId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("resolves tenantId and tenantSlug from the authenticated user", async () => {
    const req: any = {
      // Path that does NOT start with "/" so the catch-all public route "/"
      // does not short-circuit, exercising the tenant-resolution branch.
      path: "internal",
      user: { tenantId: "t1", slug: "tenant-slug" },
    };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.tenantId).toBe("t1");
    expect(req.tenantSlug).toBe("tenant-slug");
    expect(next).toHaveBeenCalled();
  });

  it("falls back to nested tenant slug when user.slug is absent", async () => {
    const req: any = {
      // Path that does NOT start with "/" so the catch-all public route "/"
      // does not short-circuit, exercising the tenant-resolution branch.
      path: "internal",
      user: { tenantId: "t1", tenant: { slug: "nested-slug" } },
    };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.tenantSlug).toBe("nested-slug");
  });

  it("does not set tenant when user is absent (guard handles it)", async () => {
    const req: any = { path: "/api/v1/products" };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.tenantId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
