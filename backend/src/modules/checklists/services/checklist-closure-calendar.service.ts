import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateCalendarExceptionDto } from "../dto/checklist-closure-calendar.dto";
import { ClosureCalendar } from "../util/checklist-closure-calendar.util";

/**
 * Calendario de cierre del local (descanso semanal + excepciones por fecha).
 * Es un dato del tenant, no de un módulo consumidor: lo comparten todos los
 * que usan el motor de hojas.
 */
@Injectable()
export class ChecklistClosureCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const [tenant, exceptions] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { closedWeekdays: true },
      }),
      this.prisma.tenantCalendarException.findMany({
        where: { tenantId },
        orderBy: { fromDay: "desc" },
      }),
    ]);
    return { closedWeekdays: tenant?.closedWeekdays ?? [], exceptions };
  }

  /** Lo mínimo para decidir si un día cierra (ver `isClosedDay`). */
  async load(tenantId: string): Promise<ClosureCalendar> {
    return this.get(tenantId);
  }

  async setClosedWeekdays(tenantId: string, closedWeekdays: number[]) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { closedWeekdays: [...closedWeekdays].sort() },
    });
    return this.get(tenantId);
  }

  async addException(
    tenantId: string,
    userId: string,
    dto: CreateCalendarExceptionDto,
  ) {
    if (dto.toDay < dto.fromDay) {
      throw new BadRequestException(
        "La fecha «hasta» no puede ser anterior a la fecha «desde»",
      );
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { name: true },
    });
    await this.prisma.tenantCalendarException.create({
      data: {
        tenantId,
        kind: dto.kind,
        fromDay: dto.fromDay,
        toDay: dto.toDay,
        reason: dto.reason?.trim() || null,
        createdByName: user?.name ?? "—",
      },
    });
    return this.get(tenantId);
  }

  async removeException(tenantId: string, id: string) {
    const { count } = await this.prisma.tenantCalendarException.deleteMany({
      where: { id, tenantId },
    });
    if (count === 0) {
      throw new NotFoundException("Excepción no encontrada");
    }
    return this.get(tenantId);
  }
}
