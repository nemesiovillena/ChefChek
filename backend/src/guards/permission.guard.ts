import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PermissionsService,
  PERMISSIONS,
} from "../modules/auth/permissions.service";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obtener permisos requeridos del decorador
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      "permissions",
      [context.getHandler(), context.getClass()],
    );

    // Si no hay permisos requeridos, permitir acceso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Verificar si el usuario tiene todos los permisos requeridos
    const hasAllPermissions = await this.permissionsService.hasAllPermissions(
      user.id,
      requiredPermissions,
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}

// Decorador para requerir permisos específicos
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata("permissions", permissions);

// Decorador para requerir cualquiera de los permisos
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata("permissions-any", permissions);

// Decoradores de conveniencia para recursos específicos
export const CanCreateProducts = () =>
  RequirePermissions(PERMISSIONS.products.create);
export const CanUpdateProducts = () =>
  RequirePermissions(PERMISSIONS.products.update);
export const CanDeleteProducts = () =>
  RequirePermissions(PERMISSIONS.products.delete);

export const CanCreateRecipes = () =>
  RequirePermissions(PERMISSIONS.recipes.create);
export const CanUpdateRecipes = () =>
  RequirePermissions(PERMISSIONS.recipes.update);
export const CanDeleteRecipes = () =>
  RequirePermissions(PERMISSIONS.recipes.delete);

export const CanPublishMenus = () =>
  RequirePermissions(PERMISSIONS.menus.publish);
export const CanDeleteMenus = () =>
  RequirePermissions(PERMISSIONS.menus.delete);

export const CanApproveProduction = () =>
  RequirePermissions(PERMISSIONS.production.approve);
export const CanManageUsers = () =>
  RequirePermissions(PERMISSIONS.users.manage_roles);

export const CanManageSettings = () =>
  RequirePermissions(
    PERMISSIONS.settings.update,
    PERMISSIONS.settings.manage_categories,
  );
