import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ModulesService } from "../modules/modules.service";

export const CORREO_MODULE_ID = "correo";

/**
 * Puerta del buzón del restaurante. A diferencia de TenantGuard/ModuleGuard,
 * NO deja pasar a SUPERADMIN: nunca lee el correo de un cliente, ni aunque
 * tenga un tenant en la petición. Exige tenant y el módulo `correo` activo.
 * Va después de AuthGuard y TenantGuard.
 */
@Injectable()
export class CorreoAccessGuard implements CanActivate {
  constructor(private readonly modules: ModulesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role === "SUPERADMIN") {
      throw new ForbiddenException(
        "El correo del restaurante no está disponible para superadministración.",
      );
    }
    const tenantId: string | undefined = req.tenantId;
    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required");
    }
    const enabled = await this.modules.isModuleEnabled(
      tenantId,
      CORREO_MODULE_ID,
    );
    if (!enabled) {
      throw new ForbiddenException(
        "El módulo de correo no está activo para este cliente.",
      );
    }
    return true;
  }
}
