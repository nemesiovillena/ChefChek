import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const READ_ONLY_ROLES_KEY = "read-only-roles";
export const ALLOW_WRITE_ROLES_KEY = "allow-write-roles";

/**
 * Roles que en este controlador solo consultan: pueden hacer GET y nada más.
 * Sirve para dar a un rol con nivel de USER (p. ej. GESTION en Compras) acceso
 * de lectura sin tocar cada `@Roles` de las escrituras.
 *
 * @example
 * @UseGuards(AuthGuard, TenantGuard, RolesGuard, ReadOnlyRolesGuard)
 * @ReadOnlyForRoles("GESTION")
 */
export const ReadOnlyForRoles = (...roles: string[]) =>
  SetMetadata(READ_ONLY_ROLES_KEY, roles);

/**
 * Excepción en un handler concreto: esos roles sí pueden escribir aquí aunque
 * el controlador los tenga en solo consulta (p. ej. facturas de pedido para la
 * oficina).
 */
export const AllowWriteForRoles = (...roles: string[]) =>
  SetMetadata(ALLOW_WRITE_ROLES_KEY, roles);

@Injectable()
export class ReadOnlyRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(
      READ_ONLY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const role: string | undefined = request.user?.role;
    if (!role || !roles.includes(role)) {
      return true;
    }
    if (request.method === "GET" || request.method === "HEAD") {
      return true;
    }
    const allowed = this.reflector.get<string[] | undefined>(
      ALLOW_WRITE_ROLES_KEY,
      context.getHandler(),
    );
    if (allowed?.includes(role)) {
      return true;
    }
    throw new ForbiddenException("Tu rol solo puede consultar esta sección.");
  }
}
