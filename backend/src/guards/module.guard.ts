import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ModulesService } from "../modules/modules/modules.service";

export const MODULE_METADATA_KEY = "module";

/**
 * Decorator to declare which module a controller (or method) belongs to.
 * ModuleGuard reads this metadata and rejects requests when the module is
 * disabled for the current tenant.
 *
 * @example
 * @RequireModule("appcc")
 */
export const RequireModule = (moduleId: string) =>
  SetMetadata(MODULE_METADATA_KEY, moduleId);

/**
 * Gates access by module activation state. Place it AFTER AuthGuard and
 * TenantGuard in @UseGuards so req.user and req.tenantId are resolved.
 *
 * - No @RequireModule metadata -> allow (controller is not module-scoped).
 * - SUPERADMIN -> always allow (operates across tenants).
 * - Module disabled for the tenant -> 403.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modulesService: ModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      MODULE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Not module-scoped -> no restriction applies.
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SUPERADMIN operates across tenants and bypasses per-tenant gating.
    if (user?.role === "SUPERADMIN") {
      return true;
    }

    const tenantId = request.tenantId ?? user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required");
    }

    const enabled = await this.modulesService.isModuleEnabled(
      tenantId,
      requiredModule,
    );

    if (!enabled) {
      throw new ForbiddenException(
        `Module '${requiredModule}' is not enabled for this client`,
      );
    }

    return true;
  }
}
