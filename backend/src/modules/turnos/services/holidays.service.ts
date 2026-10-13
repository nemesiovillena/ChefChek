import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateHolidayDto } from "../dto/absence.dto";
import { formatDate, parseDate } from "./absence-days.util";

/** Festivos del tenant, generales o de un centro concreto. */
@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, from: Date, to: Date) {
    const holidays = await this.prisma.holiday.findMany({
      where: { tenantId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
    return holidays.map((holiday) => ({
      id: holiday.id,
      date: formatDate(holiday.date),
      name: holiday.name,
      locationId: holiday.locationId,
    }));
  }

  /** Fechas festivas que aplican a un centro (las generales más las suyas). */
  async datesFor(
    tenantId: string,
    locationId: string | null,
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const holidays = await this.list(tenantId, from, to);
    return new Set(
      holidays
        .filter((h) => h.locationId === null || h.locationId === locationId)
        .map((h) => h.date),
    );
  }

  async create(tenantId: string, dto: CreateHolidayDto) {
    const date = parseDate(dto.date);
    const locationId = dto.locationId ?? null;
    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, tenantId },
        select: { id: true },
      });
      if (!location) {
        throw new NotFoundException("Centro no encontrado");
      }
    }
    // unique en BD no sirve con locationId nulo (NULL ≠ NULL): se comprueba aquí.
    const existing = await this.prisma.holiday.findFirst({
      where: { tenantId, date, locationId },
    });
    if (existing) {
      throw new ConflictException("Ese día ya está marcado como festivo.");
    }
    const holiday = await this.prisma.holiday.create({
      data: { tenantId, date, name: dto.name.trim(), locationId },
    });
    return {
      id: holiday.id,
      date: formatDate(holiday.date),
      name: holiday.name,
      locationId: holiday.locationId,
    };
  }

  async remove(tenantId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id, tenantId },
    });
    if (!holiday) {
      throw new NotFoundException("Festivo no encontrado");
    }
    await this.prisma.holiday.deleteMany({ where: { id, tenantId } });
  }
}
