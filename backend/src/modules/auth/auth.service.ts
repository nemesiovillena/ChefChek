import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { PrismaService } from '../../common/services/prisma.service';
import * as bcrypt from 'bcrypt';
import { Lucia, Session, User as LuciaUser } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private lucia: Lucia;
  private readonly SESSION_EXPIRY_HOURS = 24;

  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private prisma: PrismaService,
  ) {
    this.initializeLucia();
  }

  private initializeLucia() {
    const adapter = new PrismaAdapter(this.prisma, {
      user: 'user',
      session: 'session',
    });

    this.lucia = new Lucia(adapter, {
      sessionExpiresIn: new Date(Date.now() + 1000 * 60 * 60 * this.SESSION_EXPIRY_HOURS),
      sessionCookie: {
        attributes: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
        },
      },
      getUserAttributes: (attributes) => ({
        id: attributes.id,
        email: attributes.email,
        name: attributes.name,
        role: attributes.role,
        tenantId: attributes.tenantId,
        isActive: attributes.isActive,
      }),
    });
  }

  async validateUser(email: string, password: string, tenantId: string) {
    // Verificar que el tenant existe y está activo
    const tenant = await this.tenantsService.findBySlug(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Tenant not found or inactive');
    }

    // Buscar usuario por email y tenant
    const user = await this.usersService.findByEmail(email, tenant.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validar password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string, tenantSlug: string, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(email, password, tenantSlug);

    // Crear sesión con Lucia
    const session = await this.lucia.createSession(user.id, {
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        session: {
          id: session.id,
          token: this.generateSessionToken(session.id),
          expiresAt: session.expiresAt,
        },
      },
      message: 'Login successful',
    };
  }

  async logout(sessionId: string) {
    await this.lucia.invalidateSession(sessionId);

    return {
      success: true,
      data: null,
      message: 'Logout successful',
    };
  }

  async validateSession(sessionId: string) {
    try {
      const { session, user } = await this.lucia.validateSession(sessionId);

      if (!session || !user) {
        return {
          valid: false,
          user: null,
        };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
      };
    } catch (error) {
      return {
        valid: false,
        user: null,
      };
    }
  }

  private generateSessionToken(sessionId: string): string {
    const secret = process.env.LUCIA_SECRET || randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const tokenPayload = `${sessionId}:${timestamp}`;

    // En producción esto debería usar una firma criptográfica real
    return Buffer.from(tokenPayload).toString('base64');
  }

  async refreshSession(sessionId: string, ipAddress?: string, userAgent?: string) {
    // Invalidar sesión anterior
    await this.lucia.invalidateSession(sessionId);

    // Obtener el usuario asociado
    const sessionData = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!sessionData) {
      throw new UnauthorizedException('Session not found');
    }

    // Crear nueva sesión
    const newSession = await this.lucia.createSession(sessionData.userId, {
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      data: {
        session: {
          id: newSession.id,
          token: this.generateSessionToken(newSession.id),
          expiresAt: newSession.expiresAt,
        },
      },
      message: 'Session refreshed successfully',
    };
  }

  async getUserActiveSessions(userId: string, tenantId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Validar que el usuario pertenece al tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found in tenant');
    }

    return {
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })),
      message: 'Active sessions retrieved successfully',
    };
  }

  async invalidateAllUserSessions(userId: string, tenantId: string) {
    // Validar que el usuario pertenece al tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found in tenant');
    }

    await this.prisma.session.deleteMany({
      where: {
        userId,
      },
    });

    return {
      success: true,
      data: null,
      message: 'All user sessions invalidated successfully',
    };
  }
}