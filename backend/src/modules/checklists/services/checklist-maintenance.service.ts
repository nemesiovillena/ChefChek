import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import {
  storePrivateAttachment,
  type StoredAttachment,
} from "../../../common/utils/store-private-attachment.util";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import {
  CreateChecklistMaintenancePlanDto,
  CreateChecklistMaintenanceRecordDto,
  UpdateChecklistMaintenancePlanDto,
} from "../dto/checklist-maintenance-plan.dto";
import { addMonthsClamped } from "../util/checklist-maintenance-date.util";

const ATTACHMENT_CATEGORY = "sicted-maintenance";

/**
 * Planes de revisión (el calendario) y registros de revisión realizada (la
 * evidencia, SOLO INSERT) del motor de mantenimiento compartido (fase 4).
 */
@Injectable()
export class ChecklistMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  // ─────────────────────────────────────────────────────────────── Planes

  async listPlans(
    tenantId: string,
    module: ChecklistConsumerModule,
    assetId?: string,
  ) {
    return this.prisma.checklistMaintenancePlan.findMany({
      where: {
        tenantId,
        isActive: true,
        asset: { usedByModules: { has: module } },
        ...(assetId ? { assetId } : {}),
      },
      include: { asset: { select: { id: true, name: true, category: true } } },
      orderBy: { nextDueAt: "asc" },
    });
  }

  async getPlanVisible(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
  ) {
    const plan = await this.prisma.checklistMaintenancePlan.findFirst({
      where: { id, tenantId, asset: { usedByModules: { has: module } } },
      include: { asset: { select: { id: true, name: true, category: true } } },
    });
    if (!plan) {
      throw new NotFoundException("Plan de mantenimiento no encontrado");
    }
    return plan;
  }

  async createPlan(
    tenantId: string,
    module: ChecklistConsumerModule,
    dto: CreateChecklistMaintenancePlanDto,
  ) {
    // Verifica visibilidad del equipo antes de vincular el plan (mismo filtro usedByModules).
    const asset = await this.prisma.checklistAsset.findFirst({
      where: { id: dto.assetId, tenantId, usedByModules: { has: module } },
    });
    if (!asset) {
      throw new NotFoundException("Equipo no encontrado");
    }
    return this.prisma.checklistMaintenancePlan.create({
      data: {
        tenantId,
        assetId: dto.assetId,
        title: dto.title,
        periodicityMonths: dto.periodicityMonths,
        nextDueAt:
          dto.nextDueAt ?? addMonthsClamped(new Date(), dto.periodicityMonths),
        externalProvider: dto.externalProvider ?? false,
        responsible: dto.responsible,
      },
    });
  }

  async updatePlan(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
    dto: UpdateChecklistMaintenancePlanDto,
  ) {
    await this.getPlanVisible(tenantId, module, id);
    return this.prisma.checklistMaintenancePlan.update({
      where: { id },
      data: {
        title: dto.title,
        periodicityMonths: dto.periodicityMonths,
        nextDueAt: dto.nextDueAt,
        externalProvider: dto.externalProvider,
        responsible: dto.responsible,
        isActive: dto.isActive,
      },
    });
  }

  async archivePlan(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
  ) {
    await this.getPlanVisible(tenantId, module, id);
    return this.prisma.checklistMaintenancePlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ────────────────────────────────────────────────────────── Registros

  async listRecords(
    tenantId: string,
    module: ChecklistConsumerModule,
    planId: string,
  ) {
    await this.getPlanVisible(tenantId, module, planId);
    return this.prisma.checklistMaintenanceRecord.findMany({
      where: { tenantId, planId },
      orderBy: { performedAt: "desc" },
    });
  }

  /**
   * Registra una revisión hecha: crea el `Record` (evidencia, nunca se
   * edita) y recalcula `lastDoneAt`/`nextDueAt` del plan (que sí es
   * mutable — no es evidencia). Sube los adjuntos a la zona privada antes de
   * insertar la fila (si algo falla subiendo, no queda un Record sin fichero
   * referenciado).
   */
  async createRecord(
    tenantId: string,
    module: ChecklistConsumerModule,
    planId: string,
    recordedByUserId: string,
    dto: CreateChecklistMaintenanceRecordDto,
    files: Express.Multer.File[],
  ) {
    const plan = await this.getPlanVisible(tenantId, module, planId);
    const performedAt = dto.performedAt ?? new Date();

    const attachments: StoredAttachment[] = [];
    for (const file of files) {
      attachments.push(
        await storePrivateAttachment(
          this.bunny,
          ATTACHMENT_CATEGORY,
          tenantId,
          file,
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.checklistMaintenanceRecord.create({
        data: {
          tenantId,
          planId,
          assetId: plan.assetId,
          performedAt,
          performedByName: dto.performedByName,
          providerName: dto.providerName,
          cost: dto.cost,
          notes: dto.notes,
          attachments: attachments as unknown as object,
          recordedByUserId,
        },
      });
      await tx.checklistMaintenancePlan.update({
        where: { id: planId },
        data: {
          lastDoneAt: performedAt,
          nextDueAt: addMonthsClamped(performedAt, plan.periodicityMonths),
          // nextDueAt avanza: el ciclo de avisos vuelve a empezar.
          dueSoonAlertedAt: null,
          overdueAlertedAt: null,
        },
      });
      return record;
    });
  }

  /**
   * Adjunto `index`-ésimo de un registro, con la comprobación de tenant que
   * exige la descarga (nunca servir estáticos abiertos — ver plan de fase 4).
   */
  async getRecordAttachment(
    tenantId: string,
    recordId: string,
    index: number,
  ): Promise<StoredAttachment> {
    const record = await this.prisma.checklistMaintenanceRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) {
      throw new NotFoundException("Registro no encontrado");
    }
    const attachments = record.attachments as unknown as StoredAttachment[];
    const attachment = attachments[index];
    if (!attachment) {
      throw new NotFoundException("Adjunto no encontrado");
    }
    return attachment;
  }
}
