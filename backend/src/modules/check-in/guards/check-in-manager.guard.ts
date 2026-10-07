import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

/**
 * Gestión de Check-In (fichas con DNI y Seguridad Social, configuración,
 * presencia): nunca desde una cuenta compartida, tenga el rol que tenga. Un
 * dispositivo compartido lo usa cualquiera que pase por delante, así que los
 * datos personales solo se muestran a una persona identificada.
 *
 * Complementa a `@Roles(CHECK_IN_MANAGER_ROLE)`: el rol decide quién puede
 * gestionar; este guard exige además que sea desde su cuenta personal.
 */
@Injectable()
export class CheckInManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.isSharedAccount === true) {
      throw new ForbiddenException(
        "Esta sección no está disponible en cuentas compartidas.",
      );
    }
    return true;
  }
}
