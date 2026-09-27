import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateLostItemDto,
  ReturnLostItemDto,
} from "../dto/sicted-lost-item.dto";

/** Objetos perdidos (Ins-Bas.17) — "devuelto" se deriva de `returnedAt IS NOT NULL`, sin enum `status`. */
@Injectable()
export class SictedLostItemService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, onlyPending = false) {
    return this.prisma.sictedLostItem.findMany({
      where: { tenantId, ...(onlyPending ? { returnedAt: null } : {}) },
      orderBy: { foundAt: "desc" },
      take: 200,
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const item = await this.prisma.sictedLostItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) {
      throw new NotFoundException("Objeto no encontrado");
    }
    return item;
  }

  async create(tenantId: string, dto: CreateLostItemDto) {
    return this.prisma.sictedLostItem.create({
      data: {
        tenantId,
        itemName: dto.itemName,
        description: dto.description,
        foundLocation: dto.foundLocation,
        foundByName: dto.foundByName,
      },
    });
  }

  async markReturned(tenantId: string, id: string, dto: ReturnLostItemDto) {
    const current = await this.getOneVisible(tenantId, id);
    if (current.returnedAt) {
      throw new BadRequestException("Ya estaba marcado como devuelto");
    }
    return this.prisma.sictedLostItem.update({
      where: { id },
      data: { returnedAt: new Date(), returnedTo: dto.returnedTo },
    });
  }
}
