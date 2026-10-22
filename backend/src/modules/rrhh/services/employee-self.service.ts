import { ForbiddenException, Injectable } from "@nestjs/common";
import { Employee } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { currentPositionTitles } from "../../users/current-position-titles";

/** Campos de la cuenta y de la ficha que el empleado puede proponer cambiar. */
export const USER_DATA_FIELDS = [
  "phone",
  "whatsapp",
  "street",
  "city",
  "payrollEmail",
] as const;
export const EMPLOYEE_DATA_FIELDS = [
  "nationalId",
  "socialSecurityNumber",
] as const;
export const PERSONAL_DATA_FIELDS = [
  ...USER_DATA_FIELDS,
  ...EMPLOYEE_DATA_FIELDS,
] as const;
export type PersonalDataField = (typeof PERSONAL_DATA_FIELDS)[number];

export const PERSONAL_DATA_LABELS: Record<PersonalDataField, string> = {
  phone: "Teléfono",
  whatsapp: "WhatsApp",
  street: "Dirección",
  city: "Población",
  payrollEmail: "Email para nóminas",
  nationalId: "DNI/NIE",
  socialSecurityNumber: "Nº de la Seguridad Social",
};

/**
 * Lo que cada persona ve de sí misma. El empleado se resuelve siempre desde
 * la sesión: ninguna ruta de "Mi espacio" acepta un id de empleado.
 */
@Injectable()
export class EmployeeSelfService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ficha vinculada a la cuenta de la sesión. Una cuenta compartida no es nadie. */
  async resolve(
    tenantId: string,
    user: { id: string; isSharedAccount?: boolean },
  ): Promise<Employee> {
    const employee = user.isSharedAccount
      ? null
      : await this.prisma.employee.findFirst({
          where: { tenantId, userId: user.id },
        });
    if (!employee) {
      throw new ForbiddenException(
        "Tu cuenta no está vinculada a una ficha de empleado.",
      );
    }
    return employee;
  }

  /** Mis datos: lo personal y lo laboral que me afecta. Nunca el coste hora. */
  async getProfile(tenantId: string, employee: Employee) {
    const [user, locations, titles] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: employee.userId as string, tenantId },
      }),
      this.prisma.employeeLocation.findMany({
        where: { tenantId, employeeId: employee.id },
        include: { location: { select: { name: true } } },
      }),
      currentPositionTitles(this.prisma, tenantId, [employee.userId]),
    ]);
    const positionTitle =
      (employee.userId && titles.get(employee.userId)) || null;
    return {
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      email: user?.email ?? null,
      personal: {
        phone: user?.phone ?? null,
        whatsapp: user?.whatsapp ?? null,
        street: user?.street ?? null,
        city: user?.city ?? null,
        payrollEmail: user?.payrollEmail ?? null,
        nationalId: employee.nationalId,
        socialSecurityNumber: employee.socialSecurityNumber,
      },
      job: {
        jobTitle: positionTitle,
        section: employee.section,
        contractType: employee.contractType,
        weeklyHours: employee.weeklyHours,
        hireDate: employee.hireDate,
        centers: locations.map((l) => l.location.name),
      },
    };
  }
}
