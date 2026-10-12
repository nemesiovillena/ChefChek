import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../../common/services/prisma.service";
import { CheckInSettingsService } from "./check-in-settings.service";

export const PIN_MAX_FAILED_ATTEMPTS = 3;
export const PIN_LOCK_MINUTES = 15;
const PIN_BCRYPT_ROUNDS = 10;

/** Longitud máxima de la clave que acepta el kiosco (PIN o contraseña). */
export const KIOSK_CREDENTIAL_MAX_LENGTH = 64;

/**
 * Clave con la que una persona se identifica en un dispositivo compartido
 * (hoy, el kiosco de fichaje): quien tiene cuenta en Equipo usa la contraseña
 * de esa cuenta; quien no la tiene, el PIN numérico de su ficha. La sesión
 * personal identifica por sí misma y no usa ninguna de las dos. La clave
 * nunca se devuelve ni se registra en claro.
 */
@Injectable()
export class EmployeePinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CheckInSettingsService,
  ) {}

  async setPin(tenantId: string, employeeId: string, pin: string) {
    const employee = await this.findOwned(tenantId, employeeId);
    if (employee.userId) {
      throw new BadRequestException(
        "Esta persona ficha con la contraseña de su cuenta de Equipo; no necesita PIN.",
      );
    }
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
   * Comprueba la clave de la persona: la contraseña de su cuenta de Equipo si
   * la tiene, o el PIN de la ficha si no. Devuelve true/false; lanza si no
   * tiene clave o está bloqueada. Tras PIN_MAX_FAILED_ATTEMPTS fallos seguidos
   * bloquea PIN_LOCK_MINUTES minutos en el dispositivo compartido; el acceso
   * a la aplicación con esa cuenta no se ve afectado.
   */
  async verifyCredential(
    tenantId: string,
    employeeId: string,
    secret: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Bloquea la ficha mientras se comprueba: sin esto, varias peticiones
      // simultáneas leerían el mismo contador y probarían más PIN de los
      // permitidos antes de que saltase el bloqueo.
      await tx.$queryRaw`SELECT id FROM "employees" WHERE id = ${employeeId} FOR UPDATE`;
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, tenantId },
        include: {
          user: { select: { passwordHash: true, deletedAt: true } },
        },
      });
      if (!employee) {
        throw new NotFoundException("Empleado no encontrado");
      }
      const account =
        employee.user && !employee.user.deletedAt ? employee.user : null;
      const hash = account ? account.passwordHash : employee.pinHash;
      if (!hash) {
        throw new BadRequestException(
          "Este empleado no tiene PIN. Pídaselo a un administrador.",
        );
      }
      if (employee.pinLockedUntil && employee.pinLockedUntil > now) {
        throw new ForbiddenException(
          "Clave bloqueada por demasiados intentos. Inténtelo más tarde.",
        );
      }

      const matches = await bcrypt.compare(secret, hash);
      if (matches) {
        if (employee.pinFailedAttempts > 0 || employee.pinLockedUntil) {
          await tx.employee.update({
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
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          pinFailedAttempts: locked ? 0 : attempts,
          pinLockedUntil: locked
            ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000)
            : null,
        },
      });
      return false;
    });
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
