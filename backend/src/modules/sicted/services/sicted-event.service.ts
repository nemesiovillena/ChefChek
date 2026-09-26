import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import {
  storePrivateAttachment,
  StoredAttachment,
} from "../../../common/utils/store-private-attachment.util";
import { CreateEventDto } from "../dto/sicted-event.dto";

const ATTACHMENT_CATEGORY = "sicted-events";

/**
 * Participación (fase 9, sub-PR 3): grupos de mejora, formación del destino,
 * evaluación externa — evidencia append-only pura (`forbid_mutation`), sin
 * ningún hito que corregir después a diferencia del resto del módulo.
 */
@Injectable()
export class SictedEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  async list(tenantId: string, kind?: string) {
    return this.prisma.sictedEvent.findMany({
      where: { tenantId, ...(kind ? { kind } : {}) },
      orderBy: { eventDate: "desc" },
    });
  }

  async create(
    tenantId: string,
    dto: CreateEventDto,
    file: Express.Multer.File | undefined,
  ) {
    let attachment: StoredAttachment | undefined;
    if (file) {
      attachment = await storePrivateAttachment(
        this.bunny,
        ATTACHMENT_CATEGORY,
        tenantId,
        file,
      );
    }
    return this.prisma.sictedEvent.create({
      data: {
        tenantId,
        kind: dto.kind,
        title: dto.title,
        eventDate: dto.eventDate,
        attended: dto.attended ?? true,
        notes: dto.notes,
        attachment: attachment ? (attachment as unknown as object) : undefined,
      },
    });
  }

  async getAttachment(tenantId: string, id: string): Promise<StoredAttachment> {
    const event = await this.prisma.sictedEvent.findFirst({
      where: { id, tenantId },
    });
    if (!event || !event.attachment) {
      throw new NotFoundException("Adjunto no encontrado");
    }
    return event.attachment as unknown as StoredAttachment;
  }
}
