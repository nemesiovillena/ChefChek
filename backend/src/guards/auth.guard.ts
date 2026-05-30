import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../modules/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorizationHeader = request.headers['authorization'];

    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const sessionId = authorizationHeader.replace('Bearer ', '');

    if (!sessionId) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const validation = await this.authService.validateSession(sessionId);

    if (!validation.valid || !validation.user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Adjuntar usuario al contexto de la request
    request.user = validation.user;

    return true;
  }
}