import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateCategoryDto } from "./dto/category.dto";
import { UpdateCategoryDto } from "./dto/category.dto";

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createCategoryDto: CreateCategoryDto) {
    this.logger.log(
      `Creating category "${createCategoryDto.name}" for tenant ${tenantId}`,
    );

    // Check if slug already exists for this tenant
    const existing = await this.prisma.category.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: createCategoryDto.slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Category with slug "${createCategoryDto.slug}" already exists`,
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

  async findAll(tenantId: string) {
    this.logger.log(`Fetching all categories for tenant ${tenantId}`);

    const categories = (await this.prisma.category.findMany({
      where: { tenantId },
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

    // If updating slug, check for conflicts
    if (updateCategoryDto.slug && updateCategoryDto.slug !== existing.slug) {
      const slugConflict = await this.prisma.category.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug: updateCategoryDto.slug,
          },
        },
      });

      if (slugConflict) {
        throw new ConflictException(
          `Category with slug "${updateCategoryDto.slug}" already exists`,
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

  async getTree(tenantId: string) {
    this.logger.log(`Fetching category tree for tenant ${tenantId}`);

    const categories = (await this.prisma.category.findMany({
      where: {
        tenantId,
        parentId: null, // Only root categories
      },
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
