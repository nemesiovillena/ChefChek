import { Injectable, OnModuleInit } from "@nestjs/common";
import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaService } from "../../common/services/prisma.service";
import { User, Session } from "@prisma/client";

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
          httpOnly: true,
          sameSite: "lax",
        },
      },
      getUserAttributes: (attributes: any) => {
        return {
          id: attributes.id,
          email: attributes.email,
          name: attributes.name,
          role: attributes.role,
          tenantId: attributes.tenantId,
          isActive: attributes.isActive,
        };
      },
      sessionExpiresIn: {
        getPeriod: () => new Date(Date.now() + 86400000), // 24 horas
      },
    } as any);
  }

  getLucia(): Lucia {
    if (!this.lucia) {
      this.onModuleInit();
    }
    return this.lucia;
  }
}
