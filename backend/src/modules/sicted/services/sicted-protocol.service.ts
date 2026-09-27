import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateProtocolDto,
  PublishProtocolVersionDto,
  UpdateProtocolMetaDto,
} from "../dto/sicted-protocol.dto";

/**
 * Protocolos con acuse versionado (Personas). `body` XOR `knowledgeArticleId`
 * — cuando enlaza a la Wiki, se lee su contenido en el momento (sin caché),
 * así que un cambio en el artículo se ve al instante; lo que fija la
 * versión acusada es `SictedProtocol.version`, que solo sube con
 * `publishVersion` (edición de metadatos no la toca).
 */
@Injectable()
export class SictedProtocolService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeArchived = false) {
    return this.prisma.sictedProtocol.findMany({
      where: { tenantId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ area: "asc" }, { title: "asc" }],
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const protocol = await this.prisma.sictedProtocol.findFirst({
      where: { id, tenantId },
    });
    if (!protocol) {
      throw new NotFoundException("Protocolo no encontrado");
    }
    return protocol;
  }

  /** Devuelve el protocolo con su contenido de Wiki resuelto en el momento (si aplica), no cacheado. */
  async getOneWithContent(tenantId: string, id: string) {
    const protocol = await this.getOneVisible(tenantId, id);
    if (!protocol.knowledgeArticleId) {
      return { ...protocol, wikiTitle: null, wikiContent: null };
    }
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: protocol.knowledgeArticleId, tenantId },
      select: { title: true, content: true },
    });
    return {
      ...protocol,
      wikiTitle: article?.title ?? null,
      wikiContent: article?.content ?? null,
    };
  }

  async create(tenantId: string, dto: CreateProtocolDto) {
    this.assertContentSource(dto.body, dto.knowledgeArticleId);
    return this.prisma.sictedProtocol.create({
      data: {
        tenantId,
        area: dto.area,
        title: dto.title,
        body: dto.body,
        knowledgeArticleId: dto.knowledgeArticleId,
        reviewDueAt: dto.reviewDueAt,
      },
    });
  }

  /** Edición de metadatos — NO incrementa `version`, no invalida acuses. */
  async updateMeta(tenantId: string, id: string, dto: UpdateProtocolMetaDto) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedProtocol.update({
      where: { id },
      data: { area: dto.area, title: dto.title, reviewDueAt: dto.reviewDueAt },
    });
  }

  /** Publica contenido nuevo — incrementa `version`; los acuses de la versión anterior quedan obsoletos (no se borran, quedan como evidencia histórica). */
  async publishVersion(
    tenantId: string,
    id: string,
    dto: PublishProtocolVersionDto,
  ) {
    const current = await this.getOneVisible(tenantId, id);
    this.assertContentSource(
      dto.body ?? current.body ?? undefined,
      dto.knowledgeArticleId ?? current.knowledgeArticleId ?? undefined,
    );
    return this.prisma.sictedProtocol.update({
      where: { id },
      data: {
        body: dto.body ?? current.body,
        knowledgeArticleId:
          dto.knowledgeArticleId ?? current.knowledgeArticleId,
        version: { increment: 1 },
        validFrom: new Date(),
      },
    });
  }

  async archive(tenantId: string, id: string) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedProtocol.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  private assertContentSource(
    body?: string,
    knowledgeArticleId?: string,
  ): void {
    if (!body?.trim() && !knowledgeArticleId?.trim()) {
      throw new BadRequestException(
        "El protocolo necesita contenido propio o un artículo de la Wiki enlazado",
      );
    }
  }

  // ────────────────────────────────────────────────────────────── Acuses

  /** Protocolos vigentes cuya versión actual el usuario aún no ha acusado. */
  async listPendingForUser(tenantId: string, userId: string) {
    const [protocols, acks] = await Promise.all([
      this.prisma.sictedProtocol.findMany({
        where: { tenantId, archivedAt: null },
      }),
      this.prisma.sictedProtocolAck.findMany({ where: { tenantId, userId } }),
    ]);
    const ackedByProtocolVersion = new Set(
      acks.map((a) => `${a.protocolId}:${a.protocolVersion}`),
    );
    return protocols.filter(
      (p) => !ackedByProtocolVersion.has(`${p.id}:${p.version}`),
    );
  }

  async ack(
    tenantId: string,
    protocolId: string,
    userId: string,
    userName: string,
  ) {
    const protocol = await this.getOneVisible(tenantId, protocolId);
    try {
      return await this.prisma.sictedProtocolAck.create({
        data: {
          tenantId,
          protocolId,
          protocolVersion: protocol.version,
          userId,
          userName,
        },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        throw new BadRequestException(
          "Ya has acusado esta versión del protocolo",
        );
      }
      throw err;
    }
  }

  /** Matriz protocolo × empleado: quién ha acusado la versión vigente de cada protocolo. */
  async ackMatrix(tenantId: string) {
    const [protocols, users, acks] = await Promise.all([
      this.prisma.sictedProtocol.findMany({
        where: { tenantId, archivedAt: null },
      }),
      this.prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.sictedProtocolAck.findMany({ where: { tenantId } }),
    ]);
    const ackedByProtocolVersionUser = new Set(
      acks.map((a) => `${a.protocolId}:${a.protocolVersion}:${a.userId}`),
    );
    return protocols.map((protocol) => ({
      protocolId: protocol.id,
      title: protocol.title,
      area: protocol.area,
      version: protocol.version,
      employees: users.map((u) => ({
        userId: u.id,
        userName: u.name,
        acked: ackedByProtocolVersionUser.has(
          `${protocol.id}:${protocol.version}:${u.id}`,
        ),
      })),
    }));
  }
}
