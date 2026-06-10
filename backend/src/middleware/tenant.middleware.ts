import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { TenantsService } from "../modules/tenants/tenants.service";

// Tipo User extendido para autenticación personalizada
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

// Extender interfaz Request para incluir tenantId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantSlug?: string;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantsService: TenantsService) {}

  private readonly publicRoutes = [
    "/",
    "/health",
    "/api/docs",
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/refresh",
    "/api/v1/auth/validate",
    "/api/v1/auth/register",
    "/api/v1/auth/sessions",
    "/api/v1/tenants",
  ];

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip tenant validation for public routes
    const isPublicRoute = this.publicRoutes.some((route) =>
      req.path.startsWith(route),
    );

    if (isPublicRoute) {
      return next();
    }

    // Get tenant from authenticated user (AuthGuard will have verified this by now)
    const authReq = req as any;
    if (authReq.user?.tenantId) {
      req.tenantId = authReq.user.tenantId;
      req.tenantSlug = authReq.user.slug || authReq.user.tenant?.slug;
    }

    // Don't block here - let TenantGuard handle validation if needed
    next();
  }
}
