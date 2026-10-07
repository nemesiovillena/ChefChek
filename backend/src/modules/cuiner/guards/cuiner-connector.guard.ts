import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CuinerConfigService } from "../cuiner-config.service";

export const CONNECTOR_TOKEN_HEADER = "x-connector-token";

/**
 * Autentica al servicio conector instalado en el servidor de Cuiner. No hay
 * usuario: el token identifica un único tenant, que queda en req.tenantId, y
 * la configuración completa en req.cuinerConfig. Cada petición válida
 * actualiza lastSeenAt para mostrar el estado del conector en la interfaz.
 */
@Injectable()
export class CuinerConnectorGuard implements CanActivate {
  constructor(private readonly configService: CuinerConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers[CONNECTOR_TOKEN_HEADER];
    const token = Array.isArray(header) ? header[0] : header;

    const config = await this.configService.findByConnectorToken(token ?? "");
    if (!config) {
      throw new UnauthorizedException("Token del conector no válido");
    }

    request.tenantId = config.tenantId;
    request.cuinerConfig = config;
    await this.configService.touchLastSeen(config.tenantId);
    return true;
  }
}
