import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AbsenceStatus, Shift, ShiftStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CopyWeekDto,
  CreateShiftDto,
  SaveShiftTemplateDto,
  UpdateShiftDto,
} from "../dto/shift.dto";
import { formatDate, parseDate } from "./absence-days.util";
import { HolidaysService } from "./holidays.service";
import {
  addDays,
  isMonday,
  shiftWorkMinutes,
  shiftsOverlap,
} from "./shift-time.util";

export interface Actor {
  id: string;
  name: string;
}

interface ShiftDraft {
  employeeId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
}

/**
 * Planificación de turnos. Los turnos nacen en borrador (solo los ve
 * gerencia) y la persona asignada los ve al publicar la semana. Los cambios
 * sobre un turno ya publicado se ven al momento.
 */
@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidays: HolidaysService,
  ) {}

  /** Todo lo que pinta la rejilla de una semana en un centro. */
  async getWeek(tenantId: string, locationId: string, weekStart: string) {
    const monday = this.parseMonday(weekStart);
    const sunday = addDays(monday, 6);
    const location = await this.findLocation(tenantId, locationId);

    const [employees, shifts, absences, holidays, templates, publication] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: {
            tenantId,
            isActive: true,
            locations: { some: { locationId } },
          },
          orderBy: [{ section: "asc" }, { firstName: "asc" }],
        }),
        this.prisma.shift.findMany({
          where: { tenantId, locationId, date: { gte: monday, lte: sunday } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        this.prisma.absence.findMany({
          where: {
            tenantId,
            status: { in: [AbsenceStatus.APPROVED, AbsenceStatus.PENDING] },
            startDate: { lte: sunday },
            endDate: { gte: monday },
          },
          include: { type: { select: { name: true, color: true } } },
        }),
        this.holidays.list(tenantId, monday, sunday),
        this.listTemplates(tenantId),
        this.prisma.schedulePublication.findFirst({
          where: { tenantId, locationId, weekStart: monday },
          orderBy: { publishedAt: "desc" },
        }),
      ]);

    return {
      weekStart: formatDate(monday),
      days: Array.from({ length: 7 }, (_, i) => formatDate(addDays(monday, i))),
      location: { id: location.id, name: location.name },
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        section: e.section,
        weeklyHours: e.weeklyHours,
      })),
      shifts: shifts.map(toShiftView),
      absences: absences.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        startDate: formatDate(a.startDate),
        endDate: formatDate(a.endDate),
        status: a.status,
        typeName: a.type.name,
        color: a.type.color,
      })),
      holidays: holidays.filter(
        (h) => h.locationId === null || h.locationId === locationId,
      ),
      templates,
      draftCount: shifts.filter((s) => s.status === ShiftStatus.DRAFT).length,
      lastPublication: publication && {
        publishedAt: publication.publishedAt,
        publishedByName: publication.publishedByName,
      },
    };
  }

  async create(tenantId: string, dto: CreateShiftDto) {
    await this.findLocation(tenantId, dto.locationId);
    const draft: ShiftDraft = {
      employeeId: dto.employeeId ?? null,
      date: parseDate(dto.date),
      startTime: dto.startTime,
      endTime: dto.endTime,
    };
    await this.assertPlaceable(tenantId, dto.locationId, draft);
    const shift = await this.prisma.shift.create({
      data: {
        tenantId,
        locationId: dto.locationId,
        ...draft,
        breakMinutes: dto.breakMinutes ?? 0,
        color: dto.color ?? null,
        note: dto.note?.trim() || null,
      },
    });
    return toShiftView(shift);
  }

  /** Editar o mover (otro día, otra persona, o dejarlo abierto). */
  async update(tenantId: string, id: string, dto: UpdateShiftDto) {
    const current = await this.findOwned(tenantId, id);
    const draft: ShiftDraft = {
      employeeId:
        dto.employeeId === undefined ? current.employeeId : dto.employeeId,
      date: dto.date ? parseDate(dto.date) : current.date,
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
    };
    await this.assertPlaceable(tenantId, current.locationId, draft, id);
    const shift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...draft,
        breakMinutes: dto.breakMinutes,
        color: dto.color,
        note: dto.note === undefined ? undefined : dto.note.trim() || null,
      },
    });
    return toShiftView(shift);
  }

  async remove(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.prisma.shift.deleteMany({ where: { id, tenantId } });
  }

  /**
   * Copia los turnos de una semana a otra, como borradores. Se salta los que
   * no encajan en la semana de destino (la persona tiene una ausencia, está
   * de baja o ya tiene un turno que se pisa) y dice cuántos.
   */
  async copyWeek(tenantId: string, dto: CopyWeekDto) {
    const from = this.parseMonday(dto.fromWeekStart);
    const to = this.parseMonday(dto.toWeekStart);
    if (from.getTime() === to.getTime()) {
      throw new BadRequestException("Elige una semana de destino distinta.");
    }
    await this.findLocation(tenantId, dto.locationId);
    const source = await this.prisma.shift.findMany({
      where: {
        tenantId,
        locationId: dto.locationId,
        date: { gte: from, lte: addDays(from, 6) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const offset = to.getTime() - from.getTime();
    let copied = 0;
    let skipped = 0;
    for (const shift of source) {
      const draft: ShiftDraft = {
        employeeId: shift.employeeId,
        date: new Date(shift.date.getTime() + offset),
        startTime: shift.startTime,
        endTime: shift.endTime,
      };
      try {
        await this.assertPlaceable(tenantId, dto.locationId, draft);
        // Un turno abierto no se pisa con nadie: sin esta comprobación,
        // copiar dos veces la misma semana lo duplicaría.
        if (!draft.employeeId) {
          const twin = await this.prisma.shift.findFirst({
            where: {
              tenantId,
              locationId: dto.locationId,
              employeeId: null,
              date: draft.date,
              startTime: draft.startTime,
              endTime: draft.endTime,
            },
            select: { id: true },
          });
          if (twin) {
            throw new ConflictException("Turno abierto ya copiado");
          }
        }
      } catch {
        skipped += 1;
        continue;
      }
      await this.prisma.shift.create({
        data: {
          tenantId,
          locationId: dto.locationId,
          ...draft,
          breakMinutes: shift.breakMinutes,
          color: shift.color,
          note: shift.note,
        },
      });
      copied += 1;
    }
    return { copied, skipped };
  }

  /** Publica los borradores de la semana: pasan a verlos sus asignados. */
  async publishWeek(
    tenantId: string,
    locationId: string,
    weekStart: string,
    by: Actor,
  ) {
    const monday = this.parseMonday(weekStart);
    await this.findLocation(tenantId, locationId);
    const result = await this.prisma.shift.updateMany({
      where: {
        tenantId,
        locationId,
        status: ShiftStatus.DRAFT,
        date: { gte: monday, lte: addDays(monday, 6) },
      },
      data: { status: ShiftStatus.PUBLISHED },
    });
    if (result.count > 0) {
      await this.prisma.schedulePublication.create({
        data: {
          tenantId,
          locationId,
          weekStart: monday,
          publishedShifts: result.count,
          publishedByUserId: by.id,
          publishedByName: by.name,
        },
      });
    }
    return { published: result.count };
  }

  /** Turnos publicados de una persona entre dos fechas. */
  async listOwn(
    tenantId: string,
    employeeId: string,
    from: string,
    to: string,
  ) {
    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        employeeId,
        status: ShiftStatus.PUBLISHED,
        date: { gte: parseDate(from), lte: parseDate(to) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const locations = await this.prisma.location.findMany({
      where: { tenantId, id: { in: shifts.map((s) => s.locationId) } },
      select: { id: true, name: true },
    });
    const names = new Map(locations.map((l) => [l.id, l.name]));
    return shifts.map((shift) => ({
      ...toShiftView(shift),
      locationName: names.get(shift.locationId) ?? null,
    }));
  }

  // ─────────────────────────────────────────────────────────── Plantillas

  listTemplates(tenantId: string, includeInactive = false) {
    return this.prisma.shiftTemplate.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
    });
  }

  createTemplate(tenantId: string, dto: SaveShiftTemplateDto) {
    return this.prisma.shiftTemplate.create({
      data: { tenantId, ...dto, name: dto.name.trim() },
    });
  }

  async updateTemplate(
    tenantId: string,
    id: string,
    dto: SaveShiftTemplateDto,
  ) {
    const template = await this.prisma.shiftTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException("Plantilla no encontrada");
    }
    return this.prisma.shiftTemplate.update({
      where: { id },
      data: { ...dto, name: dto.name.trim() },
    });
  }

  // ──────────────────────────────────────────────────────────── Internos

  /**
   * ¿Se puede colocar el turno? La persona debe estar en activo y asignada
   * al centro, sin ausencia ese día y sin otro turno que se pise. Un turno
   * abierto (sin persona) no tiene restricciones.
   */
  private async assertPlaceable(
    tenantId: string,
    locationId: string,
    draft: ShiftDraft,
    ignoreShiftId?: string,
  ) {
    if (Number.isNaN(draft.date.getTime())) {
      throw new BadRequestException("Fecha no válida.");
    }
    if (!draft.employeeId) {
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: draft.employeeId, tenantId },
      include: { locations: { select: { locationId: true } } },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    if (!employee.isActive) {
      throw new BadRequestException("Este empleado está dado de baja.");
    }
    if (!employee.locations.some((l) => l.locationId === locationId)) {
      throw new BadRequestException(
        "Este empleado no está asignado a este centro.",
      );
    }

    const absence = await this.prisma.absence.findFirst({
      where: {
        tenantId,
        employeeId: draft.employeeId,
        status: AbsenceStatus.APPROVED,
        startDate: { lte: draft.date },
        endDate: { gte: draft.date },
      },
      include: { type: { select: { name: true } } },
    });
    if (absence) {
      throw new ConflictException(
        `${employee.firstName} tiene ${absence.type.name.toLowerCase()} ese día.`,
      );
    }

    const sameDay = await this.prisma.shift.findMany({
      where: {
        tenantId,
        employeeId: draft.employeeId,
        date: draft.date,
        id: ignoreShiftId ? { not: ignoreShiftId } : undefined,
      },
    });
    const clash = sameDay.find((other) => shiftsOverlap(draft, other));
    if (clash) {
      throw new ConflictException(
        `${employee.firstName} ya tiene un turno de ${clash.startTime} a ${clash.endTime} ese día.`,
      );
    }
  }

  private parseMonday(value: string): Date {
    const date = parseDate(value);
    if (!isMonday(date)) {
      throw new BadRequestException("La semana debe empezar en lunes.");
    }
    return date;
  }

  private async findLocation(tenantId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true, name: true },
    });
    if (!location) {
      throw new NotFoundException("Centro no encontrado");
    }
    return location;
  }

  private async findOwned(tenantId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, tenantId },
    });
    if (!shift) {
      throw new NotFoundException("Turno no encontrado");
    }
    return shift;
  }
}

function toShiftView(shift: Shift) {
  return {
    id: shift.id,
    locationId: shift.locationId,
    employeeId: shift.employeeId,
    date: formatDate(shift.date),
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    workMinutes: shiftWorkMinutes(shift),
    color: shift.color,
    note: shift.note,
    status: shift.status,
  };
}
