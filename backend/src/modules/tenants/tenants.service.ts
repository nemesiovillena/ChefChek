import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const { adminEmail, adminPassword, adminName, adminRole = 'ADMIN', ...tenantData } = createTenantDto;

    // Verificar si el slug ya existe
    const existingTenantBySlug = await this.prisma.tenant.findUnique({
      where: { slug: tenantData.slug },
    });

    if (existingTenantBySlug) {
      throw new ConflictException('Slug already exists');
    }

    // Verificar si el domain ya existe
    if (tenantData.domain) {
      const existingTenantByDomain = await this.prisma.tenant.findUnique({
        where: { domain: tenantData.domain },
      });

      if (existingTenantByDomain) {
        throw new ConflictException('Domain already exists');
      }
    }

    // Crear tenant con usuario admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        ...tenantData,
        users: {
          create: {
            email: adminEmail,
            passwordHash: hashedPassword,
            name: adminName,
            role: adminRole,
          },
        },
      },
      include: {
        users: true,
      },
    });

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      message: 'Tenant created successfully with admin user',
    };
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.tenant.count(),
    ]);

    return {
      success: true,
      data: tenants,
      meta: {
        total,
        page,
        limit,
      },
      message: 'Tenants retrieved successfully',
    };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      success: true,
      data: tenant,
      message: 'Tenant retrieved successfully',
    };
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Verificar si el nuevo slug ya existe
    if (updateTenantDto.slug && updateTenantDto.slug !== existingTenant.slug) {
      const existingSlug = await this.prisma.tenant.findUnique({
        where: { slug: updateTenantDto.slug },
      });

      if (existingSlug) {
        throw new ConflictException('Slug already exists');
      }
    }

    // Verificar si el nuevo domain ya existe
    if (updateTenantDto.domain && updateTenantDto.domain !== existingTenant.domain) {
      const existingDomain = await this.prisma.tenant.findUnique({
        where: { domain: updateTenantDto.domain },
      });

      if (existingDomain) {
        throw new ConflictException('Domain already exists');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      message: 'Tenant updated successfully',
    };
  }

  async remove(id: string) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return {
      success: true,
      data: null,
      message: 'Tenant deleted successfully',
    };
  }

  async validateTenantExists(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return !!tenant;
  }

  async validateTenantActive(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });

    return tenant?.isActive ?? false;
  }
}