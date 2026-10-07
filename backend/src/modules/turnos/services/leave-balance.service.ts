import { Injectable, NotFoundException } from "@nestjs/common";
import { AbsenceStatus, Employee } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CheckInSettingsService } from "../../check-in/services/check-in-settings.service";
import { SaveLeaveBalanceDto } from "../dto/absence.dto";
import { countAbsenceDays, defaultEntitlement } from "./absence-days.util";
import { HolidaysService } from "./holidays.service";

export interface BalanceView {
  employeeId: string;
  employeeName: string;
  year: number;
  /** Días que corresponden ese año. */
  entitledDays: number;
  carriedOverDays: number;
  adjustmentDays: number;
  /** true si los días son los del convenio (nadie ha fijado otros a mano). */
  isDefault: boolean;
  note: string | null;
  /** Disfrutados o aprobados. */
  usedDays: number;
  /** Solicitados y aún sin respuesta. */
  pendingDays: number;
  /** Lo que queda descontando lo aprobado. */
  remainingDays: number;
}

const fullName = (e: Pick<Employee, "firstName" | "lastName">) =>
  `${e.firstName} ${e.lastName}`.trim();

/**
 * Saldo anual de vacaciones. Lo disfrutado no se guarda: se calcula siempre a
 * partir de las ausencias aprobadas cuyo tipo descuenta vacaciones, contando
 * solo los días que caen en el año (una ausencia puede cruzar de año).
 */
@Injectable()
export class LeaveBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CheckInSettingsService,
    private readonly holidays: HolidaysService,
  ) {}

  async forEmployee(
    tenantId: string,
    employeeId: string,
    year: number,
  ): Promise<BalanceView> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return this.compute(tenantId, employee, year);
  }

  async forAll(tenantId: string, year: number): Promise<BalanceView[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const balances: BalanceView[] = [];
    for (const employee of employees) {
      balances.push(await this.compute(tenantId, employee, year));
    }
    return balances;
  }

  /** Fija a mano los días de una persona en un año (sustituye al valor del convenio). */
  async save(
    tenantId: string,
    employeeId: string,
    year: number,
    dto: SaveLeaveBalanceDto,
  ): Promise<BalanceView> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    const data = {
      entitledDays: dto.entitledDays,
      carriedOverDays: dto.carriedOverDays ?? 0,
      adjustmentDays: dto.adjustmentDays ?? 0,
      note: dto.note?.trim() || null,
    };
    await this.prisma.leaveBalance.upsert({
      where: { employeeId_year: { employeeId, year } },
      update: data,
      create: { tenantId, employeeId, year, ...data },
    });
    return this.compute(tenantId, employee, year);
  }

  private async compute(
    tenantId: string,
    employee: Employee,
    year: number,
  ): Promise<BalanceView> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const [settings, stored, absences, holidays] = await Promise.all([
      this.settings.get(tenantId),
      this.prisma.leaveBalance.findUnique({
        where: { employeeId_year: { employeeId: employee.id, year } },
      }),
      this.prisma.absence.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          status: { in: [AbsenceStatus.APPROVED, AbsenceStatus.PENDING] },
          type: { deductsVacation: true },
          startDate: { lte: yearEnd },
          endDate: { gte: yearStart },
        },
      }),
      this.holidays.datesFor(
        tenantId,
        employee.defaultLocationId,
        yearStart,
        yearEnd,
      ),
    ]);

    const daysOf = (status: AbsenceStatus) =>
      absences
        .filter((absence) => absence.status === status)
        .reduce(
          (sum, absence) =>
            sum +
            countAbsenceDays(absence.startDate, absence.endDate, {
              dayType: settings.vacationDayType,
              holidays,
              halfDay: absence.halfDay,
              year,
            }),
          0,
        );
    const usedDays = daysOf(AbsenceStatus.APPROVED);
    const entitledDays =
      stored?.entitledDays ??
      defaultEntitlement(settings.vacationDays, year, employee.hireDate);
    const carriedOverDays = stored?.carriedOverDays ?? 0;
    const adjustmentDays = stored?.adjustmentDays ?? 0;

    return {
      employeeId: employee.id,
      employeeName: fullName(employee),
      year,
      entitledDays,
      carriedOverDays,
      adjustmentDays,
      isDefault: !stored,
      note: stored?.note ?? null,
      usedDays,
      pendingDays: daysOf(AbsenceStatus.PENDING),
      remainingDays: entitledDays + carriedOverDays + adjustmentDays - usedDays,
    };
  }
}
