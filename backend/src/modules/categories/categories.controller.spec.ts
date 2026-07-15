import { Test, TestingModule } from "@nestjs/testing";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("CategoriesController", () => {
  let controller: CategoriesController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getTree: jest.fn(),
  };

  const mockReq = { tenantId: "t1" };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  afterEach(() => jest.clearAllMocks());

  it("create delegates to service with tenantId", async () => {
    mockService.create.mockResolvedValue({ id: "c1" });
    const dto = { name: "C", slug: "c", context: "articles" };
    await controller.create(mockReq, dto as any);
    expect(mockService.create).toHaveBeenCalledWith("t1", dto);
  });

  describe("findAll context validation", () => {
    it("passes 'articles' context as valid", async () => {
      mockService.findAll.mockResolvedValue([]);
      await controller.findAll(mockReq, "articles");
      expect(mockService.findAll).toHaveBeenCalledWith("t1", "articles");
    });

    it("passes 'recipes' context as valid", async () => {
      mockService.findAll.mockResolvedValue([]);
      await controller.findAll(mockReq, "recipes");
      expect(mockService.findAll).toHaveBeenCalledWith("t1", "recipes");
    });

    it("normalizes an invalid context to undefined", async () => {
      mockService.findAll.mockResolvedValue([]);
      await controller.findAll(mockReq, "bogus");
      expect(mockService.findAll).toHaveBeenCalledWith("t1", undefined);
    });

    it("normalizes a missing context to undefined", async () => {
      mockService.findAll.mockResolvedValue([]);
      await controller.findAll(mockReq, undefined);
      expect(mockService.findAll).toHaveBeenCalledWith("t1", undefined);
    });
  });

  describe("getTree context validation", () => {
    it("passes a valid context through", async () => {
      mockService.getTree.mockResolvedValue([]);
      await controller.getTree(mockReq, "articles");
      expect(mockService.getTree).toHaveBeenCalledWith("t1", "articles");
    });

    it("normalizes an invalid context to undefined", async () => {
      mockService.getTree.mockResolvedValue([]);
      await controller.getTree(mockReq, "nope");
      expect(mockService.getTree).toHaveBeenCalledWith("t1", undefined);
    });
  });

  it("findOne delegates", async () => {
    mockService.findOne.mockResolvedValue({ id: "c1" });
    await controller.findOne(mockReq, "c1");
    expect(mockService.findOne).toHaveBeenCalledWith("t1", "c1");
  });

  it("update delegates", async () => {
    mockService.update.mockResolvedValue({ id: "c1" });
    const dto = { name: "updated" };
    await controller.update(mockReq, "c1", dto as any);
    expect(mockService.update).toHaveBeenCalledWith("t1", "c1", dto);
  });

  it("remove delegates", async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove(mockReq, "c1");
    expect(mockService.remove).toHaveBeenCalledWith("t1", "c1");
  });
});
