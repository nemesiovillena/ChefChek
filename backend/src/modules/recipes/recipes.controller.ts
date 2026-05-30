import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/recipes')
@UseGuards(RolesGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @Roles('ADMIN', 'USER')
  async create(@Req() req, @Body() createRecipeDto: CreateRecipeDto) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const recipe = await this.recipesService.create(tenantId, createRecipeDto);
    return {
      success: true,
      data: recipe,
      message: 'Recipe created successfully',
    };
  }

  @Get()
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findAll(@Req() req, @Query() query: { search?: string; category?: string }) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const recipes = await this.recipesService.findAll(tenantId, query);
    return {
      success: true,
      data: recipes,
      message: 'Recipes retrieved successfully',
    };
  }

  @Get(':id')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findOne(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const recipe = await this.recipesService.findOne(tenantId, id);
    return {
      success: true,
      data: recipe,
      message: 'Recipe retrieved successfully',
    };
  }

  @Patch(':id')
  @Roles('ADMIN', 'USER')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateRecipeDto: Partial<CreateRecipeDto>,
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const recipe = await this.recipesService.update(tenantId, id, updateRecipeDto);
    return {
      success: true,
      data: recipe,
      message: 'Recipe updated successfully',
    };
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    await this.recipesService.remove(tenantId, id);
    return {
      success: true,
      message: 'Recipe deleted successfully',
    };
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'USER')
  async duplicate(
    @Req() req,
    @Param('id') id: string,
    @Body('newName') newName?: string,
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const recipe = await this.recipesService.duplicate(tenantId, id, newName);
    return {
      success: true,
      data: recipe,
      message: 'Recipe duplicated successfully',
    };
  }

  @Get(':id/calculate')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async calculateCost(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const costBreakdown = await this.recipesService.calculateRecipeCost(tenantId, id);
    return {
      success: true,
      data: costBreakdown,
      message: 'Recipe cost calculated successfully',
    };
  }
}