import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AllergensService } from './allergens.service';
import { UpdateProductAllergensDto, AllergenComplianceReportDto } from './dto/allergens.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/allergens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllergensController {
  constructor(private readonly allergensService: AllergensService) {}

  @Get('info')
  async getAllergensInfo() {
    const allergensInfo = await this.allergensService.getAllergensInfo();
    return {
      success: true,
      data: allergensInfo,
    };
  }

  @Put('products/:productId')
  @Roles('ADMIN', 'USER')
  async updateProductAllergens(
    @Req() req,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductAllergensDto
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const result = await this.allergensService.updateProductAllergens(tenantId, productId, dto);
    return result;
  }

  @Post('recipes/:recipeId/calculate')
  @Roles('ADMIN', 'USER')
  async calculateRecipeAllergens(@Param('recipeId') recipeId: string) {
    const allergens = await this.allergensService.calculateRecipeAllergens(recipeId);
    return {
      success: true,
      data: {
        recipeId,
        allergens,
      },
    };
  }

  @Post('menus/:menuId/calculate')
  @Roles('ADMIN', 'USER')
  async calculateMenuAllergens(@Param('menuId') menuId: string) {
    const allergens = await this.allergensService.calculateMenuAllergens(menuId);
    return {
      success: true,
      data: {
        menuId,
        allergens,
      },
    };
  }

  @Post('menus/:menuId/conflicts')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async detectAllergenConflicts(
    @Req() req,
    @Param('menuId') menuId: string,
    @Body() body: { filteredAllergens: number[] }
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const conflicts = await this.allergensService.detectAllergenConflicts(
      tenantId,
      menuId,
      body.filteredAllergens
    );
    return {
      success: true,
      data: {
        menuId,
        filteredAllergens: body.filteredAllergens,
        conflicts,
      },
    };
  }

  @Get('menus/:menuId/compliance')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getComplianceReport(
    @Req() req,
    @Param('menuId') menuId: string,
    @Body() body?: { reportType?: 'FULL' | 'SUMMARY' }
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const reportType = body?.reportType || 'FULL';
    const report = await this.allergensService.generateComplianceReport(
      tenantId,
      menuId,
      reportType
    );
    return {
      success: true,
      data: report,
    };
  }

  @Get('products')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getProductsWithAllergens(@Req() req) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const allProducts = await this.allergensService.getProductsWithAllergens(tenantId, []);
    return {
      success: true,
      data: allProducts,
    };
  }

  @Get('products/by-allergens/:allergenIds')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getProductsWithSpecificAllergens(
    @Req() req,
    @Param('allergenIds') allergenIds: string
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const ids = allergenIds.split(',').map((id) => parseInt(id));
    const products = await this.allergensService.getProductsWithAllergens(tenantId, ids);
    return {
      success: true,
      data: {
        allergenIds: ids,
        products,
      },
    };
  }

  @Get('recipes')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getRecipesWithAllergens(@Req() req) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const allRecipes = await this.allergensService.getRecipesWithAllergens(tenantId, []);
    return {
      success: true,
      data: allRecipes,
    };
  }

  @Get('recipes/by-allergens/:allergenIds')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getRecipesWithSpecificAllergens(
    @Req() req,
    @Param('allergenIds') allergenIds: string
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const ids = allergenIds.split(',').map((id) => parseInt(id));
    const recipes = await this.allergensService.getRecipesWithAllergens(tenantId, ids);
    return {
      success: true,
      data: {
        allergenIds: ids,
        recipes,
      },
    };
  }

  @Get('menus')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getMenusWithAllergens(@Req() req) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const allMenus = await this.allergensService.getMenusWithAllergens(tenantId, []);
    return {
      success: true,
      data: allMenus,
    };
  }

  @Get('menus/by-allergens/:allergenIds')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getMenusWithSpecificAllergens(
    @Req() req,
    @Param('allergenIds') allergenIds: string
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const ids = allergenIds.split(',').map((id) => parseInt(id));
    const menus = await this.allergensService.getMenusWithAllergens(tenantId, ids);
    return {
      success: true,
      data: {
        allergenIds: ids,
        menus,
      },
    };
  }

  @Post('recalculate-all')
  @Roles('ADMIN')
  async recalculateAllAllergensForTenant(@Req() req) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const result = await this.allergensService.recalculateAllAllergensForTenant(tenantId);
    return result;
  }
}