import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

/**
 * La integración con Cuiner siempre trabaja sobre un restaurante concreto.
 * El SUPERADMIN pasa TenantGuard sin tenant (opera sobre todos), así que sin
 * esta comprobación sus peticiones llegaban con tenantId vacío y Prisma
 * respondía con un 500. Mejor un 403 que diga qué hacer.
 */
@Injectable()
export class CuinerTenantRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.tenantId) {
      throw new ForbiddenException(
        "La integración con Cuiner se gestiona desde un usuario del restaurante, no desde el superadministrador",
      );
    }
    return true;
  }
}
