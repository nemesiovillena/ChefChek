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
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/menus')
@UseGuards(RolesGuard)
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @Roles('ADMIN', 'USER')
  async create(@Req() req, @Body() createMenuDto: CreateMenuDto) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const menu = await this.menusService.create(tenantId, createMenuDto);
    return {
      success: true,
      data: menu,
      message: 'Menu created successfully',
    };
  }

  @Get()
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findAll(@Req() req, @Query() query: { search?: string; isActive?: boolean }) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const menus = await this.menusService.findAll(tenantId, query);
    return {
      success: true,
      data: menus,
      message: 'Menus retrieved successfully',
    };
  }

  @Get(':id')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findOne(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const menu = await this.menusService.findOne(tenantId, id);
    return {
      success: true,
      data: menu,
      message: 'Menu retrieved successfully',
    };
  }

  @Patch(':id')
  @Roles('ADMIN', 'USER')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateMenuDto: Partial<CreateMenuDto>,
  ) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const menu = await this.menusService.update(tenantId, id, updateMenuDto);
    return {
      success: true,
      data: menu,
      message: 'Menu updated successfully',
    };
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    await this.menusService.remove(tenantId, id);
    return {
      success: true,
      message: 'Menu deleted successfully',
    };
  }

  @Get(':id/calculate')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async calculateCost(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const costBreakdown = await this.menusService.calculateMenuCost(id);
    return {
      success: true,
      data: costBreakdown,
      message: 'Menu cost calculated successfully',
    };
  }

  @Get(':id/qr-code')
  @Roles('ADMIN', 'USER')
  async generateQRCode(@Req() req, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const qrData = await this.menusService.generateQRCode(tenantId, id);
    return {
      success: true,
      data: qrData,
      message: 'QR code generated successfully',
    };
  }
}