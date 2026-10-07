import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Absence, AbsenceStatus, AbsenceType, Employee } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CheckInSettingsService } from "../../check-in/services/check-in-settings.service";
import { CreateAbsenceDto } from "../dto/absence.dto";
import { countAbsenceDays, formatDate, parseDate } from "./absence-days.util";
import { AbsenceTypesService } from "./absence-types.service";
import { HolidaysService } from "./holidays.service";
import { LeaveBalanceService } from "./leave-balance.service";

export interface Actor {
  id: string;
  name: string;
}

type AbsenceRow = Absence & {
  type: AbsenceType;
  employee: Pick<Employee, "firstName" | "lastName" | "defaultLocationId">;
};

const MAX_DAYS = 366;
const ACTIVE: AbsenceStatus[] = [AbsenceStatus.PENDING, AbsenceStatus.APPROVED];
const INCLUDE = {
  type: true,
  employee: {
    select: { firstName: true, lastName: true, defaultLocationId: true },
  },
} as const;

/**
 * Ausencias: vacaciones, permisos y bajas. El empleado solicita (queda
 * pendiente); gerencia aprueba, rechaza o registra directamente. Solo se
 * guardan fechas y tipo: nunca el motivo médico de una baja.
 */
@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly types: AbsenceTypesService,
    private readonly holidays: HolidaysService,
    private readonly balances: LeaveBalanceService,
    private readonly settings: CheckInSettingsService,
  ) {}

  /** Solicitud del propio empleado. */
  async request(
    tenantId: string,
    employee: Employee,
    dto: CreateAbsenceDto,
    requester: Actor,
  ) {
    const type = await this.types.findOwned(tenantId, dto.absenceTypeId);
    if (!type.isActive || !type.employeeCanRequest) {
      throw new ForbiddenException(
        "Este tipo de ausencia lo registra un responsable.",
      );
    }
    const { start, end, days } = await this.validate(tenantId, employee, dto);
    if (type.deductsVacation) {
      await this.assertEnoughBalance(tenantId, employee.id, start, end, days);
    }
    const absence = await this.prisma.absence.create({
      data: {
        tenantId,
        employeeId: employee.id,
        absenceTypeId: type.id,
        startDate: start,
        endDate: end,
        halfDay: dto.halfDay === true && days === 0.5,
        status: AbsenceStatus.PENDING,
        note: dto.note?.trim() || null,
        requestedByUserId: requester.id,
        requestedByName: requester.name,
      },
      include: INCLUDE,
    });
    return this.toView(tenantId, absence);
  }

  /** Ausencia registrada por gerencia: queda aprobada. */
  async createApproved(
    tenantId: string,
    employee: Employee,
    dto: CreateAbsenceDto,
    manager: Actor,
  ) {
    const type = await this.types.findOwned(tenantId, dto.absenceTypeId);
    const { start, end, days } = await this.validate(tenantId, employee, dto);
    const absence = await this.prisma.absence.create({
      data: {
        tenantId,
        employeeId: employee.id,
        absenceTypeId: type.id,
        startDate: start,
        endDate: end,
        halfDay: dto.halfDay === true && days === 0.5,
        status: AbsenceStatus.APPROVED,
        note: dto.note?.trim() || null,
        requestedByUserId: manager.id,
        requestedByName: manager.name,
        decidedByUserId: manager.id,
        decidedByName: manager.name,
        decidedAt: new Date(),
      },
      include: INCLUDE,
    });
    return this.toView(tenantId, absence);
  }

  async decide(
    tenantId: string,
    id: string,
    approve: boolean,
    note: string | undefined,
    manager: Actor,
  ) {
    if (!approve && !note?.trim()) {
      throw new BadRequestException("Indica por qué se rechaza.");
    }
    // updateMany con el estado en el where: si dos responsables deciden a la
    // vez, solo uno encuentra la solicitud todavía pendiente.
    const result = await this.prisma.absence.updateMany({
      where: { id, tenantId, status: AbsenceStatus.PENDING },
      data: {
        status: approve ? AbsenceStatus.APPROVED : AbsenceStatus.REJECTED,
        decidedByUserId: manager.id,
        decidedByName: manager.name,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
      },
    });
    if (result.count === 0) {
      await this.findOwned(tenantId, id); // 404 si no existe
      throw new ConflictException("Esta solicitud ya está resuelta.");
    }
    return this.toView(tenantId, await this.findOwned(tenantId, id));
  }

  /**
   * Cancelar. El empleado solo puede retirar una solicitud suya aún pendiente;
   * gerencia puede cancelar también una ya aprobada.
   */
  async cancel(
    tenantId: string,
    id: string,
    by: Actor,
    options: { ownEmployeeId?: string; note?: string },
  ) {
    const absence = await this.findOwned(tenantId, id);
    const isOwnRequest = options.ownEmployeeId !== undefined;
    if (isOwnRequest && absence.employeeId !== options.ownEmployeeId) {
      throw new NotFoundException("Ausencia no encontrada");
    }
    const allowed: AbsenceStatus[] = isOwnRequest
      ? [AbsenceStatus.PENDING]
      : ACTIVE;
    const result = await this.prisma.absence.updateMany({
      where: { id, tenantId, status: { in: allowed } },
      data: {
        status: AbsenceStatus.CANCELLED,
        decidedByUserId: by.id,
        decidedByName: by.name,
        decidedAt: new Date(),
        decisionNote: options.note?.trim() || null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException(
        isOwnRequest
          ? "Solo puedes retirar una solicitud pendiente. Pide a un responsable que la cancele."
          : "Esta ausencia ya no está activa.",
      );
    }
    return this.toView(tenantId, await this.findOwned(tenantId, id));
  }

  /** Ausencias que pisan un rango de fechas. */
  async list(
    tenantId: string,
    filter: {
      from: Date;
      to: Date;
      employeeId?: string;
      statuses?: AbsenceStatus[];
    },
  ) {
    const absences = await this.prisma.absence.findMany({
      where: {
        tenantId,
        employeeId: filter.employeeId,
        status: filter.statuses ? { in: filter.statuses } : undefined,
        startDate: { lte: filter.to },
        endDate: { gte: filter.from },
      },
      include: INCLUDE,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    return Promise.all(absences.map((a) => this.toView(tenantId, a)));
  }

  async listPending(tenantId: string) {
    const absences = await this.prisma.absence.findMany({
      where: { tenantId, status: AbsenceStatus.PENDING },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return Promise.all(absences.map((a) => this.toView(tenantId, a)));
  }

  private async findOwned(tenantId: string, id: string): Promise<AbsenceRow> {
    const absence = await this.prisma.absence.findFirst({
      where: { id, tenantId },
      include: INCLUDE,
    });
    if (!absence) {
      throw new NotFoundException("Ausencia no encontrada");
    }
    return absence;
  }

  /** Fechas coherentes, sin solaparse con otra ausencia activa de la persona. */
  private async validate(
    tenantId: string,
    employee: Employee,
    dto: CreateAbsenceDto,
  ) {
    const start = parseDate(dto.startDate);
    const end = parseDate(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Fechas no válidas.");
    }
    if (end < start) {
      throw new BadRequestException(
        "La fecha de fin no puede ser anterior a la de inicio.",
      );
    }
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_DAYS) {
      throw new BadRequestException("Una ausencia no puede superar un año.");
    }
    if (dto.halfDay && dto.startDate !== dto.endDate) {
      throw new BadRequestException(
        "La media jornada solo vale para ausencias de un día.",
      );
    }
    if (!employee.isActive) {
      throw new BadRequestException("Este empleado está dado de baja.");
    }
    const overlapping = await this.prisma.absence.findFirst({
      where: {
        tenantId,
        employeeId: employee.id,
        status: { in: ACTIVE },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { startDate: true, endDate: true },
    });
    if (overlapping) {
      throw new ConflictException(
        `Ya hay una ausencia del ${formatDate(overlapping.startDate)} al ${formatDate(overlapping.endDate)} que coincide con esas fechas.`,
      );
    }
    const days = await this.daysOf(
      tenantId,
      employee.defaultLocationId,
      start,
      end,
      dto.halfDay === true,
    );
    return { start, end, days };
  }

  /** El empleado no puede pedir más vacaciones de las que le quedan. */
  private async assertEnoughBalance(
    tenantId: string,
    employeeId: string,
    start: Date,
    end: Date,
    days: number,
  ) {
    // Se comprueba contra el año en que empieza; una petición a caballo de dos
    // años la revisa el responsable al aprobar.
    const year = start.getUTCFullYear();
    if (end.getUTCFullYear() !== year) {
      return;
    }
    const balance = await this.balances.forEmployee(tenantId, employeeId, year);
    const available = balance.remainingDays - balance.pendingDays;
    if (days > available) {
      throw new BadRequestException(
        `Pides ${days} día(s) y te quedan ${available} disponibles en ${year}.`,
      );
    }
  }

  private async daysOf(
    tenantId: string,
    locationId: string | null,
    start: Date,
    end: Date,
    halfDay: boolean,
  ): Promise<number> {
    const [settings, holidays] = await Promise.all([
      this.settings.get(tenantId),
      this.holidays.datesFor(tenantId, locationId, start, end),
    ]);
    return countAbsenceDays(start, end, {
      dayType: settings.vacationDayType,
      holidays,
      halfDay,
    });
  }

  private async toView(tenantId: string, absence: AbsenceRow) {
    return {
      id: absence.id,
      employeeId: absence.employeeId,
      employeeName:
        `${absence.employee.firstName} ${absence.employee.lastName}`.trim(),
      type: {
        id: absence.type.id,
        name: absence.type.name,
        color: absence.type.color,
        deductsVacation: absence.type.deductsVacation,
      },
      startDate: formatDate(absence.startDate),
      endDate: formatDate(absence.endDate),
      halfDay: absence.halfDay,
      days: await this.daysOf(
        tenantId,
        absence.employee.defaultLocationId,
        absence.startDate,
        absence.endDate,
        absence.halfDay,
      ),
      status: absence.status,
      note: absence.note,
      requestedByName: absence.requestedByName,
      decidedByName: absence.decidedByName,
      decidedAt: absence.decidedAt,
      decisionNote: absence.decisionNote,
      createdAt: absence.createdAt,
    };
  }
}
