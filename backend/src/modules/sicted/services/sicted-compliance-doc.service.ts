import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import {
  storePrivateAttachment,
  StoredAttachment,
} from "../../../common/utils/store-private-attachment.util";
import {
  CreateComplianceDocDto,
  UpdateComplianceDocDto,
} from "../dto/sicted-compliance-doc.dto";

const ATTACHMENT_CATEGORY = "sicted-compliance-docs";

/**
 * Documentos legales con caducidad (fase 9, sub-PR 3): `label` es etiqueta
 * libre con sugerencias (no enum rígido, ver plan). Documento vivo, editable
 * (como `SictedPractice`/`SictedObjective`) — se renueva subiendo un nuevo
 * `expiresAt`, no se re-crea. Renovar resetea los avisos ya enviados
 * (`dueSoonAlertedAt`/`expiredAlertedAt`) para que el aviso pueda repetirse
 * en el siguiente ciclo, mismo criterio que
 * `ChecklistMaintenanceService.createRecord` de fase 4.
 */
@Injectable()
export class SictedComplianceDocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  async list(tenantId: string, includeArchived = false) {
    return this.prisma.sictedComplianceDoc.findMany({
      where: { tenantId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const doc = await this.prisma.sictedComplianceDoc.findFirst({
      where: { id, tenantId },
    });
    if (!doc) {
      throw new NotFoundException("Documento no encontrado");
    }
    return doc;
  }

  async create(
    tenantId: string,
    dto: CreateComplianceDocDto,
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
    return this.prisma.sictedComplianceDoc.create({
      data: {
        tenantId,
        label: dto.label,
        title: dto.title,
        holderName: dto.holderName,
        issuedAt: dto.issuedAt,
        expiresAt: dto.expiresAt,
        attachment: attachment ? (attachment as unknown as object) : undefined,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateComplianceDocDto,
    file: Express.Multer.File | undefined,
  ) {
    const existing = await this.getOneVisible(tenantId, id);
    let attachment: StoredAttachment | undefined;
    if (file) {
      attachment = await storePrivateAttachment(
        this.bunny,
        ATTACHMENT_CATEGORY,
        tenantId,
        file,
      );
    }
    const expiresAtChanged =
      dto.expiresAt !== undefined &&
      dto.expiresAt.getTime() !== existing.expiresAt?.getTime();
    return this.prisma.sictedComplianceDoc.update({
      where: { id },
      data: {
        label: dto.label,
        title: dto.title,
        holderName: dto.holderName,
        issuedAt: dto.issuedAt,
        expiresAt: dto.expiresAt,
        attachment: attachment ? (attachment as unknown as object) : undefined,
        // Renovación: reabre la ventana de aviso para el próximo vencimiento.
        ...(expiresAtChanged
          ? { dueSoonAlertedAt: null, expiredAlertedAt: null }
          : {}),
      },
    });
  }

  async archive(tenantId: string, id: string) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedComplianceDoc.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async getAttachment(tenantId: string, id: string): Promise<StoredAttachment> {
    const doc = await this.getOneVisible(tenantId, id);
    if (!doc.attachment) {
      throw new NotFoundException("Adjunto no encontrado");
    }
    return doc.attachment as unknown as StoredAttachment;
  }
}
