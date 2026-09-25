import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { BunnyStorageService } from "../../../common/bunny/bunny-storage.service";
import {
  storePrivateAttachment,
  StoredAttachment,
} from "../../../common/utils/store-private-attachment.util";
import {
  AttendanceBatchEntry,
  CreateTrainingActionDto,
  CreateTrainingPlanDto,
  TRAINING_TOPICS,
  TrainingTopic,
  UpdateTrainingPlanStatusDto,
} from "../dto/sicted-training.dto";

const ATTACHMENT_CATEGORY = "sicted-training";

/**
 * Plan anual de formación (Personas): acciones por tema, asistencia
 * append-only (con certificado opcional, mismo adjunto para todo el lote —
 * los datos son inmutables una vez insertados, así que el certificado tiene
 * que llegar en el mismo POST, no se puede adjuntar después).
 */
@Injectable()
export class SictedTrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyStorageService,
  ) {}

  // ────────────────────────────────────────────────────────────── Planes

  async listPlans(tenantId: string) {
    return this.prisma.sictedTrainingPlan.findMany({
      where: { tenantId },
      orderBy: { year: "desc" },
    });
  }

  async getOrCreatePlan(tenantId: string, dto: CreateTrainingPlanDto) {
    return this.prisma.sictedTrainingPlan.upsert({
      where: { tenantId_year: { tenantId, year: dto.year } },
      create: { tenantId, year: dto.year },
      update: {},
    });
  }

  async updatePlanStatus(
    tenantId: string,
    id: string,
    dto: UpdateTrainingPlanStatusDto,
  ) {
    await this.getVisiblePlan(tenantId, id);
    return this.prisma.sictedTrainingPlan.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  private async getVisiblePlan(tenantId: string, id: string) {
    const plan = await this.prisma.sictedTrainingPlan.findFirst({
      where: { id, tenantId },
    });
    if (!plan) {
      throw new NotFoundException("Plan de formación no encontrado");
    }
    return plan;
  }

  // ──────────────────────────────────────────────────────────── Acciones

  async listActions(tenantId: string, planId: string) {
    await this.getVisiblePlan(tenantId, planId);
    return this.prisma.sictedTrainingAction.findMany({
      where: { tenantId, planId },
      include: { attendances: { select: { userId: true, attended: true } } },
      orderBy: { plannedDate: "asc" },
    });
  }

  async createAction(
    tenantId: string,
    planId: string,
    dto: CreateTrainingActionDto,
  ) {
    await this.getVisiblePlan(tenantId, planId);
    return this.prisma.sictedTrainingAction.create({
      data: {
        tenantId,
        planId,
        topic: dto.topic,
        title: dto.title,
        plannedDate: dto.plannedDate,
        hours: dto.hours,
        trainer: dto.trainer,
      },
    });
  }

  private async getVisibleAction(tenantId: string, id: string) {
    const action = await this.prisma.sictedTrainingAction.findFirst({
      where: { id, tenantId },
    });
    if (!action) {
      throw new NotFoundException("Acción formativa no encontrada");
    }
    return action;
  }

  async markActionDone(tenantId: string, id: string) {
    await this.getVisibleAction(tenantId, id);
    return this.prisma.sictedTrainingAction.update({
      where: { id },
      data: { done: true, doneAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────────────── Asistencia

  async recordAttendanceBatch(
    tenantId: string,
    actionId: string,
    entries: AttendanceBatchEntry[],
    certificateFile: Express.Multer.File | undefined,
  ) {
    await this.getVisibleAction(tenantId, actionId);
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new BadRequestException(
        "La lista de asistentes no puede estar vacía",
      );
    }
    for (const entry of entries) {
      if (typeof entry.userId !== "string" || !entry.userId.trim()) {
        throw new BadRequestException("Cada asistente necesita userId");
      }
      if (typeof entry.attended !== "boolean") {
        throw new BadRequestException(
          "Cada asistente necesita attended (booleano)",
        );
      }
    }

    let certificate: StoredAttachment | undefined;
    if (certificateFile) {
      certificate = await storePrivateAttachment(
        this.bunny,
        ATTACHMENT_CATEGORY,
        tenantId,
        certificateFile,
      );
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: entries.map((e) => e.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const missing = entries.filter((e) => !nameById.has(e.userId));
    if (missing.length > 0) {
      throw new BadRequestException(
        "Algún asistente no pertenece a este tenant",
      );
    }

    // `createMany` + `skipDuplicates` en vez de `upsert`: un `upsert` genera
    // `INSERT ... ON CONFLICT DO UPDATE`, y el trigger `forbid_mutation`
    // bloquearía esa rama UPDATE con un error de Postgres en cuanto el lote
    // se reenviara. `skipDuplicates` solo hace `DO NOTHING` — reenviar el
    // mismo lote es un no-op seguro, sin tocar el trigger de inalterabilidad.
    await this.prisma.sictedTrainingAttendance.createMany({
      data: entries.map((entry) => ({
        tenantId,
        actionId,
        userId: entry.userId,
        userName: nameById.get(entry.userId) as string,
        attended: entry.attended,
        certificate: certificate
          ? (certificate as unknown as object)
          : undefined,
      })),
      skipDuplicates: true,
    });
    return this.listAttendance(tenantId, actionId);
  }

  async listAttendance(tenantId: string, actionId: string) {
    await this.getVisibleAction(tenantId, actionId);
    return this.prisma.sictedTrainingAttendance.findMany({
      where: { tenantId, actionId },
      orderBy: { userName: "asc" },
    });
  }

  /** Cobertura de los 4 temas mínimos del manual (Personas) por año. */
  async coverage(tenantId: string, year: number) {
    const plan = await this.prisma.sictedTrainingPlan.findFirst({
      where: { tenantId, year },
      include: { actions: { select: { topic: true, done: true } } },
    });
    const topicsCovered = new Set(
      (plan?.actions ?? []).filter((a) => a.done).map((a) => a.topic),
    );
    const minimumTopics: TrainingTopic[] = [
      "ATENCION_CLIENTE",
      "IDIOMAS",
      "SOSTENIBILIDAD",
      "ALERGENOS",
    ];
    return {
      year,
      planExists: !!plan,
      topics: TRAINING_TOPICS.map((topic) => ({
        topic,
        covered: topicsCovered.has(topic),
        required: minimumTopics.includes(topic),
      })),
    };
  }
}
