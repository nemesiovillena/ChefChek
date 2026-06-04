import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../common/services/prisma.service";
import { AuthUser, AuthenticatedRequest } from "../types/auth.types";

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Si no hay token, continuar sin establecer req.user
      return next();
    }

    const token = authHeader.substring(7);
    const authReq = req as AuthenticatedRequest;

    try {
      const payload = this.jwtService.verify(token);

      // Verificar que la sesión existe y está activa
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId || token },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException("Session expired or invalid");
      }

      // Establecer req.user con el usuario autenticado
      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        tenantId: session.user.tenantId,
      };

      authReq.user = authUser;

      next();
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
