import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CloseFeedbackDto,
  CreateFeedbackDto,
  RespondFeedbackDto,
} from "../dto/sicted-feedback.dto";

/** Umbral de respuesta por defecto (horas); igual patrón que el umbral de caducidad de `etiquetado`. */
const DEFAULT_RESPONSE_SLA_HOURS = 72;
const RESPONSE_SLA_HOURS_KEY = "SICTED_FEEDBACK_RESPONSE_SLA_HOURS";
const MS_PER_HOUR = 3_600_000;

/**
 * Quejas/sugerencias/felicitaciones (CLI.3) — hitos `respondedAt`/`closedAt`
 * solo null→valor (`forbid_milestone_rewrite`); el resto de campos (status,
 * response, improvementActionId) sí se actualizan libremente al avanzar de
 * hito. Contacto del cliente siempre opcional (RGPD).
 */
@Injectable()
export class SictedFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, status?: string) {
    return this.prisma.sictedFeedback.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const feedback = await this.prisma.sictedFeedback.findFirst({
      where: { id, tenantId },
    });
    if (!feedback) {
      throw new NotFoundException("Registro no encontrado");
    }
    return feedback;
  }

  async create(tenantId: string, dto: CreateFeedbackDto) {
    return this.prisma.sictedFeedback.create({
      data: {
        tenantId,
        kind: dto.kind,
        channel: dto.channel,
        receivedByName: dto.receivedByName,
        summary: dto.summary,
        customerContact: dto.customerContact,
      },
    });
  }

  async respond(tenantId: string, id: string, dto: RespondFeedbackDto) {
    const current = await this.getOneVisible(tenantId, id);
    if (current.respondedAt) {
      throw new BadRequestException("Ya tiene respuesta registrada");
    }
    return this.prisma.sictedFeedback.update({
      where: { id },
      data: {
        response: dto.response,
        respondedByName: dto.respondedByName,
        respondedAt: new Date(),
        status: "RESPONDED",
      },
    });
  }

  async close(tenantId: string, id: string, dto: CloseFeedbackDto) {
    const current = await this.getOneVisible(tenantId, id);
    if (current.closedAt) {
      throw new BadRequestException("Ya está cerrado");
    }
    return this.prisma.sictedFeedback.update({
      where: { id },
      data: {
        closedAt: new Date(),
        status: "CLOSED",
        improvementActionId:
          dto.improvementActionId ?? current.improvementActionId,
      },
    });
  }

  /** Abiertas sin respuesta que superan el umbral de horas configurado para el tenant. */
  async overdue(tenantId: string, now: Date = new Date()) {
    const slaHours = await this.getResponseSlaHours(tenantId);
    const threshold = new Date(now.getTime() - slaHours * MS_PER_HOUR);
    const items = await this.prisma.sictedFeedback.findMany({
      where: { tenantId, respondedAt: null, receivedAt: { lt: threshold } },
      orderBy: { receivedAt: "asc" },
    });
    return { slaHours, items };
  }

  private async getResponseSlaHours(tenantId: string): Promise<number> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: RESPONSE_SLA_HOURS_KEY } },
    });
    const parsed = row ? Number(row.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_RESPONSE_SLA_HOURS;
  }
}
