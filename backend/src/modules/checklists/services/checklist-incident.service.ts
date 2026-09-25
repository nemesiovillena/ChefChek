import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import {
  CreateChecklistIncidentDto,
  UpdateChecklistIncidentDto,
} from "../dto/checklist-incident.dto";

/**
 * Parte de avería simple (Ins-Bas.16) y parte de acciones correctivas (PAC)
 * — dos formularios reales distintos, una sola tabla con `kind`. Sin paso de
 * supervisión (ningún documento real de mantenimiento/averías lleva firma de
 * supervisor, a diferencia del modo INSPECTION de fase 2).
 */
@Injectable()
export class ChecklistIncidentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    module: ChecklistConsumerModule,
    filters: { status?: string; kind?: string; assetId?: string },
  ) {
    return this.prisma.checklistIncident.findMany({
      where: {
        tenantId,
        usedByModules: { has: module },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.assetId ? { assetId: filters.assetId } : {}),
      },
      include: { asset: { select: { id: true, name: true, category: true } } },
      orderBy: { detectedAt: "desc" },
      take: 200,
    });
  }

  async getOneVisible(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
  ) {
    const incident = await this.prisma.checklistIncident.findFirst({
      where: { id, tenantId, usedByModules: { has: module } },
      include: { asset: { select: { id: true, name: true, category: true } } },
    });
    if (!incident) {
      throw new NotFoundException("Incidencia no encontrada");
    }
    return incident;
  }

  async create(
    tenantId: string,
    module: ChecklistConsumerModule,
    dto: CreateChecklistIncidentDto,
  ) {
    if (dto.assetId) {
      const asset = await this.prisma.checklistAsset.findFirst({
        where: { id: dto.assetId, tenantId, usedByModules: { has: module } },
      });
      if (!asset) {
        throw new NotFoundException("Equipo no encontrado");
      }
    }

    if (dto.kind === "CORRECTIVE_ACTION" && !dto.deviationDescription?.trim()) {
      throw new BadRequestException(
        "PAC: la descripción de la desviación es obligatoria",
      );
    }

    const partNumber =
      dto.kind === "CORRECTIVE_ACTION"
        ? await this.nextPartNumber(tenantId)
        : null;

    return this.prisma.checklistIncident.create({
      data: {
        tenantId,
        assetId: dto.assetId,
        usedByModules: [module],
        kind: dto.kind,
        partNumber,
        status: "OPEN",
        detectedByName: dto.detectedByName,
        reportedTo: dto.reportedTo,
        faultType: dto.faultType,
        processOrEquipment: dto.processOrEquipment,
        deviationDescription: dto.deviationDescription,
        deviationCause: dto.deviationCause,
        responsibleName: dto.responsibleName,
        deadline: dto.deadline,
        affectedLot: dto.affectedLot,
        affectedProductName: dto.affectedProductName,
        affectedQuantity: dto.affectedQuantity,
      },
    });
  }

  /**
   * Correlativo por tenant ("Parte Nº"), solo CORRECTIVE_ACTION. `MAX+1` en
   * vez de un contador dedicado: el soft-delete de otras entidades del
   * proyecto ya rompió secuencias basadas en autoincrement (ver memoria del
   * proyecto); esta tabla ni siquiera tiene soft-delete, pero se mantiene el
   * mismo patrón por consistencia y porque no hay concurrencia real (un
   * restaurante, no alta frecuencia).
   */
  private async nextPartNumber(tenantId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX("partNumber") as max FROM "checklist_incidents"
      WHERE "tenantId" = ${tenantId} AND kind = 'CORRECTIVE_ACTION'
    `;
    return (result[0]?.max ?? 0) + 1;
  }

  /**
   * Avanza hitos / cambia estado. El trigger `forbid_milestone_rewrite` en
   * BD impide reescribir un campo de fecha/hora ya puesto — no se duplica
   * esa validación aquí, solo se deja pasar el intento y se traduce el error
   * de Postgres si el cliente ignoró el estado actual.
   */
  async update(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
    dto: UpdateChecklistIncidentDto,
  ) {
    await this.getOneVisible(tenantId, module, id);
    try {
      return await this.prisma.checklistIncident.update({
        where: { id },
        data: {
          status: dto.status,
          reportedTo: dto.reportedTo,
          faultType: dto.faultType,
          technicianNotifiedAt: dto.technicianNotifiedAt,
          serviceStartedAt: dto.serviceStartedAt,
          serviceEndedAt: dto.serviceEndedAt,
          resolvedAt: dto.resolvedAt,
          correctiveMeasure: dto.correctiveMeasure,
          resolution: dto.resolution,
          deadline: dto.deadline,
        },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("no se puede reescribir")
      ) {
        throw new BadRequestException(
          "Ese hito ya estaba registrado; no puede reescribirse.",
        );
      }
      throw err;
    }
  }
}
