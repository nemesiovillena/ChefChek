import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { SessionService } from "../modules/auth/session.service";
import { AuthenticatedRequest } from "../types/auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers["authorization"];

    if (!authorizationHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const sessionId = authorizationHeader.replace("Bearer ", "");

    if (!sessionId) {
      throw new UnauthorizedException("Invalid authorization header format");
    }

    const validation = await this.sessionService.validateSession(sessionId);

    if (!validation.valid || !validation.user) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    request.user = validation.user as any;
    request.sessionId = sessionId;

    return true;
  }
}
