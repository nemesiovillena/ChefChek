import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductsQueryDto } from './dto/create-product.dto';
import { Roles } from '../../decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';

@Controller('api/v1/products')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'USER')
  async create(@Body() createProductDto: CreateProductDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.create(createProductDto, tenantId);
  }

  @Get()
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findAll(@Query() query: ProductsQueryDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.findAll(query, tenantId);
  }

  @Get('categories')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getCategories(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getCategories(tenantId);
  }

  @Get('suppliers')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getSuppliers(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getSuppliers(tenantId);
  }

  @Get(':id/calculate')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async calculateCost(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.calculateProductCost(id, tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'USER')
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.update(id, updateProductDto, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN', 'USER')
  async remove(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.remove(id, tenantId);
  }
}