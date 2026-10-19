import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";

/**
 * Puestos de trabajo gestionados desde Equipo, con o sin SICTED activo.
 *
 * Usan las mismas tablas que las fichas de puesto de SICTED
 * (`sicted_job_profiles` / `sicted_job_assignments`): un puesto creado aquí
 * aparece en SICTED y al revés. Aquí solo se maneja lo común (nombre, quién
 * lo tiene y qué apartados ve); misión, tareas y áreas de hojas siguen en
 * SICTED. Una persona tiene un puesto vigente a la vez y el historial nunca
 * se borra (se cierra con `until`).
 */
@Injectable()
export class TeamPositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleAccess: RoleAccessService,
  ) {}

  async list(tenantId: string) {
    const positions = await this.prisma.sictedJobProfile.findMany({
      where: { tenantId, archivedAt: null },
      select: {
        id: true,
        title: true,
        assignments: {
          where: { until: null },
          select: { userId: true, userName: true },
          orderBy: { userName: "asc" },
        },
      },
      orderBy: { title: "asc" },
    });
    return Promise.all(
      positions.map(async (p) => ({
        id: p.id,
        title: p.title,
        users: p.assignments.map((a) => ({ id: a.userId, name: a.userName })),
        access: await this.roleAccess.getPositionAccess(tenantId, p.id),
      })),
    );
  }

  async create(tenantId: string, title: string) {
    const clean = await this.assertUniqueTitle(tenantId, title);
    return this.prisma.sictedJobProfile.create({
      data: { tenantId, title: clean },
      select: { id: true, title: true },
    });
  }

  async rename(tenantId: string, id: string, title: string) {
    await this.getActive(tenantId, id);
    const clean = await this.assertUniqueTitle(tenantId, title, id);
    return this.prisma.sictedJobProfile.update({
      where: { id },
      data: { title: clean, version: { increment: 1 } },
      select: { id: true, title: true },
    });
  }

  /**
   * Archiva el puesto. Sus personas se quedan sin puesto vigente (se cierra
   * la asignación) para que no hereden restricciones de un puesto que ya no
   * se ve en ningún sitio.
   */
  async archive(tenantId: string, id: string) {
    await this.getActive(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.sictedJobAssignment.updateMany({
        where: { tenantId, profileId: id, until: null },
        data: { until: new Date() },
      }),
      this.prisma.sictedJobProfile.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
    ]);
    return { id };
  }

  /** Cambia el puesto vigente de una persona (`null` = sin puesto). */
  async setUserPosition(
    tenantId: string,
    userId: string,
    positionId: string | null,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, name: true },
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }
    if (positionId) {
      await this.getActive(tenantId, positionId);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.sictedJobAssignment.updateMany({
        where: { tenantId, userId, until: null },
        data: { until: new Date() },
      });
      if (!positionId) {
        return { userId, positionId: null };
      }
      await tx.sictedJobAssignment.create({
        data: {
          tenantId,
          profileId: positionId,
          userId: user.id,
          userName: user.name,
        },
      });
      return { userId, positionId };
    });
  }

  async updateAccess(
    tenantId: string,
    id: string,
    editorId: string,
    access: Record<string, boolean>,
  ) {
    await this.getActive(tenantId, id);
    return this.roleAccess.updatePositionAccess(tenantId, id, editorId, access);
  }

  private async getActive(tenantId: string, id: string) {
    const position = await this.prisma.sictedJobProfile.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!position) {
      throw new NotFoundException("Puesto no encontrado");
    }
    return position;
  }

  /** Nombre sin espacios sobrantes y sin repetir otro puesto activo. */
  private async assertUniqueTitle(
    tenantId: string,
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const clean = (title ?? "").trim().replace(/\s+/g, " ");
    if (!clean) {
      throw new BadRequestException("Pon un nombre al puesto");
    }
    const clash = await this.prisma.sictedJobProfile.findFirst({
      where: {
        tenantId,
        archivedAt: null,
        title: { equals: clean, mode: "insensitive" },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException(`Ya existe el puesto «${clean}»`);
    }
    return clean;
  }
}
