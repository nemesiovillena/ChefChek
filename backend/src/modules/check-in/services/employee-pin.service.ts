import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../../common/services/prisma.service";
import { CheckInSettingsService } from "./check-in-settings.service";

export const PIN_MAX_FAILED_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
const PIN_BCRYPT_ROUNDS = 10;

/**
 * PIN de kiosco del empleado. Solo se usa al fichar en un dispositivo
 * compartido; la sesión personal identifica por sí misma. Nunca se devuelve
 * ni se registra en claro.
 */
@Injectable()
export class EmployeePinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CheckInSettingsService,
  ) {}

  async setPin(tenantId: string, employeeId: string, pin: string) {
    await this.findOwned(tenantId, employeeId);
    const { pinLength } = await this.settings.get(tenantId);
    if (!/^\d+$/.test(pin) || pin.length !== pinLength) {
      throw new BadRequestException(
        `El PIN debe tener exactamente ${pinLength} dígitos.`,
      );
    }
    const pinHash = await bcrypt.hash(pin, PIN_BCRYPT_ROUNDS);
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });
  }

  async clearPin(tenantId: string, employeeId: string) {
    await this.findOwned(tenantId, employeeId);
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    });
  }

  /**
   * Comprueba el PIN. Devuelve true/false; lanza si el empleado no tiene PIN
   * o está bloqueado. Tras PIN_MAX_FAILED_ATTEMPTS fallos seguidos bloquea
   * PIN_LOCK_MINUTES minutos.
   */
  async verifyPin(
    tenantId: string,
    employeeId: string,
    pin: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const employee = await this.findOwned(tenantId, employeeId);
    if (!employee.pinHash) {
      throw new BadRequestException(
        "Este empleado no tiene PIN. Pídaselo a un administrador.",
      );
    }
    if (employee.pinLockedUntil && employee.pinLockedUntil > now) {
      throw new ForbiddenException(
        "PIN bloqueado por demasiados intentos. Inténtelo más tarde.",
      );
    }

    const matches = await bcrypt.compare(pin, employee.pinHash);
    if (matches) {
      if (employee.pinFailedAttempts > 0 || employee.pinLockedUntil) {
        await this.prisma.employee.update({
          where: { id: employeeId },
          data: { pinFailedAttempts: 0, pinLockedUntil: null },
        });
      }
      return true;
    }

    // Un bloqueo ya vencido reinicia la cuenta de intentos.
    const previousAttempts = employee.pinLockedUntil
      ? 0
      : employee.pinFailedAttempts;
    const attempts = previousAttempts + 1;
    const locked = attempts >= PIN_MAX_FAILED_ATTEMPTS;
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        pinFailedAttempts: locked ? 0 : attempts,
        pinLockedUntil: locked
          ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000)
          : null,
      },
    });
    return false;
  }

  private async findOwned(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return employee;
  }
}
