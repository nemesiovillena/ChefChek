import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/**
 * Guard que permite acceso público a endpoints
 * Se usa para endpoints que no requieren autenticación (ej: webhooks de Telegram)
 */
@Injectable()
export class PublicGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}
