import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateAssessmentDto,
  UpsertScoreDto,
} from "../dto/sicted-assessment.dto";
import { sortByPracticeCode } from "../util/sicted-practice-code.util";

/**
 * Autoevaluación (Dirección) — ciclo borrador→cerrado sobre el catálogo de
 * prácticas. Escala real 1-5 + "No aplica" (casilla separada, no un valor de
 * puntuación). Cerrada = inmutable (trigger
 * `forbid_score_update_if_assessment_closed`); mientras está en borrador se
 * puede corregir libremente (no es append-only, a diferencia del resto del
 * módulo — el manual no pide "corrección con motivo" aquí, es una
 * valoración).
 */
@Injectable()
export class SictedAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.sictedAssessment.findMany({
      where: { tenantId },
      orderBy: { assessedAt: "desc" },
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const assessment = await this.prisma.sictedAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!assessment) {
      throw new NotFoundException("Autoevaluación no encontrada");
    }
    return assessment;
  }

  async create(tenantId: string, dto: CreateAssessmentDto) {
    return this.prisma.sictedAssessment.create({
      data: { tenantId, label: dto.label },
    });
  }

  /** Prácticas activas del catálogo + la puntuación de esta autoevaluación (si existe). */
  async getScores(tenantId: string, assessmentId: string) {
    await this.getOneVisible(tenantId, assessmentId);
    const [practicesRaw, scores] = await Promise.all([
      this.prisma.sictedPractice.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: { bpSection: "asc" },
      }),
      this.prisma.sictedAssessmentScore.findMany({
        where: { tenantId, assessmentId },
      }),
    ]);
    const practices = sortByPracticeCode(practicesRaw);
    const scoreByPracticeId = new Map(scores.map((s) => [s.practiceId, s]));
    return practices.map((p) => ({
      practice: p,
      score: scoreByPracticeId.get(p.id) ?? null,
    }));
  }

  async upsertScore(
    tenantId: string,
    assessmentId: string,
    practiceId: string,
    dto: UpsertScoreDto,
  ) {
    const assessment = await this.getOneVisible(tenantId, assessmentId);
    if (assessment.status === "CLOSED") {
      throw new BadRequestException("La autoevaluación está cerrada");
    }
    const practice = await this.prisma.sictedPractice.findFirst({
      where: { id: practiceId, tenantId },
    });
    if (!practice) {
      throw new NotFoundException("Práctica no encontrada");
    }
    if (!dto.notApplicable && (dto.score === undefined || dto.score === null)) {
      throw new BadRequestException("Falta la puntuación (o marca No aplica)");
    }

    return this.prisma.sictedAssessmentScore.upsert({
      where: { assessmentId_practiceId: { assessmentId, practiceId } },
      create: {
        tenantId,
        assessmentId,
        practiceId,
        score: dto.notApplicable ? null : dto.score,
        notApplicable: !!dto.notApplicable,
        evidenceNote: dto.evidenceNote,
      },
      update: {
        score: dto.notApplicable ? null : dto.score,
        notApplicable: !!dto.notApplicable,
        evidenceNote: dto.evidenceNote,
      },
    });
  }

  async close(tenantId: string, assessmentId: string) {
    const assessment = await this.getOneVisible(tenantId, assessmentId);
    if (assessment.status === "CLOSED") {
      throw new BadRequestException("Ya está cerrada");
    }
    return this.prisma.sictedAssessment.update({
      where: { id: assessmentId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }

  /**
   * Obligatorias sin puntuar o con puntuación < 3 (el manual exige mínimo 3
   * en cada obligatoria para optar al distintivo). No cruza con evidencia
   * automática de otros módulos — eso es el motor de cobertura (sub-PR
   * posterior); aquí "cobertura" = la autoevaluación en sí misma.
   */
  async pendingMandatory(tenantId: string, assessmentId: string) {
    const rows = await this.getScores(tenantId, assessmentId);
    return rows.filter((r) => {
      if (!r.practice.isMandatory) {
        return false;
      }
      if (!r.score) {
        return true;
      } // sin puntuar (ni No aplica)
      if (r.score.notApplicable) {
        return false;
      }
      return (r.score.score ?? 0) < 3;
    });
  }
}
