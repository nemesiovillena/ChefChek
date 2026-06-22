import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
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

@Injectable()
export class ConocimientoService {
  constructor(private readonly prisma: PrismaService) {}

  // Gestión de Categorías
  async createCategory(tenantId: string, dto: CreateKnowledgeCategoryDto) {
    const category = await this.prisma.knowledgeCategory.create({
      data: {
        tenantId,
        ...dto,
      },
    });

    return {
      success: true,
      data: category,
      message: "Category created successfully",
    };
  }

  async getCategories(tenantId: string, parentId?: string) {
    const where: any = { tenantId, isActive: true };

    if (parentId) {
      where.parentId = parentId;
    } else {
      where.parentId = null;
    }

    return await this.prisma.knowledgeCategory.findMany({
      where,
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
  }

  async getCategoryTree(tenantId: string) {
    const categories = await this.prisma.knowledgeCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        children: true,
        _count: {
          select: { articles: true },
        },
      },
    });

    return {
      success: true,
      data: this.buildCategoryTree(categories),
      message: "Category tree retrieved successfully",
    };
  }

  private buildCategoryTree(
    categories: any[],
    parentId: string | null = null,
  ): any[] {
    return categories
      .filter((cat) => cat.parentId === parentId)
      .map((cat) => ({
        ...cat,
        children: this.buildCategoryTree(categories, cat.id),
      }));
  }

  async updateCategory(
    categoryId: string,
    tenantId: string,
    dto: UpdateKnowledgeCategoryDto,
  ) {
    const category = await this.prisma.knowledgeCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const updated = await this.prisma.knowledgeCategory.update({
      where: { id: categoryId },
      data: dto,
    });

    return {
      success: true,
      data: updated,
      message: "Category updated successfully",
    };
  }

  async deleteCategory(categoryId: string, tenantId: string) {
    const category = await this.prisma.knowledgeCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: { articles: true, children: true },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category.articles.length > 0) {
      throw new BadRequestException(
        "Cannot delete category with articles. Please move or delete articles first.",
      );
    }

    if (category.children.length > 0) {
      throw new BadRequestException(
        "Cannot delete category with subcategories. Please move or delete subcategories first.",
      );
    }

    await this.prisma.knowledgeCategory.delete({
      where: { id: categoryId },
    });

    return {
      success: true,
      message: "Category deleted successfully",
    };
  }

  // Gestión de Artículos
  async createArticle(
    tenantId: string,
    userId: string,
    dto: CreateKnowledgeArticleDto,
  ) {
    const { tags, ...articleData } = dto;

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        tenantId,
        createdBy: userId,
        updatedBy: userId,
        ...articleData,
      } as any,
    });

    // Create initial version
    await this.createArticleVersion(
      article.id,
      userId,
      1,
      dto.content,
      "Initial version",
    );

    // Add tags if provided
    if (tags && tags.length > 0) {
      await this.updateArticleTags(article.id, tags);
    }

    return {
      success: true,
      data: article,
      message: "Article created successfully",
    };
  }

  async getArticles(tenantId: string, query: KnowledgeQueryDto) {
    const {
      search,
      categoryId,
      status,
      tag,
      isPublic,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = query;

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = "PUBLISHED";
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: tag,
          },
        },
      };
    }

    const articles = await this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: true,
        author: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return {
      success: true,
      data: articles,
      message: "Articles retrieved successfully",
    };
  }

  async getArticleById(articleId: string, tenantId: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
      include: {
        category: true,
        author: {
          select: { id: true, name: true, email: true },
        },
        updater: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    // Increment view count
    await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: { viewCount: article.viewCount + 1 },
    });

    return {
      success: true,
      data: { ...article, viewCount: article.viewCount + 1 },
      message: "Article retrieved successfully",
    };
  }

  async updateArticle(
    articleId: string,
    tenantId: string,
    userId: string,
    dto: UpdateKnowledgeArticleDto,
  ) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    const { tags, ...updateData } = dto;

    // Get current version number
    const latestVersion = await this.prisma.knowledgeVersion.findFirst({
      where: { articleId },
      orderBy: { version: "desc" },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    // Update article
    const updated = await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        ...updateData,
        updatedBy: userId,
      },
    });

    // Create new version if content changed
    if (updateData.content) {
      await this.createArticleVersion(
        articleId,
        userId,
        newVersion,
        updateData.content,
        "Update",
      );
    }

    // Update tags if provided
    if (tags !== undefined) {
      await this.updateArticleTags(articleId, tags);
    }

    return {
      success: true,
      data: updated,
      message: "Article updated successfully",
    };
  }

  async publishArticle(
    articleId: string,
    tenantId: string,
    userId: string,
    dto: PublishArticleDto,
  ) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    // Get current version number
    const latestVersion = await this.prisma.knowledgeVersion.findFirst({
      where: { articleId },
      orderBy: { version: "desc" },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    // Create version before publishing
    await this.createArticleVersion(
      articleId,
      userId,
      newVersion,
      article.content,
      dto.changeNote || "Published version",
    );

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        status: "PUBLISHED",
        updatedBy: userId,
      },
    });

    return {
      success: true,
      data: updated,
      message: "Article published successfully",
    };
  }

  async deleteArticle(articleId: string, tenantId: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    await this.prisma.knowledgeArticle.delete({
      where: { id: articleId },
    });

    return {
      success: true,
      message: "Article deleted successfully",
    };
  }

  async getArticleVersions(articleId: string, tenantId: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    const versions = await this.prisma.knowledgeVersion.findMany({
      where: { articleId },
      orderBy: { version: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      success: true,
      data: versions,
      message: "Article versions retrieved successfully",
    };
  }

  async restoreArticleVersion(
    versionId: string,
    tenantId: string,
    userId: string,
    dto: RestoreVersionDto,
  ) {
    const version = await this.prisma.knowledgeVersion.findFirst({
      where: { id: versionId },
      include: { article: true },
    });

    if (!version || version.article.tenantId !== tenantId) {
      throw new NotFoundException("Version not found");
    }

    // Get current version number
    const latestVersion = await this.prisma.knowledgeVersion.findFirst({
      where: { articleId: version.articleId },
      orderBy: { version: "desc" },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    // Update article with version content
    const updated = await this.prisma.knowledgeArticle.update({
      where: { id: version.articleId },
      data: {
        content: version.content,
        updatedBy: userId,
      },
    });

    // Create new version for restoration
    await this.createArticleVersion(
      version.articleId,
      userId,
      newVersion,
      version.content,
      dto.changeNote || `Restored from version ${version.version}`,
    );

    return {
      success: true,
      data: updated,
      message: "Article restored successfully",
    };
  }

  // Gestión de Tags
  async createTag(tenantId: string, dto: CreateKnowledgeTagDto) {
    const tag = await this.prisma.knowledgeTag.create({
      data: {
        tenantId,
        ...dto,
      },
    });

    return {
      success: true,
      data: tag,
      message: "Tag created successfully",
    };
  }

  async getTags(tenantId: string) {
    return await this.prisma.knowledgeTag.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async updateTag(tagId: string, tenantId: string, dto: UpdateKnowledgeTagDto) {
    const tag = await this.prisma.knowledgeTag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    const updated = await this.prisma.knowledgeTag.update({
      where: { id: tagId },
      data: dto,
    });

    return {
      success: true,
      data: updated,
      message: "Tag updated successfully",
    };
  }

  async deleteTag(tagId: string, tenantId: string) {
    const tag = await this.prisma.knowledgeTag.findFirst({
      where: { id: tagId, tenantId },
      include: { articles: true },
    });

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    await this.prisma.knowledgeTag.delete({
      where: { id: tagId },
    });

    return {
      success: true,
      message: "Tag deleted successfully",
    };
  }

  // Helper methods
  private async createArticleVersion(
    articleId: string,
    userId: string,
    version: number,
    content: any,
    changeNote?: string,
  ) {
    return await this.prisma.knowledgeVersion.create({
      data: {
        articleId,
        version,
        content,
        changeNote,
        createdBy: userId,
      },
    });
  }

  private async updateArticleTags(articleId: string, tagIds: string[]) {
    // Delete existing tags
    await this.prisma.knowledgeArticleTag.deleteMany({
      where: { articleId },
    });

    // Create new tags
    for (const tagId of tagIds) {
      await this.prisma.knowledgeArticleTag.create({
        data: {
          articleId,
          tagId,
        },
      });
    }
  }
}
