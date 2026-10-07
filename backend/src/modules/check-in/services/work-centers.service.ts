import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { UpdateWorkCenterGeofenceDto } from "../dto/work-center.dto";

/**
 * Geovalla de los centros de trabajo. El alta y edición del centro en sí
 * (nombre, dirección, por defecto) las hace LocationsService, compartido con
 * Compras; aquí solo se gestionan los campos propios del fichaje.
 */
@Injectable()
export class WorkCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateGeofence(
    tenantId: string,
    id: string,
    dto: UpdateWorkCenterGeofenceDto,
  ) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) {
      throw new NotFoundException("Centro no encontrado");
    }

    const latitude =
      dto.latitude === undefined ? location.latitude : dto.latitude;
    const longitude =
      dto.longitude === undefined ? location.longitude : dto.longitude;
    if ((latitude === null) !== (longitude === null)) {
      throw new BadRequestException(
        "Latitud y longitud deben indicarse juntas.",
      );
    }
    if (dto.timezone !== undefined && !isValidTimezone(dto.timezone)) {
      throw new BadRequestException("Zona horaria no válida.");
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        latitude,
        longitude,
        geofenceRadiusM: dto.geofenceRadiusM,
        geofenceMode: dto.geofenceMode,
        timezone: dto.timezone,
      },
    });
  }
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
