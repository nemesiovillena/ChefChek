import { Injectable, NestMiddleware, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantsService } from '../modules/tenants/tenants.service';

// Extender interfaz Request para incluir tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantSlug?: string;
      user?: any;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantSlug = req.headers['x-tenant-slug'] as string;

    if (!tenantSlug) {
      throw new ForbiddenException('X-Tenant-Slug header is required');
    }

    try {
      const tenant = await this.tenantsService.findBySlug(tenantSlug);

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      if (!tenant.isActive) {
        throw new ForbiddenException('Tenant is not active');
      }

      // Adjuntar tenant al contexto de la request
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;

      next();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Invalid tenant');
    }
  }
}