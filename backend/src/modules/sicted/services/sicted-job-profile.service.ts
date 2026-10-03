import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  AssignJobProfileDto,
  CreateJobProfileDto,
  UpdateJobProfileDto,
} from "../dto/sicted-job-profile.dto";

const MANAGER_ROLES: string[] = ["ADMIN", "OWNER", "SUPERADMIN"];

/** Quita vacíos y duplicados; `undefined` se respeta (en una edición = no tocar). */
function cleanAreas(areas: string[] | undefined): string[] | undefined {
  if (!areas) {
    return undefined;
  }
  return [...new Set(areas.map((a) => a.trim()).filter(Boolean))];
}

/**
 * Fichas de puesto (Personas) — datos organizativos, se editan (no
 * append-only, a diferencia del resto de fase 7). `version` se incrementa en
 * cada edición como referencia histórica, pero no dispara ningún acuse (a
 * diferencia de `SictedProtocol`).
 */
@Injectable()
export class SictedJobProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeArchived = false) {
    return this.prisma.sictedJobProfile.findMany({
      where: {
        tenantId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      include: {
        assignments: {
          where: { until: null },
          select: { id: true, userId: true, userName: true, since: true },
        },
      },
      orderBy: { title: "asc" },
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const profile = await this.prisma.sictedJobProfile.findFirst({
      where: { id, tenantId },
      include: {
        assignments: { orderBy: { since: "desc" } },
      },
    });
    if (!profile) {
      throw new NotFoundException("Ficha de puesto no encontrada");
    }
    return profile;
  }

  async create(tenantId: string, dto: CreateJobProfileDto) {
    return this.prisma.sictedJobProfile.create({
      data: {
        tenantId,
        title: dto.title,
        mission: dto.mission,
        responsibilities: dto.responsibilities ?? [],
        tasks: dto.tasks ?? [],
        requirements: dto.requirements,
        reportsTo: dto.reportsTo,
        areas: cleanAreas(dto.areas) ?? [],
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateJobProfileDto) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedJobProfile.update({
      where: { id },
      data: {
        title: dto.title,
        mission: dto.mission,
        responsibilities: dto.responsibilities,
        tasks: dto.tasks,
        requirements: dto.requirements,
        reportsTo: dto.reportsTo,
        areas: cleanAreas(dto.areas),
        version: { increment: 1 },
      },
    });
  }

  async archive(tenantId: string, id: string) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedJobProfile.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Asigna una persona al puesto: cierra cualquier asignación vigente de
   * ESA persona (en cualquier puesto — una persona tiene un puesto activo a
   * la vez) y abre una nueva. Nunca se borra historial.
   */
  async assign(tenantId: string, profileId: string, dto: AssignJobProfileDto) {
    const profile = await this.getOneVisible(tenantId, profileId);
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado en este tenant");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.sictedJobAssignment.updateMany({
        where: { tenantId, userId: dto.userId, until: null },
        data: { until: new Date() },
      });
      return tx.sictedJobAssignment.create({
        data: {
          tenantId,
          profileId: profile.id,
          userId: user.id,
          userName: user.name,
        },
      });
    });
  }

  /**
   * Áreas del Plan que le tocan a este usuario según su puesto vigente, para
   * que en "Hojas" vea primero solo las suyas. Una cuenta compartida (p. ej.
   * el dispositivo de cocina) también filtra por su puesto. Vacío = sin
   * filtro: encargados (ADMIN/OWNER/SUPERADMIN) y quien no tiene puesto o
   * tiene un puesto sin áreas.
   */
  async areasForUser(tenantId: string, userId: string): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user || MANAGER_ROLES.includes(user.role)) {
      return [];
    }
    const assignment = await this.prisma.sictedJobAssignment.findFirst({
      where: {
        tenantId,
        userId,
        until: null,
        profile: { archivedAt: null },
      },
      select: { profile: { select: { areas: true } } },
    });
    return assignment?.profile.areas ?? [];
  }

  /** "Cada empleado con puesto asignado" (criterio de éxito) — usuarios activos del tenant sin asignación vigente. */
  async listUnassignedActiveUsers(tenantId: string) {
    const [users, assigned] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true },
      }),
      this.prisma.sictedJobAssignment.findMany({
        where: { tenantId, until: null },
        select: { userId: true },
      }),
    ]);
    const assignedIds = new Set(assigned.map((a) => a.userId));
    return users.filter((u) => !assignedIds.has(u.id));
  }
}
