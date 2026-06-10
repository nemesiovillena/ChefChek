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

    // Validate session antes de refresh - previne refresh de sesiones ya invalidadas
    const { session, user } = await lucia.validateSession(sessionId);

    if (!session || !user) {
      throw new Error("Invalid session");
    }

    // ATOMIC: Invalidar sesión actual y crear nueva usando Prisma transaction
    // Esto previne race condition donde múltiples requests pueden crear sesiones duplicadas
    // o donde un request puede invalidar la sesión mientras otro intenta validarla
    const newSession = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar que la sesión sigue siendo válida dentro de la transacción
      // (previne caso donde session fue invalidada entre validation y transaction)
      const existingSession = await tx.session.findUnique({
        where: { id: sessionId },
      });

      if (!existingSession) {
        throw new Error("Session already invalidated");
      }

      // 2. Invalidar sesión actual dentro de transacción
      await tx.session.delete({
        where: { id: sessionId },
      });

      // 3. Crear nueva sesión dentro de transacción usando formato Lucia
      // Lucia session ID format: hexadecimal string
      const sessionIdBuffer = Buffer.alloc(32);
      crypto.getRandomValues(sessionIdBuffer);
      const newSessionId = sessionIdBuffer.toString("hex");

      return tx.session.create({
        data: {
          id: newSessionId,
          userId: user.id,
          ipAddress: ipAddress || existingSession.ipAddress,
          userAgent: userAgent || existingSession.userAgent,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        },
      });
    });

    const sessionCookie = lucia.createSessionCookie(newSession.id);

    return {
      session: newSession,
      cookie: sessionCookie.serialize(),
    };
  }
}
