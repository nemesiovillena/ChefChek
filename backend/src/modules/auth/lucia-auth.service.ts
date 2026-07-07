import { Injectable, OnModuleInit } from "@nestjs/common";
import { Lucia, TimeSpan } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaService } from "../../common/services/prisma.service";
import { User, Session } from "@prisma/client";

interface LuciaUserAttributes {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  avatarUrl: string | null;
}

@Injectable()
export class LuciaAuthService implements OnModuleInit {
  private lucia: Lucia;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const adapter = new PrismaAdapter(
      this.prisma.session as any,
      this.prisma.user as any,
    );

    this.lucia = new Lucia(adapter, {
      sessionCookie: {
        attributes: {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        },
      },
      getUserAttributes: (attributes: LuciaUserAttributes) => {
        return {
          id: attributes.id,
          email: attributes.email,
          name: attributes.name,
          role: attributes.role,
          tenantId: attributes.tenantId,
          isActive: attributes.isActive,
          avatarUrl: attributes.avatarUrl,
        };
      },
      sessionExpiresIn: new TimeSpan(24, "h"), // 24 horas
    });
  }

  getLucia(): Lucia {
    if (!this.lucia) {
      this.onModuleInit();
    }
    return this.lucia;
  }
}
