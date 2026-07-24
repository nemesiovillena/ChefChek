import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { CategoryContext } from "@prisma/client";

type ContextFilter = CategoryContext | undefined;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  /** Busca otra categoría con el mismo slug en el mismo tenant+context+padre. */
  private findSlugConflict(
    tenantId: string,
    context: CategoryContext,
    parentId: string | null,
    slug: string,
    excludeId?: string,
  ) {
    return this.prisma.category.findFirst({
      where: {
        tenantId,
        context,
        parentId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async create(tenantId: string, createCategoryDto: CreateCategoryDto) {
    this.logger.log(
      `Creating category "${createCategoryDto.name}" for tenant ${tenantId}`,
    );

    // Slug único por padre: dos ramas distintas pueden tener una subcategoría
    // con el mismo nombre (ej. "Pescado" bajo "Fresco" y bajo "Congelado").
    const parentId = createCategoryDto.parentId ?? null;
    const existing = await this.findSlugConflict(
      tenantId,
      createCategoryDto.context,
      parentId,
      createCategoryDto.slug,
    );

    if (existing) {
      throw new ConflictException(
        `Category with slug "${createCategoryDto.slug}" already exists ${parentId ? "under this parent" : "at the root level"} in context "${createCategoryDto.context}"`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
        tenantId,
      },
    });

    this.logger.log(`Category created successfully with ID ${category.id}`);
    return category;
  }

  async findAll(tenantId: string, context?: ContextFilter) {
    this.logger.log(
      `Fetching categories for tenant ${tenantId}${context ? ` (context: ${context})` : ""}`,
    );

    const where: any = { tenantId };
    if (context) {
      where.context = context;
    }

    const categories = (await this.prisma.category.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            recipes: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })) as any;

    this.logger.log(`Found ${categories.length} categories`);
    return categories;
  }

  async findOne(tenantId: string, id: string) {
    this.logger.log(`Fetching category ${id} for tenant ${tenantId}`);

    const category = (await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
            isActive: true,
          },
        },
        recipes: {
          include: {
            recipe: {
              select: {
                id: true,
                name: true,
                portions: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            recipes: true,
          },
        },
      },
    })) as any;

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    this.logger.log(
      `Category ${id} found with ${category._count.products} products and ${category._count.recipes} recipes`,
    );
    return category;
  }

  async update(
    tenantId: string,
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    this.logger.log(`Updating category ${id} for tenant ${tenantId}`);

    // Check if category exists and belongs to tenant
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Si cambia slug, contexto o padre, el ámbito de unicidad cambia: hay que
    // re-comprobar conflicto en el nuevo ámbito (scoped a tenant+context+padre).
    const targetContext = updateCategoryDto.context ?? existing.context;
    const targetParentId =
      updateCategoryDto.parentId !== undefined
        ? (updateCategoryDto.parentId ?? null)
        : existing.parentId;
    const targetSlug = updateCategoryDto.slug ?? existing.slug;

    const scopeChanged =
      targetContext !== existing.context ||
      targetParentId !== existing.parentId ||
      targetSlug !== existing.slug;

    if (scopeChanged) {
      const slugConflict = await this.findSlugConflict(
        tenantId,
        targetContext,
        targetParentId,
        targetSlug,
        id,
      );

      if (slugConflict) {
        throw new ConflictException(
          `Category with slug "${targetSlug}" already exists ${targetParentId ? "under this parent" : "at the root level"} in context "${targetContext}"`,
        );
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    this.logger.log(`Category ${id} updated successfully`);
    return category;
  }

  async remove(tenantId: string, id: string) {
    this.logger.log(`Deleting category ${id} for tenant ${tenantId}`);

    // Check if category exists and belongs to tenant
    const existing = (await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            products: true,
            recipes: true,
          },
        },
      },
    })) as any;

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has products or recipes
    if (existing._count.products > 0 || existing._count.recipes > 0) {
      throw new ConflictException(
        `Cannot delete category with ${existing._count.products} products and ${existing._count.recipes} recipes. Please reassign or delete them first.`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category ${id} deleted successfully`);
  }

  async getTree(tenantId: string, context?: ContextFilter) {
    this.logger.log(
      `Fetching category tree for tenant ${tenantId}${context ? ` (context: ${context})` : ""}`,
    );

    const where: any = { tenantId, parentId: null };
    if (context) {
      where.context = context;
    }

    const categories = (await this.prisma.category.findMany({
      where,
      include: {
        children: {
          include: {
            children: true, // 3 levels deep
            _count: {
              select: {
                products: true,
                recipes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: {
            products: true,
            recipes: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    })) as any;

    this.logger.log(`Found ${categories.length} root categories`);
    return categories;
  }
}
