import { Test, TestingModule } from "@nestjs/testing";
import { ConocimientoController } from "./conocimiento.controller";
import { ConocimientoService } from "./conocimiento.service";
import {
  CreateKnowledgeCategoryDto,
  UpdateKnowledgeCategoryDto,
  CreateKnowledgeArticleDto,
  UpdateKnowledgeArticleDto,
  PublishArticleDto,
  CreateKnowledgeTagDto,
  UpdateKnowledgeTagDto,
  KnowledgeQueryDto,
  RestoreVersionDto,
} from "./dto/conocimiento.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("ConocimientoController", () => {
  let controller: ConocimientoController;

  const mockConocimientoService = {
    createCategory: jest.fn(),
    getCategories: jest.fn(),
    getCategoryTree: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    createArticle: jest.fn(),
    getArticles: jest.fn(),
    getArticleById: jest.fn(),
    updateArticle: jest.fn(),
    publishArticle: jest.fn(),
    deleteArticle: jest.fn(),
    getArticleVersions: jest.fn(),
    restoreArticleVersion: jest.fn(),
    createTag: jest.fn(),
    getTags: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConocimientoController],
      providers: [
        { provide: ConocimientoService, useValue: mockConocimientoService },
      ],
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

    controller = module.get<ConocimientoController>(ConocimientoController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createCategory", () => {
    it("should create a category", async () => {
      const dto: CreateKnowledgeCategoryDto = {
        name: "Category 1",
        slug: "category-1",
      };
      const mockCategory = { id: "cat-1", ...dto };
      mockConocimientoService.createCategory.mockResolvedValue({
        success: true,
        data: mockCategory,
      });

      const result = await controller.createCategory(mockReq as any, dto);

      expect(mockConocimientoService.createCategory).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getCategories", () => {
    it("should return root categories when no parentId", async () => {
      const mockCategories = [{ id: "cat-1", name: "Category 1" }];
      mockConocimientoService.getCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories(mockReq as any, undefined);

      expect(mockConocimientoService.getCategories).toHaveBeenCalledWith(
        "tenant-1",
        undefined,
      );
      expect(result).toEqual(mockCategories);
    });

    it("should return child categories when parentId is provided", async () => {
      const mockChildren = [{ id: "cat-2", parentId: "cat-1" }];
      mockConocimientoService.getCategories.mockResolvedValue(mockChildren);

      const result = await controller.getCategories(mockReq as any, "cat-1");

      expect(mockConocimientoService.getCategories).toHaveBeenCalledWith(
        "tenant-1",
        "cat-1",
      );
    });
  });

  describe("getCategoryTree", () => {
    it("should return hierarchical category tree", async () => {
      const mockTree = [{ id: "cat-1", children: [{ id: "cat-2" }] }];
      mockConocimientoService.getCategoryTree.mockResolvedValue({
        success: true,
        data: mockTree,
      });

      const result = await controller.getCategoryTree(mockReq as any);

      expect(mockConocimientoService.getCategoryTree).toHaveBeenCalledWith(
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("updateCategory", () => {
    it("should update a category", async () => {
      const dto: UpdateKnowledgeCategoryDto = { name: "Updated Name" };
      mockConocimientoService.updateCategory.mockResolvedValue({
        success: true,
      });

      const result = await controller.updateCategory(
        mockReq as any,
        "cat-1",
        dto,
      );

      expect(mockConocimientoService.updateCategory).toHaveBeenCalledWith(
        "cat-1",
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteCategory", () => {
    it("should delete a category", async () => {
      mockConocimientoService.deleteCategory.mockResolvedValue({
        success: true,
      });

      const result = await controller.deleteCategory(mockReq as any, "cat-1");

      expect(mockConocimientoService.deleteCategory).toHaveBeenCalledWith(
        "cat-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("createArticle", () => {
    it("should create an article", async () => {
      const dto: CreateKnowledgeArticleDto = {
        title: "Article 1",
        slug: "article-1",
        content: { type: "doc", content: [] },
      };
      const mockArticle = { id: "art-1", ...dto };
      mockConocimientoService.createArticle.mockResolvedValue({
        success: true,
        data: mockArticle,
      });

      const result = await controller.createArticle(mockReq as any, dto);

      expect(mockConocimientoService.createArticle).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getArticles", () => {
    it("should return articles matching query", async () => {
      const query: KnowledgeQueryDto = { search: "test" };
      const mockArticles = [{ id: "art-1", title: "Test Article" }];
      mockConocimientoService.getArticles.mockResolvedValue({
        success: true,
        data: mockArticles,
      });

      const result = await controller.getArticles(mockReq as any, query);

      expect(mockConocimientoService.getArticles).toHaveBeenCalledWith(
        "tenant-1",
        query,
      );
      expect(result.success).toBe(true);
    });

    it("should filter by category and status", async () => {
      const query: KnowledgeQueryDto = {
        categoryId: "cat-1",
        status: "PUBLISHED",
      };
      mockConocimientoService.getArticles.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getArticles(mockReq as any, query);

      expect(mockConocimientoService.getArticles).toHaveBeenCalledWith(
        "tenant-1",
        query,
      );
    });
  });

  describe("getArticleById", () => {
    it("should return a single article", async () => {
      const mockArticle = { id: "art-1", title: "Article 1" };
      mockConocimientoService.getArticleById.mockResolvedValue({
        success: true,
        data: mockArticle,
      });

      const result = await controller.getArticleById(mockReq as any, "art-1");

      expect(mockConocimientoService.getArticleById).toHaveBeenCalledWith(
        "art-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("updateArticle", () => {
    it("should update an article", async () => {
      const dto: UpdateKnowledgeArticleDto = { title: "Updated Title" };
      mockConocimientoService.updateArticle.mockResolvedValue({
        success: true,
      });

      const result = await controller.updateArticle(
        mockReq as any,
        "art-1",
        dto,
      );

      expect(mockConocimientoService.updateArticle).toHaveBeenCalledWith(
        "art-1",
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("publishArticle", () => {
    it("should publish an article", async () => {
      const dto: PublishArticleDto = { changeNote: "Published version" };
      mockConocimientoService.publishArticle.mockResolvedValue({
        success: true,
      });

      const result = await controller.publishArticle(
        mockReq as any,
        "art-1",
        dto,
      );

      expect(mockConocimientoService.publishArticle).toHaveBeenCalledWith(
        "art-1",
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteArticle", () => {
    it("should delete an article", async () => {
      mockConocimientoService.deleteArticle.mockResolvedValue({
        success: true,
      });

      const result = await controller.deleteArticle(mockReq as any, "art-1");

      expect(mockConocimientoService.deleteArticle).toHaveBeenCalledWith(
        "art-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getArticleVersions", () => {
    it("should return article versions", async () => {
      const mockVersions = [{ version: 1 }, { version: 2 }];
      mockConocimientoService.getArticleVersions.mockResolvedValue({
        success: true,
        data: mockVersions,
      });

      const result = await controller.getArticleVersions(
        mockReq as any,
        "art-1",
      );

      expect(mockConocimientoService.getArticleVersions).toHaveBeenCalledWith(
        "art-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("restoreArticleVersion", () => {
    it("should restore article to a specific version", async () => {
      const dto: RestoreVersionDto = { changeNote: "Restored to v1" };
      mockConocimientoService.restoreArticleVersion.mockResolvedValue({
        success: true,
      });

      const result = await controller.restoreArticleVersion(
        mockReq as any,
        "ver-1",
        dto,
      );

      expect(
        mockConocimientoService.restoreArticleVersion,
      ).toHaveBeenCalledWith("ver-1", "tenant-1", "user-1", dto);
      expect(result.success).toBe(true);
    });
  });

  describe("createTag", () => {
    it("should create a tag", async () => {
      const dto: CreateKnowledgeTagDto = { name: "Tag 1", slug: "tag-1" };
      const mockTag = { id: "tag-1", ...dto };
      mockConocimientoService.createTag.mockResolvedValue({
        success: true,
        data: mockTag,
      });

      const result = await controller.createTag(mockReq as any, dto);

      expect(mockConocimientoService.createTag).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getTags", () => {
    it("should return all tags for tenant", async () => {
      const mockTags = [{ id: "tag-1", name: "Tag 1" }];
      mockConocimientoService.getTags.mockResolvedValue(mockTags);

      const result = await controller.getTags(mockReq as any);

      expect(mockConocimientoService.getTags).toHaveBeenCalledWith("tenant-1");
      expect(result).toEqual(mockTags);
    });
  });

  describe("updateTag", () => {
    it("should update a tag", async () => {
      const dto: UpdateKnowledgeTagDto = { name: "Updated Tag" };
      mockConocimientoService.updateTag.mockResolvedValue({ success: true });

      const result = await controller.updateTag(mockReq as any, "tag-1", dto);

      expect(mockConocimientoService.updateTag).toHaveBeenCalledWith(
        "tag-1",
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteTag", () => {
    it("should delete a tag", async () => {
      mockConocimientoService.deleteTag.mockResolvedValue({ success: true });

      const result = await controller.deleteTag(mockReq as any, "tag-1");

      expect(mockConocimientoService.deleteTag).toHaveBeenCalledWith(
        "tag-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });
});
