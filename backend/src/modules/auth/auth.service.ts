import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { TenantsService } from "../tenants/tenants.service";
import { SessionService } from "./session.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private sessionService: SessionService,
  ) {}

  async validateUser(email: string, password: string, tenantId: string) {
    // findBySlug lanza NotFoundException cuando el tenant está dado de baja
    // (el Prisma extension filtra deletedAt:null). Se captura para distinguir
    // "cliente dado de baja" de "no existe".
    let tenant: Awaited<ReturnType<TenantsService["findBySlug"]>> | null = null;
    try {
      tenant = await this.tenantsService.findBySlug(tenantId);
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
    }
    if (!tenant) {
      const trashed =
        await this.tenantsService.findBySlugIncludingDeleted(tenantId);
      if (trashed?.deletedAt) {
        throw new UnauthorizedException(
          "Cliente dado de baja. Contacta con soporte.",
        );
      }
      throw new UnauthorizedException("Tenant not found or inactive");
    }
    if (!tenant.isActive) {
      throw new UnauthorizedException("Tenant not found or inactive");
    }

    const user = await this.usersService.findByEmail(email, tenant.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  async login(
    email: string,
    password: string,
    tenantSlug: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.validateUser(email, password, tenantSlug);

    const { session, cookie } = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          avatarUrl: user.avatarUrl,
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
        cookie,
      },
      message: "Login successful",
    };
  }

  async logout(sessionId: string) {
    const { cookie } = await this.sessionService.invalidateSession(sessionId);

    return {
      success: true,
      data: { cookie },
      message: "Logout successful",
    };
  }

  async validateSession(sessionId: string) {
    const validation = await this.sessionService.validateSession(sessionId);

    if (!validation.valid || !validation.user) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    return {
      valid: true,
      user: validation.user,
    };
  }

  async register(
    email: string,
    password: string,
    name: string,
    tenantSlug: string,
    role: "ADMIN" | "USER" | "VIEWER" = "USER",
  ) {
    let tenant: Awaited<ReturnType<TenantsService["findBySlug"]>> | null = null;
    try {
      tenant = await this.tenantsService.findBySlug(tenantSlug);
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
    }
    if (!tenant) {
      const trashed =
        await this.tenantsService.findBySlugIncludingDeleted(tenantSlug);
      if (trashed?.deletedAt) {
        throw new BadRequestException(
          "Cliente dado de baja. Contacta con soporte.",
        );
      }
      throw new BadRequestException("Tenant not found or inactive");
    }
    if (!tenant.isActive) {
      throw new BadRequestException("Tenant not found or inactive");
    }

    const existingUser = await this.usersService.findByEmail(email, tenant.id);
    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await this.usersService.create(
      {
        email,
        password: passwordHash,
        name,
        role,
        tenantId: tenant.id,
      },
      tenant.id,
    );

    return {
      success: true,
      data: createdUser.data,
      message: "Registration successful",
    };
  }

  async superadminLogin(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.usersService.findSuperadminByEmail(email);

    if (!user || !user.isActive || user.role !== "SUPERADMIN") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { session, cookie } = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: null,
        },
        session: { id: session.id, expiresAt: session.expiresAt },
        cookie,
      },
      message: "Login successful",
    };
  }

  async refreshSession(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const { session, cookie } = await this.sessionService.refreshSession(
        sessionId,
        ipAddress,
        userAgent,
      );

      return {
        success: true,
        data: {
          id: session.id,
          expiresAt: session.expiresAt,
          cookie,
        },
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }

  async getUserActiveSessions(userId: string, tenantId?: string) {
    const sessions = await this.sessionService.getUserActiveSessions(
      userId,
      tenantId,
    );

    return {
      success: true,
      data: sessions,
    };
  }

  async invalidateAllUserSessions(userId: string, tenantId?: string) {
    const result = await this.sessionService.invalidateAllUserSessions(userId);

    return {
      success: true,
      data: result,
    };
  }
}
