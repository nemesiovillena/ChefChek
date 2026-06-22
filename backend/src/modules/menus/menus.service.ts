import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateMenuDto } from "./dto/create-menu.dto";
import {
  MenuResponse,
  MenuItemResponse,
  MenuSectionResponse,
  MenuTranslationResponse,
  MenuCostBreakdown,
} from "./dto/menu-response.dto";

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    createMenuDto: CreateMenuDto,
  ): Promise<MenuResponse> {
    const {
      name,
      description,
      startDate,
      endDate,
      portions = 1,
      sections = [],
      translations = [],
      isActive = true,
    } = createMenuDto;

    // Validar fechas
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException("End date must be after start date");
    }

    // Calcular costos del menú
    const costBreakdown = await this.calculateCostFromSections(
      sections,
      portions,
    );

    // Crear menú
    const menu = await this.prisma.menu.create({
      data: {
        tenantId,
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        portions,
        totalCost: costBreakdown.totalCost,
        totalPrice: costBreakdown.totalPrice,
        totalMargin: costBreakdown.totalMargin,
        isActive,
        sections: {
          create: sections.map((section, index) => ({
            name: section.name,
            sortOrder: section.order,
            items: {
              create: section.items.map((item) => ({
                recipeId: item.recipeId,
                price: item.price || 0, // Se calculará después
                isAvailable: item.isAvailable ?? true,
              })),
            },
          })),
        },
        translations:
          translations.length > 0
            ? {
                create: translations.map((translation) => ({
                  language: translation.language,
                  title: translation.name,
                  name: translation.name,
                  description: translation.description,
                  sectionsTranslations: translation.sectionsTranslations || {},
                })),
              }
            : undefined,
      },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
    });

    // Actualizar precios de items si no se proporcionaron
    await this.updateItemPrices(menu.id);

    // Recargar con precios actualizados
    const updatedMenu = await this.prisma.menu.findUnique({
      where: { id: menu.id },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
    });

    return this.formatMenuResponse(updatedMenu, costBreakdown);
  }

  async findAll(
    tenantId: string,
    query?: { search?: string; isActive?: boolean },
  ): Promise<MenuResponse[]> {
    const where = {
      tenantId,
      ...(query?.isActive !== undefined && { isActive: query.isActive }),
      ...(query?.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          {
            description: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    const menus = await this.prisma.menu.findMany({
      where,
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return menus.map((menu) => {
      const costBreakdown = this.calculateMenuCostResponse(menu);
      return this.formatMenuResponse(menu, costBreakdown);
    });
  }

  async findOne(tenantId: string, id: string): Promise<MenuResponse> {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }

    const costBreakdown = this.calculateMenuCostResponse(menu);
    return this.formatMenuResponse(menu, costBreakdown);
  }

  async update(
    tenantId: string,
    id: string,
    updateMenuDto: Partial<CreateMenuDto>,
  ): Promise<MenuResponse> {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }

    const {
      name = menu.name,
      description = menu.description,
      startDate,
      endDate,
      portions = menu.portions,
      sections,
      translations,
      isActive = menu.isActive,
    } = updateMenuDto;

    // Validar fechas
    const start = startDate ? new Date(startDate) : menu.startDate;
    const end = endDate ? new Date(endDate) : menu.endDate;
    if (start && end && start > end) {
      throw new BadRequestException("End date must be after start date");
    }

    // Recalcular costos si hay cambios en secciones
    let costBreakdown = this.calculateMenuCostResponse(menu);
    if (sections) {
      costBreakdown = await this.calculateCostFromSections(sections, portions);
    }

    const updatedMenu = await this.prisma.menu.update({
      where: { id },
      data: {
        name,
        description,
        startDate: start,
        endDate: end,
        portions,
        totalCost: costBreakdown.totalCost,
        totalPrice: costBreakdown.totalPrice,
        totalMargin: costBreakdown.totalMargin,
        isActive,
      },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
    });

    // Actualizar secciones y items si se proporcionan
    if (sections) {
      await this.updateMenuSections(id, sections);
    }

    // Actualizar traducciones si se proporcionan
    if (translations) {
      await this.updateMenuTranslations(id, translations);
    }

    // Recargar con relaciones actualizadas
    const finalMenu = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        translations: true,
      },
    });

    return this.formatMenuResponse(finalMenu, costBreakdown);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }

    await this.prisma.menu.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async calculateMenuCost(
    tenantId: string,
    id: string,
  ): Promise<MenuCostBreakdown> {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
      include: {
        sections: {
          include: {
            items: {
              include: {
                recipe: true,
              },
            },
          },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }

    return this.calculateMenuCostResponse(menu);
  }

  async generateQRCode(
    tenantId: string,
    id: string,
  ): Promise<{ qrCode: string; url: string }> {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }

    // Generar URL única para el menú
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const menuUrl = `${baseUrl}/menu/${id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

    return {
      qrCode: qrCodeUrl,
      url: menuUrl,
    };
  }

  private async calculateCostFromSections(
    sections: any[],
    portions: number,
  ): Promise<MenuCostBreakdown> {
    let totalCost = 0;
    let totalPrice = 0;
    let totalItems = 0;

    for (const section of sections) {
      for (const item of section.items) {
        const recipe = await this.prisma.recipe.findUnique({
          where: { id: item.recipeId },
        });

        if (!recipe) {
          throw new NotFoundException(
            `Recipe with ID ${item.recipeId} not found`,
          );
        }

        const cost = recipe.totalCost;
        const price = item.price || recipe.totalCost * 1.3; // 30% margen por defecto

        totalCost += cost;
        totalPrice += price;
        totalItems++;
      }
    }

    const totalMargin = totalPrice - totalCost;
    const averageMarginPercentage =
      totalPrice > 0 ? (totalMargin / totalPrice) * 100 : 0;
    const costPerPortion = totalCost / portions;
    const pricePerPortion = totalPrice / portions;

    return {
      totalCost,
      totalPrice,
      totalMargin,
      averageMarginPercentage,
      costPerPortion,
      pricePerPortion,
    };
  }

  private calculateMenuCostResponse(menu: any): MenuCostBreakdown {
    let totalCost = 0;
    let totalPrice = 0;

    menu.sections.forEach((section: any) => {
      section.items.forEach((item: any) => {
        totalCost += item.recipe.totalCost;
        totalPrice += item.price;
      });
    });

    const totalMargin = totalPrice - totalCost;
    const averageMarginPercentage =
      totalPrice > 0 ? (totalMargin / totalPrice) * 100 : 0;
    const costPerPortion = totalCost / menu.portions;
    const pricePerPortion = totalPrice / menu.portions;

    return {
      totalCost,
      totalPrice,
      totalMargin,
      averageMarginPercentage,
      costPerPortion,
      pricePerPortion,
    };
  }

  private async updateMenuSections(
    menuId: string,
    sections: any[],
  ): Promise<void> {
    // Eliminar secciones existentes
    await this.prisma.menuSection.deleteMany({ where: { menuId } });

    // Crear nuevas secciones
    for (const section of sections) {
      await this.prisma.menuSection.create({
        data: {
          menuId,
          name: section.name,
          sortOrder: section.order,
          items: {
            create: section.items.map((item: any) => ({
              recipeId: item.recipeId,
              price: item.price || 0,
              isAvailable: item.isAvailable ?? true,
            })),
          },
        },
      });
    }
  }

  private async updateMenuTranslations(
    menuId: string,
    translations: any[],
  ): Promise<void> {
    // Eliminar traducciones existentes
    await this.prisma.menuTranslation.deleteMany({ where: { menuId } });

    // Crear nuevas traducciones
    for (const translation of translations) {
      await this.prisma.menuTranslation.create({
        data: {
          menuId,
          language: translation.language,
          title: translation.name,
          name: translation.name,
          description: translation.description,
          sectionsTranslations: translation.sectionsTranslations || {},
        },
      });
    }
  }

  private async updateItemPrices(menuId: string): Promise<void> {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
      include: {
        sections: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!menu) {
      return;
    }

    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.price === 0) {
          const recipe = await this.prisma.recipe.findUnique({
            where: { id: item.recipeId },
          });

          if (recipe) {
            const price = recipe.totalCost * 1.3; // 30% margen
            await this.prisma.menuItem.update({
              where: { id: item.id },
              data: { price },
            });
          }
        }
      }
    }
  }

  private formatMenuResponse(
    menu: any,
    costBreakdown?: MenuCostBreakdown,
  ): MenuResponse {
    const sections: MenuSectionResponse[] = menu.sections.map(
      (section: any) => ({
        id: section.id,
        name: section.name,
        order: section.order,
        items: section.items.map((item: any) => {
          const cost = item.recipe.totalCost;
          const price = item.price;
          const margin = price - cost;
          const marginPercentage = price > 0 ? (margin / price) * 100 : 0;

          // Calcular alérgenos de la receta
          const allergens = this.calculateAllergens(item.recipe);

          return {
            id: item.id,
            recipeId: item.recipeId,
            recipeName: item.recipe.name,
            price,
            cost,
            margin,
            isAvailable: item.isAvailable,
            allergens,
          };
        }),
      }),
    );

    const translations: MenuTranslationResponse[] =
      menu.translations?.map((trans: any) => ({
        id: trans.id,
        language: trans.language,
        name: trans.name,
        description: trans.description,
        sectionsTranslations: trans.sectionsTranslations || {},
      })) || [];

    return {
      id: menu.id,
      name: menu.name,
      description: menu.description,
      startDate: menu.startDate,
      endDate: menu.endDate,
      portions: menu.portions,
      isActive: menu.isActive,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      sections,
      translations,
      costBreakdown,
    };
  }

  private calculateAllergens(recipe: any): number[] {
    const allergens = new Set<number>();

    if (recipe.ingredients) {
      recipe.ingredients.forEach((ing: any) => {
        if (ing.product?.allergens) {
          ing.product.allergens.forEach((a: number) => allergens.add(a));
        }
      });
    }

    return Array.from(allergens);
  }
}
