import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import {
  storePrivateAttachment,
  StoredAttachment,
} from "../../../common/utils/store-private-attachment.util";

const ATTACHMENT_CATEGORY = "sicted-improvement-actions";

/**
 * Evidencia adjunta de una acción del plan de mejora. El programa SICTED
 * exige evidencias fechadas y específicas del servicio; se guardan como
 * adjunto privado (mismo patrón que eventos y documentos legales). Subir una
 * nueva sustituye a la anterior en la acción.
 */
@Injectable()
export class SictedImprovementEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  private async getAction(tenantId: string, id: string) {
    const action = await this.prisma.sictedImprovementAction.findFirst({
      where: { id, tenantId },
    });
    if (!action) {
      throw new NotFoundException("Acción de mejora no encontrada");
    }
    return action;
  }

  async attach(tenantId: string, id: string, file: Express.Multer.File) {
    await this.getAction(tenantId, id);
    const attachment = await storePrivateAttachment(
      this.bunny,
      ATTACHMENT_CATEGORY,
      tenantId,
      file,
    );
    return this.prisma.sictedImprovementAction.update({
      where: { id },
      data: { attachment: attachment as unknown as object },
    });
  }

  async getAttachment(tenantId: string, id: string): Promise<StoredAttachment> {
    const action = await this.getAction(tenantId, id);
    if (!action.attachment) {
      throw new NotFoundException("Adjunto no encontrado");
    }
    return action.attachment as unknown as StoredAttachment;
  }
}
