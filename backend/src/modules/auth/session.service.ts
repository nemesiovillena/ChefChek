import { Injectable } from "@nestjs/common";
import { LuciaAuthService } from "./lucia-auth.service";
import { PrismaService } from "../../common/services/prisma.service";
import { Lucia } from "lucia";

@Injectable()
export class SessionService {
  constructor(
    private luciaAuthService: LuciaAuthService,
    private prisma: PrismaService,
  ) {}

  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    const lucia = this.luciaAuthService.getLucia();

    const session = await lucia.createSession(userId, {});

    const sessionCookie = lucia.createSessionCookie(session.id);

    return {
      session,
      cookie: sessionCookie.serialize(),
    };
  }

  async validateSession(sessionId: string) {
    const lucia = this.luciaAuthService.getLucia();

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session) {
      return {
        valid: false,
        user: null,
        session: null,
      };
    }

    return {
      valid: true,
      user,
      session,
    };
  }

  async invalidateSession(sessionId: string) {
    const lucia = this.luciaAuthService.getLucia();

    await lucia.invalidateSession(sessionId);

    const sessionCookie = lucia.createBlankSessionCookie();

    return {
      cookie: sessionCookie.serialize(),
    };
  }

  async invalidateAllUserSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: "All sessions invalidated",
    };
  }

  async getUserActiveSessions(userId: string, tenantId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        user: { tenantId },
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions;
  }

  async refreshSession(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const lucia = this.luciaAuthService.getLucia();

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session) {
      throw new Error("Invalid session");
    }

    // Invalidar sesión actual
    await lucia.invalidateSession(sessionId);

    // Crear nueva sesión
    const newSession = await lucia.createSession(user.id, {
      ipAddress,
      userAgent,
    });

    const sessionCookie = lucia.createSessionCookie(newSession.id);

    return {
      session: newSession,
      cookie: sessionCookie.serialize(),
    };
  }
}
