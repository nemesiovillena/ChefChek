import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { AuditAction, EntityType } from "../../common/services/audit.service";

/**
 * Pestaña «Accesos» (solo gerencia): quién abrió o envió qué correo y cuándo.
 * Lee `audit_logs` del tenant actual, del más reciente al más antiguo.
 */
const PAGE_SIZE = 50;

export interface MailAccessEntry {
  id: string;
  createdAt: string;
  /** «Abrió» un correo/adjunto o «Envió» uno. */
  kind: "view" | "send";
  to: string | null;
  userName: string;
  folder: string;
  subject: string | null;
  from: string | null;
  part: string | null;
}

@Injectable()
export class CorreoAccessLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    cursor?: string,
  ): Promise<{ entries: MailAccessEntry[]; nextCursor: string | null }> {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId, entityType: EntityType.MAIL_MESSAGE },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { name: true, email: true } } },
    });
    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    return {
      entries: page.map((r) => {
        const details = (r.details ?? {}) as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === "string" && v ? v : null);
        const isSend = r.action === AuditAction.CREATE;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          kind: isSend ? ("send" as const) : ("view" as const),
          to: str(details.to),
          userName: r.user?.name || r.user?.email || "—",
          // entityId = carpeta:uidValidity:uid (la carpeta puede llevar ":")
          folder: isSend
            ? "Enviados"
            : r.entityId.split(":").slice(0, -2).join(":") || r.entityId,
          subject: str(details.subject),
          from: str(details.from),
          part: str(details.part),
        };
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
