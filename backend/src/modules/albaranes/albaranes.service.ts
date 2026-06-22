import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { AlbaranStatusService } from "./services/albaran-status.service";
import { AlbaranNumberService } from "./services/albaran-number.service";
import { CreateAlbaranDto } from "./dto/create-albaran.dto";
import { UpdateAlbaranDto, UpdateAlbaranLineDto } from "./dto/update-albaran.dto";
import { AlbaranQueryDto } from "./dto/albaran-query.dto";
import { AlbaranStatus } from "@prisma/client";

@Injectable()
export class AlbaranesService {
  private readonly logger = new Logger(AlbaranesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: AlbaranStatusService,
    private readonly numberService: AlbaranNumberService,
  ) {}

  /** Create albaran with lines from manual entry */
  async create(dto: CreateAlbaranDto, tenantId: string) {
    const internalNumber = await this.numberService.generateInternalNumber(tenantId);

    return this.prisma.albaran.create({
      data: {
        tenantId,
        internalNumber,
        supplierId: dto.supplierId,
        albaranNumber: dto.albaranNumber,
        date: dto.date ? new Date(dto.date) : new Date(),
        base: dto.base ?? 0,
        vatTotal: dto.vatTotal ?? 0,
        total: dto.total ?? 0,
        warehouseId: dto.warehouseId,
        notes: dto.notes,
        lines: {
          create: dto.lines.map((line) => ({
            articleNumber: line.articleNumber,
            lot: line.lot,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit ?? "ud",
            unitPrice: line.unitPrice,
            vatPercent: line.vatPercent ?? 10,
            lineAmount: line.lineAmount ?? line.quantity * line.unitPrice,
          })),
        },
      },
      include: { lines: true, supplier: true },
    });
  }

  /** List albaranes with filters and pagination */
  async findAll(query: AlbaranQueryDto, tenantId: string) {
    const where: any = { tenantId };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { albaranNumber: { contains: query.search, mode: "insensitive" } },
        { internalNumber: { contains: query.search, mode: "insensitive" } },
        { notes: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.albaran.findMany({
        where,
        include: { supplier: true, _count: { select: { lines: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.albaran.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Get single albaran with lines and matched products */
  async findOne(id: string, tenantId: string) {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        warehouse: true,
        lines: { include: { matchedProduct: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!albaran) throw new NotFoundException("Albarán no encontrado");
    return albaran;
  }

  /** Update albaran header (only in PENDIENTE/REVISADO) */
  async update(id: string, dto: UpdateAlbaranDto, tenantId: string) {
    const albaran = await this.findOne(id, tenantId);

    if (albaran.status === AlbaranStatus.CONFIRMADO || albaran.status === AlbaranStatus.ARCHIVADO) {
      throw new BadRequestException("No se puede editar un albarán confirmado o archivado");
    }

    return this.prisma.albaran.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        albaranNumber: dto.albaranNumber,
        notes: dto.notes,
        warehouseId: dto.warehouseId,
      },
      include: { lines: true, supplier: true },
    });
  }

  /** Update a single line */
  async updateLine(albaranId: string, lineId: string, dto: UpdateAlbaranLineDto, tenantId: string) {
    await this.findOne(albaranId, tenantId);

    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaranId },
    });
    if (!line) throw new NotFoundException("Línea no encontrada");

    const updateData: any = {};
    if (dto.articleNumber !== undefined) updateData.articleNumber = dto.articleNumber;
    if (dto.lot !== undefined) updateData.lot = dto.lot;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.quantity !== undefined) updateData.quantity = parseFloat(dto.quantity);
    if (dto.unit !== undefined) updateData.unit = dto.unit;
    if (dto.unitPrice !== undefined) {
      const price = parseFloat(dto.unitPrice);
      updateData.unitPrice = price;
      updateData.lineAmount = (updateData.quantity ?? line.quantity) * price;
    }
    if (dto.matchedProductId !== undefined) {
      updateData.matchedProductId = dto.matchedProductId;
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: updateData,
    });
  }

  /** Assign a product match to a line (user override) */
  async matchLine(albaranId: string, lineId: string, productId: string, tenantId: string) {
    await this.findOne(albaranId, tenantId);

    // Verify product exists and belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException("Producto no encontrado");

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: {
        matchedProductId: productId,
        matchStatus: "MATCH_ALTO",
        confidence: 1.0,
      },
    });
  }

  /** Confirm or reject a line */
  async setLineStatus(albaranId: string, lineId: string, status: "CONFIRMADO" | "RECHAZADO", tenantId: string) {
    await this.findOne(albaranId, tenantId);

    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaranId },
    });
    if (!line) throw new NotFoundException("Línea no encontrada");

    if (status === "CONFIRMADO" && !line.matchedProductId) {
      throw new BadRequestException("No se puede confirmar una línea sin producto asignado");
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: { lineStatus: status },
    });
  }

  /** Transition albaran status */
  async updateStatus(id: string, newStatus: AlbaranStatus, tenantId: string) {
    await this.statusService.transitionStatus(id, tenantId, newStatus);
    return this.findOne(id, tenantId);
  }

  /** Delete albaran (only PENDIENTE or REVISADO) */
  async remove(id: string, tenantId: string) {
    const albaran = await this.findOne(id, tenantId);

    if (albaran.status === AlbaranStatus.CONFIRMADO || albaran.status === AlbaranStatus.ARCHIVADO) {
      throw new BadRequestException("No se puede eliminar un albarán confirmado o archivado");
    }

    return this.prisma.albaran.delete({ where: { id } });
  }
}
