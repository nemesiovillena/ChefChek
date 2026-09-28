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
import { SictedPracticeCatalogService } from "./sicted-practice-catalog.service";

/**
 * Autoevaluación (Dirección) — ciclo borrador→cerrado sobre las prácticas que
 * aplican al negocio (oficio + complementarias activadas). SICTED 2026:
 * Cumple / No cumple + "No aplica" (casilla separada). Cerrada = inmutable (trigger
 * `forbid_score_update_if_assessment_closed`); mientras está en borrador se
 * puede corregir libremente (no es append-only, a diferencia del resto del
 * módulo — el manual no pide "corrección con motivo" aquí, es una
 * valoración).
 */
@Injectable()
export class SictedAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: SictedPracticeCatalogService,
  ) {}

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

  /** Prácticas que aplican al negocio + la valoración de esta autoevaluación (si existe). */
  async getScores(tenantId: string, assessmentId: string) {
    await this.getOneVisible(tenantId, assessmentId);
    const [practices, scores] = await Promise.all([
      this.catalog.listApplicable(tenantId),
      this.prisma.sictedAssessmentScore.findMany({
        where: { tenantId, assessmentId },
      }),
    ]);
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
    if (!dto.notApplicable && !dto.result) {
      throw new BadRequestException(
        "Indica si cumple o no (o marca No aplica)",
      );
    }

    return this.prisma.sictedAssessmentScore.upsert({
      where: { assessmentId_practiceId: { assessmentId, practiceId } },
      create: {
        tenantId,
        assessmentId,
        practiceId,
        result: dto.notApplicable ? null : dto.result,
        notApplicable: !!dto.notApplicable,
        evidenceNote: dto.evidenceNote,
      },
      update: {
        result: dto.notApplicable ? null : dto.result,
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
   * Obligatorias que aplican y no constan como "Cumple" (sin valorar o "No
   * cumple"): son las que bloquean el distintivo. No cruza con evidencia
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
      } // sin valorar (ni No aplica)
      if (r.score.notApplicable) {
        return false;
      }
      return r.score.result !== "CUMPLE";
    });
  }
}
