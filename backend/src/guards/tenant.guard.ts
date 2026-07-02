import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>() as any;

    // SUPERADMIN opera sin tenant — bypass obligatorio
    if (request.user?.role === "SUPERADMIN") {
      return true;
    }

    // Check if tenantId is already set by TenantMiddleware
    if (!request.tenantId) {
      // If not set, try to get it from authenticated user
      if (request.user?.tenantId) {
        request.tenantId = request.user.tenantId;
      } else {
        throw new ForbiddenException("Tenant context is required");
      }
    }

    return true;
  }
}
