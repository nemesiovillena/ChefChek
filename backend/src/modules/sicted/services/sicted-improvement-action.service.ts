import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateImprovementActionDto,
  UpdateImprovementActionDto,
} from "../dto/sicted-improvement-action.dto";
import { SictedAssessmentService } from "./sicted-assessment.service";

/**
 * Plan de mejora (fase 9, sub-PR 2) — confirmado 2026-09-24 contra el
 * documento real de Warynessy "Dir.6.For_Registro aspectos críticos.doc"
 * (Código incidencia, Aspecto crítico, Fecha de detección, Solución
 * propuesta, Fecha implantación, Estado, Responsable, Comentarios).
 * Entidad editable (no append-only puro): solo `closedAt` es hito
 * protegido por trigger — el resto se corrige mientras se trabaja la acción.
 */
@Injectable()
export class SictedImprovementActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: SictedAssessmentService,
  ) {}

  async list(tenantId: string, status?: string) {
    return this.prisma.sictedImprovementAction.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { code: "desc" },
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const action = await this.prisma.sictedImprovementAction.findFirst({
      where: { id, tenantId },
    });
    if (!action) {
      throw new NotFoundException("Acción de mejora no encontrada");
    }
    return action;
  }

  async create(tenantId: string, dto: CreateImprovementActionDto) {
    const code = await this.nextCode(tenantId);
    return this.prisma.sictedImprovementAction.create({
      data: {
        tenantId,
        code,
        origin: dto.origin,
        sourceRef: dto.sourceRef,
        title: dto.title,
        action: dto.action,
        responsibleName: dto.responsibleName,
        dueDate: dto.dueDate,
      },
    });
  }

  /**
   * Correlativo por tenant ("Código incidencia"), `MAX+1` — mismo patrón que
   * `checklist-incident.service.ts` (el soft-delete de otras entidades del
   * proyecto rompió secuencias basadas en autoincrement; esta tabla ni
   * siquiera tiene soft-delete, pero se mantiene el patrón por consistencia).
   */
  private async nextCode(tenantId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX("code") as max FROM "sicted_improvement_actions"
      WHERE "tenantId" = ${tenantId}
    `;
    return (result[0]?.max ?? 0) + 1;
  }

  /**
   * El trigger `forbid_milestone_rewrite` en BD impide reescribir `closedAt`
   * una vez puesto — no se duplica esa validación aquí, solo se traduce el
   * error de Postgres a uno legible si el cliente lo ignora.
   */
  async update(tenantId: string, id: string, dto: UpdateImprovementActionDto) {
    await this.getOneVisible(tenantId, id);
    try {
      return await this.prisma.sictedImprovementAction.update({
        where: { id },
        data: {
          title: dto.title,
          action: dto.action,
          responsibleName: dto.responsibleName,
          dueDate: dto.dueDate,
          status: dto.status,
          closedAt: dto.closedAt,
          evidenceNote: dto.evidenceNote,
        },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("no se puede reescribir")
      ) {
        throw new BadRequestException(
          "La fecha de implantación ya estaba registrada; no puede reescribirse.",
        );
      }
      throw err;
    }
  }

  /**
   * Genera una acción de mejora por cada práctica obligatoria pendiente
   * (sin puntuar o <3) de una autoevaluación — cierra el círculo
   * autoevaluación→plan de mejora que pide el manual (Implementation Step 6
   * de fase 9). `action`/`responsibleName`/`dueDate` quedan vacíos a
   * propósito: se rellenan después vía `update()`, mismo criterio que una
   * acción creada a mano con solo el aspecto crítico detectado.
   */
  async generateFromAssessment(tenantId: string, assessmentId: string) {
    const pending = await this.assessments.pendingMandatory(
      tenantId,
      assessmentId,
    );
    if (pending.length === 0) {
      return [];
    }

    const existing = await this.prisma.sictedImprovementAction.findMany({
      where: { tenantId, origin: "ASSESSMENT", sourceRef: assessmentId },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((e) => e.title));

    const created: Awaited<ReturnType<typeof this.create>>[] = [];
    for (const row of pending) {
      if (existingTitles.has(row.practice.title)) {
        continue; // evita duplicar si se genera dos veces sobre la misma evaluación
      }
      created.push(
        await this.create(tenantId, {
          origin: "ASSESSMENT",
          sourceRef: assessmentId,
          title: row.practice.title,
        }),
      );
    }
    return created;
  }
}
