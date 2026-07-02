import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("User not authenticated");
    }

    if (user.role !== "SUPERADMIN") {
      throw new ForbiddenException(
        "Solo SUPERADMIN puede acceder a esta operación.",
      );
    }

    return true;
  }
}
