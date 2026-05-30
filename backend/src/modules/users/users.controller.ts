import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('api/v1/users')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.create(createUserDto, tenantId);
  }

  @Get()
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.usersService.findAll(tenantId, pageNum, limitNum);
  }

  @Get(':id')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.update(id, updateUserDto, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId; // Extraído del middleware de tenant
    return this.usersService.remove(id, tenantId);
  }
}