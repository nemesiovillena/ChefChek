import { Test, TestingModule } from "@nestjs/testing";
import { ConocimientoService } from "./conocimiento.service";
import { PrismaService } from "../../common/services/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
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

describe("ConocimientoService", () => {
  let service: ConocimientoService;
  let mockPrismaService: any;

  const tenantId = "test-tenant-id";
  const userId = "test-user-id";
  const categoryId = "test-category-id";
  const articleId = "test-article-id";
  const tagId = "test-tag-id";
  const versionId = "test-version-id";

  beforeEach(async () => {
    mockPrismaService = {
      knowledgeCategory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      knowledgeArticle: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      knowledgeTag: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      knowledgeVersion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      knowledgeArticleTag: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConocimientoService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ConocimientoService>(ConocimientoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Category Management", () => {
    describe("createCategory", () => {
      const createCategoryDto: CreateKnowledgeCategoryDto = {
        name: "Test Category",
        slug: "test-category",
        description: "Test description",
        color: "#FF5733",
        icon: "folder",
        sortOrder: 1,
      };

      it("should create a category successfully", async () => {
        const mockCategory = {
          id: categoryId,
          tenantId,
          ...createCategoryDto,
          isActive: true,
        };

        mockPrismaService.knowledgeCategory.create.mockResolvedValue(
          mockCategory,
        );

        const result = await service.createCategory(
          tenantId,
          createCategoryDto,
        );

        expect(result).toEqual({
          success: true,
          data: mockCategory,
          message: "Category created successfully",
        });
        expect(mockPrismaService.knowledgeCategory.create).toHaveBeenCalledWith(
          {
            data: {
              tenantId,
              ...createCategoryDto,
            },
          },
        );
      });
    });

    describe("getCategories", () => {
      it("should return all root categories for a tenant", async () => {
        const mockCategories = [
          {
            id: categoryId,
            tenantId,
            name: "Category 1",
            parentId: null,
            children: [],
            _count: { articles: 5 },
          },
        ];

        mockPrismaService.knowledgeCategory.findMany.mockResolvedValue(
          mockCategories,
        );

        const result = await service.getCategories(tenantId);

        expect(result).toEqual(mockCategories);
        expect(
          mockPrismaService.knowledgeCategory.findMany,
        ).toHaveBeenCalledWith({
          where: { tenantId, isActive: true, parentId: null },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              where: { isActive: true },
              include: {
                _count: {
                  select: { articles: true },
                },
              },
            },
            _count: {
              select: { articles: true },
            },
          },
        });
      });

      it("should return child categories when parentId is provided", async () => {
        const mockCategories = [
          {
            id: "child1",
            tenantId,
            name: "Child Category",
            parentId: categoryId,
            children: [],
            _count: { articles: 2 },
          },
        ];

        mockPrismaService.knowledgeCategory.findMany.mockResolvedValue(
          mockCategories,
        );

        const result = await service.getCategories(tenantId, categoryId);

        expect(result).toEqual(mockCategories);
        expect(
          mockPrismaService.knowledgeCategory.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              parentId: categoryId,
            }),
          }),
        );
      });
    });

    describe("getCategoryTree", () => {
      it("should return the full category tree", async () => {
        const mockCategories = [
          {
            id: categoryId,
            tenantId,
            name: "Parent Category",
            parentId: null,
            children: [],
            _count: { articles: 5 },
          },
          {
            id: "child1",
            tenantId,
            name: "Child Category",
            parentId: categoryId,
            children: [],
            _count: { articles: 2 },
          },
        ];

        mockPrismaService.knowledgeCategory.findMany.mockResolvedValue(
          mockCategories,
        );

        const result = await service.getCategoryTree(tenantId);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Category tree retrieved successfully");
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe("updateCategory", () => {
      const updateCategoryDto: UpdateKnowledgeCategoryDto = {
        name: "Updated Category",
        description: "Updated description",
      };

      it("should update a category successfully", async () => {
        const existingCategory = {
          id: categoryId,
          tenantId,
          name: "Old Name",
        };
        const updatedCategory = {
          ...existingCategory,
          ...updateCategoryDto,
        };

        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(
          existingCategory,
        );
        mockPrismaService.knowledgeCategory.update.mockResolvedValue(
          updatedCategory,
        );

        const result = await service.updateCategory(
          categoryId,
          tenantId,
          updateCategoryDto,
        );

        expect(result).toEqual({
          success: true,
          data: updatedCategory,
          message: "Category updated successfully",
        });
      });

      it("should throw NotFoundException when category not found", async () => {
        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(null);

        await expect(
          service.updateCategory(categoryId, tenantId, updateCategoryDto),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("deleteCategory", () => {
      it("should delete a category successfully", async () => {
        const existingCategory = {
          id: categoryId,
          tenantId,
          articles: [],
          children: [],
        };

        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(
          existingCategory,
        );
        mockPrismaService.knowledgeCategory.delete.mockResolvedValue(
          existingCategory,
        );

        const result = await service.deleteCategory(categoryId, tenantId);

        expect(result).toEqual({
          success: true,
          message: "Category deleted successfully",
        });
      });

      it("should throw NotFoundException when category not found", async () => {
        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(null);

        await expect(
          service.deleteCategory(categoryId, tenantId),
        ).rejects.toThrow(NotFoundException);
      });

      it("should throw BadRequestException when category has articles", async () => {
        const existingCategory = {
          id: categoryId,
          tenantId,
          articles: [{ id: "article1" }],
          children: [],
        };

        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(
          existingCategory,
        );

        await expect(
          service.deleteCategory(categoryId, tenantId),
        ).rejects.toThrow(BadRequestException);
      });

      it("should throw BadRequestException when category has children", async () => {
        const existingCategory = {
          id: categoryId,
          tenantId,
          articles: [],
          children: [{ id: "child1" }],
        };

        mockPrismaService.knowledgeCategory.findFirst.mockResolvedValue(
          existingCategory,
        );

        await expect(
          service.deleteCategory(categoryId, tenantId),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe("Article Management", () => {
    describe("createArticle", () => {
      const createArticleDto: CreateKnowledgeArticleDto = {
        title: "Test Article",
        slug: "test-article",
        content: { type: "doc", content: [] },
        summary: "Test summary",
        categoryId,
        tags: [tagId],
      };

      it("should create an article successfully", async () => {
        const mockArticle = {
          id: articleId,
          tenantId,
          createdBy: userId,
          updatedBy: userId,
          ...createArticleDto,
        };

        mockPrismaService.knowledgeArticle.create.mockResolvedValue(
          mockArticle,
        );
        mockPrismaService.knowledgeVersion.create.mockResolvedValue({});
        mockPrismaService.knowledgeArticleTag.deleteMany.mockResolvedValue({});
        mockPrismaService.knowledgeArticleTag.create.mockResolvedValue({});

        const result = await service.createArticle(
          tenantId,
          userId,
          createArticleDto,
        );

        expect(result).toEqual({
          success: true,
          data: mockArticle,
          message: "Article created successfully",
        });
      });
    });

    describe("getArticles", () => {
      const query: KnowledgeQueryDto = {
        search: "test",
        categoryId,
        status: "PUBLISHED",
        sortBy: "updatedAt",
        sortOrder: "desc",
      };

      it("should return articles matching query", async () => {
        const mockArticles = [
          {
            id: articleId,
            tenantId,
            title: "Test Article",
            category: { id: categoryId, name: "Category" },
            author: { id: userId, name: "Author", email: "author@test.com" },
            tags: [],
          },
        ];

        mockPrismaService.knowledgeArticle.findMany.mockResolvedValue(
          mockArticles,
        );

        const result = await service.getArticles(tenantId, query);

        expect(result).toEqual({
          success: true,
          data: mockArticles,
          message: "Articles retrieved successfully",
        });
      });

      it("should filter by tag when provided", async () => {
        const queryWithTag: KnowledgeQueryDto = {
          tag: "test-tag",
        };

        const mockArticles = [
          {
            id: articleId,
            tenantId,
            title: "Test Article",
            tags: [{ tag: { slug: "test-tag" } }],
          },
        ];

        mockPrismaService.knowledgeArticle.findMany.mockResolvedValue(
          mockArticles,
        );

        const result = await service.getArticles(tenantId, queryWithTag);

        expect(result.success).toBe(true);
        expect(
          mockPrismaService.knowledgeArticle.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tags: {
                some: {
                  tag: {
                    slug: "test-tag",
                  },
                },
              },
            }),
          }),
        );
      });
    });

    describe("getArticleById", () => {
      it("should return an article by id", async () => {
        const mockArticle = {
          id: articleId,
          tenantId,
          title: "Test Article",
          viewCount: 5,
          category: { id: categoryId, name: "Category" },
          author: { id: userId, name: "Author", email: "author@test.com" },
          updater: { id: userId, name: "Updater", email: "updater@test.com" },
          tags: [],
        };

        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(
          mockArticle,
        );
        mockPrismaService.knowledgeArticle.update.mockResolvedValue({
          ...mockArticle,
          viewCount: 6,
        });

        const result = await service.getArticleById(articleId, tenantId);

        expect(result.success).toBe(true);
        expect(result.data.viewCount).toBe(6);
      });

      it("should throw NotFoundException when article not found", async () => {
        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(null);

        await expect(
          service.getArticleById(articleId, tenantId),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("updateArticle", () => {
      const updateArticleDto: UpdateKnowledgeArticleDto = {
        title: "Updated Title",
        content: { type: "doc", content: [] },
      };

      it("should update an article successfully", async () => {
        const existingArticle = {
          id: articleId,
          tenantId,
          title: "Old Title",
        };
        const updatedArticle = {
          ...existingArticle,
          ...updateArticleDto,
          updatedBy: userId,
        };

        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(
          existingArticle,
        );
        mockPrismaService.knowledgeVersion.findFirst.mockResolvedValue({
          version: 1,
        });
        mockPrismaService.knowledgeArticle.update.mockResolvedValue(
          updatedArticle,
        );
        mockPrismaService.knowledgeVersion.create.mockResolvedValue({});
        mockPrismaService.knowledgeArticleTag.deleteMany.mockResolvedValue({});
        mockPrismaService.knowledgeArticleTag.create.mockResolvedValue({});

        const result = await service.updateArticle(
          articleId,
          tenantId,
          userId,
          updateArticleDto,
        );

        expect(result).toEqual({
          success: true,
          data: updatedArticle,
          message: "Article updated successfully",
        });
      });

      it("should throw NotFoundException when article not found", async () => {
        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(null);

        await expect(
          service.updateArticle(articleId, tenantId, userId, updateArticleDto),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("publishArticle", () => {
      const publishArticleDto: PublishArticleDto = {
        changeNote: "Initial publication",
      };

      it("should publish an article successfully", async () => {
        const existingArticle = {
          id: articleId,
          tenantId,
          status: "DRAFT",
          content: { type: "doc", content: [] },
        };
        const publishedArticle = {
          ...existingArticle,
          status: "PUBLISHED",
          updatedBy: userId,
        };

        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(
          existingArticle,
        );
        mockPrismaService.knowledgeVersion.findFirst.mockResolvedValue({
          version: 1,
        });
        mockPrismaService.knowledgeVersion.create.mockResolvedValue({});
        mockPrismaService.knowledgeArticle.update.mockResolvedValue(
          publishedArticle,
        );

        const result = await service.publishArticle(
          articleId,
          tenantId,
          userId,
          publishArticleDto,
        );

        expect(result).toEqual({
          success: true,
          data: publishedArticle,
          message: "Article published successfully",
        });
      });

      it("should throw NotFoundException when article not found", async () => {
        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(null);

        await expect(
          service.publishArticle(
            articleId,
            tenantId,
            userId,
            publishArticleDto,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("deleteArticle", () => {
      it("should delete an article successfully", async () => {
        const existingArticle = {
          id: articleId,
          tenantId,
        };

        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(
          existingArticle,
        );
        mockPrismaService.knowledgeArticle.delete.mockResolvedValue(
          existingArticle,
        );

        const result = await service.deleteArticle(articleId, tenantId);

        expect(result).toEqual({
          success: true,
          message: "Article deleted successfully",
        });
      });

      it("should throw NotFoundException when article not found", async () => {
        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(null);

        await expect(
          service.deleteArticle(articleId, tenantId),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("getArticleVersions", () => {
      it("should return all versions of an article", async () => {
        const mockVersions = [
          { id: versionId, version: 1, articleId },
          { id: "version2", version: 2, articleId },
        ];

        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue({
          id: articleId,
          tenantId,
        });
        mockPrismaService.knowledgeVersion.findMany.mockResolvedValue(
          mockVersions,
        );

        const result = await service.getArticleVersions(articleId, tenantId);

        expect(result).toEqual({
          success: true,
          data: mockVersions,
          message: "Article versions retrieved successfully",
        });
      });

      it("should throw NotFoundException when article not found", async () => {
        mockPrismaService.knowledgeArticle.findFirst.mockResolvedValue(null);

        await expect(
          service.getArticleVersions(articleId, tenantId),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("restoreArticleVersion", () => {
      const restoreVersionDto: RestoreVersionDto = {
        changeNote: "Restored from version 1",
      };

      it("should restore an article version successfully", async () => {
        const mockVersion = {
          id: versionId,
          articleId,
          version: 1,
          content: { type: "doc", content: [] },
          article: { tenantId },
        };
        const updatedArticle = {
          id: articleId,
          content: mockVersion.content,
          updatedBy: userId,
        };

        mockPrismaService.knowledgeVersion.findFirst
          .mockResolvedValueOnce(mockVersion)
          .mockResolvedValueOnce({ version: 2 });
        mockPrismaService.knowledgeArticle.update.mockResolvedValue(
          updatedArticle,
        );
        mockPrismaService.knowledgeVersion.create.mockResolvedValue({});

        const result = await service.restoreArticleVersion(
          versionId,
          tenantId,
          userId,
          restoreVersionDto,
        );

        expect(result).toEqual({
          success: true,
          data: updatedArticle,
          message: "Article restored successfully",
        });
      });

      it("should throw NotFoundException when version not found", async () => {
        mockPrismaService.knowledgeVersion.findFirst.mockResolvedValue(null);

        await expect(
          service.restoreArticleVersion(
            versionId,
            tenantId,
            userId,
            restoreVersionDto,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe("Tag Management", () => {
    describe("createTag", () => {
      const createTagDto: CreateKnowledgeTagDto = {
        name: "Test Tag",
        slug: "test-tag",
        color: "#00FF00",
      };

      it("should create a tag successfully", async () => {
        const mockTag = {
          id: tagId,
          tenantId,
          ...createTagDto,
        };

        mockPrismaService.knowledgeTag.create.mockResolvedValue(mockTag);

        const result = await service.createTag(tenantId, createTagDto);

        expect(result).toEqual({
          success: true,
          data: mockTag,
          message: "Tag created successfully",
        });
      });
    });

    describe("getTags", () => {
      it("should return all tags for a tenant", async () => {
        const mockTags = [
          {
            id: tagId,
            tenantId,
            name: "Tag 1",
            _count: { articles: 3 },
          },
        ];

        mockPrismaService.knowledgeTag.findMany.mockResolvedValue(mockTags);

        const result = await service.getTags(tenantId);

        expect(result).toEqual(mockTags);
        expect(mockPrismaService.knowledgeTag.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: { articles: true },
            },
          },
        });
      });
    });

    describe("updateTag", () => {
      const updateTagDto: UpdateKnowledgeTagDto = {
        name: "Updated Tag",
      };

      it("should update a tag successfully", async () => {
        const existingTag = {
          id: tagId,
          tenantId,
          name: "Old Tag",
        };
        const updatedTag = {
          ...existingTag,
          ...updateTagDto,
        };

        mockPrismaService.knowledgeTag.findFirst.mockResolvedValue(existingTag);
        mockPrismaService.knowledgeTag.update.mockResolvedValue(updatedTag);

        const result = await service.updateTag(tagId, tenantId, updateTagDto);

        expect(result).toEqual({
          success: true,
          data: updatedTag,
          message: "Tag updated successfully",
        });
      });

      it("should throw NotFoundException when tag not found", async () => {
        mockPrismaService.knowledgeTag.findFirst.mockResolvedValue(null);

        await expect(
          service.updateTag(tagId, tenantId, updateTagDto),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe("deleteTag", () => {
      it("should delete a tag successfully", async () => {
        const existingTag = {
          id: tagId,
          tenantId,
          articles: [],
        };

        mockPrismaService.knowledgeTag.findFirst.mockResolvedValue(existingTag);
        mockPrismaService.knowledgeTag.delete.mockResolvedValue(existingTag);

        const result = await service.deleteTag(tagId, tenantId);

        expect(result).toEqual({
          success: true,
          message: "Tag deleted successfully",
        });
      });

      it("should throw NotFoundException when tag not found", async () => {
        mockPrismaService.knowledgeTag.findFirst.mockResolvedValue(null);

        await expect(service.deleteTag(tagId, tenantId)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
