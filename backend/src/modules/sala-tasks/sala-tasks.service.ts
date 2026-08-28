import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateSalaTaskDto,
  UpdateSalaTaskDto,
  ReorderSalaTasksDto,
  SalaTaskStatus,
} from "./dto/sala-task.dto";

@Injectable()
export class SalaTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateSalaTaskDto) {
    // Nueva tarea entra al final de su columna.
    const last = await this.prisma.salaTask.findFirst({
      where: {
        tenantId,
        status: dto.status ?? SalaTaskStatus.PENDIENTE,
        deletedAt: null,
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const data = await this.prisma.salaTask.create({
      data: {
        tenantId,
        title: dto.title,
        eventDate: dto.eventDate,
        guestCount: dto.guestCount,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        menuNotes: dto.menuNotes,
        observations: dto.observations,
        allergies: dto.allergies,
        status: dto.status ?? SalaTaskStatus.PENDIENTE,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdBy: userId,
      },
    });

    return { success: true, data };
  }

  async findAll(tenantId: string) {
    const data = await this.prisma.salaTask.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
    });

    return { success: true, data };
  }

  async findOne(tenantId: string, id: string) {
    const task = await this.prisma.salaTask.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!task) {
      throw new NotFoundException("Notificación de sala no encontrada");
    }

    return { success: true, data: task };
  }

  async update(tenantId: string, id: string, dto: UpdateSalaTaskDto) {
    await this.assertOwned(tenantId, id);

    const data = await this.prisma.salaTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.eventDate !== undefined && { eventDate: dto.eventDate }),
        ...(dto.guestCount !== undefined && { guestCount: dto.guestCount }),
        ...(dto.customerName !== undefined && {
          customerName: dto.customerName,
        }),
        ...(dto.customerPhone !== undefined && {
          customerPhone: dto.customerPhone,
        }),
        ...(dto.customerEmail !== undefined && {
          customerEmail: dto.customerEmail,
        }),
        ...(dto.menuNotes !== undefined && { menuNotes: dto.menuNotes }),
        ...(dto.observations !== undefined && {
          observations: dto.observations,
        }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    return { success: true, data };
  }

  async remove(tenantId: string, id: string) {
    await this.assertOwned(tenantId, id);

    // Soft-delete: nunca borrado físico (mandato de cero pérdida de datos del proyecto).
    await this.prisma.salaTask.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async reorder(tenantId: string, dto: ReorderSalaTasksDto) {
    const ids = dto.items.map((i) => i.id);
    const owned = await this.prisma.salaTask.findMany({
      where: { id: { in: ids }, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException(
        "Alguna notificación de sala no pertenece a este tenant",
      );
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.salaTask.update({
          where: { id: item.id },
          data: { status: item.status, sortOrder: item.sortOrder },
        }),
      ),
    );

    return { success: true };
  }

  private async assertOwned(tenantId: string, id: string) {
    const existing = await this.prisma.salaTask.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("Notificación de sala no encontrada");
    }
  }
}
