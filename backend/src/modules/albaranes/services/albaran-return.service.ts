import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AlbaranReturnSettlement,
  AlbaranReturnStatus,
  AlbaranStatus,
  CuinerExportStatus,
  LineStatus,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { ModulesService } from "../../modules/modules.service";
import { hasPaperTotal } from "../albaranes.service";
import {
  ApplyAlbaranReturnDto,
  CreateAlbaranReturnDto,
  DiscardAlbaranReturnDto,
} from "../dto/albaran-return.dto";
import { AlbaranStockService } from "./albaran-stock.service";
import { resolveReturnIncident } from "./albaran-return-incident";

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtQuantity = (quantity: number | null, unit: string | null) =>
  quantity === null
    ? ""
    : `${String(quantity).replace(".", ",")}${unit ? ` ${unit}` : ""} de `;

/**
 * Devoluciones al proveedor. Quien recibe la mercancía la anota (al subir la
 * foto o después) y queda constancia en el acto: registro junto al albarán e
 * incidencia de recepción PROV.3 en SICTED. Oficina la aplica a una línea, lo
 * que crea una línea negativa debajo de la original:
 *  - IN_ALBARAN: descontado en este albarán (también si el repartidor lo anotó
 *    a mano en el papel): resta cantidad e importe.
 *  - CREDIT_NOTE: llegará un abono aparte: resta cantidad (stock) a 0 €; el
 *    abono que llegue se enlaza a la devolución para no restar stock dos veces.
 * El stock lo mueve AlbaranStockService al confirmar el albarán (o en el acto
 * si ya estaba confirmado). Mientras haya devoluciones PENDIENTES el albarán
 * no se puede confirmar (AlbaranStatusService).
 */
@Injectable()
export class AlbaranReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesService: ModulesService,
    private readonly stockService: AlbaranStockService,
  ) {}

  async list(albaranId: string, tenantId: string) {
    await this.getAlbaran(albaranId, tenantId);
    return this.prisma.albaranReturn.findMany({
      where: { albaranId, tenantId },
      orderBy: { reportedAt: "asc" },
    });
  }

  async create(
    albaranId: string,
    dto: CreateAlbaranReturnDto,
    tenantId: string,
    userName: string,
  ) {
    const albaran = await this.getAlbaran(albaranId, tenantId);
    if (albaran.status === AlbaranStatus.ARCHIVADO) {
      throw new BadRequestException(
        "No se pueden anotar devoluciones en un albarán archivado",
      );
    }
    if (dto.lineId && !dto.settlement) {
      throw new BadRequestException(
        "Indica cómo liquida el proveedor la devolución",
      );
    }

    const reportedByName = dto.reportedByName?.trim() || userName || "—";
    const created = await this.prisma.albaranReturn.create({
      data: {
        tenantId,
        albaranId,
        description: dto.description.trim(),
        quantity: dto.quantity ?? null,
        unit: dto.unit?.trim() || null,
        reason: dto.reason.trim(),
        reportedByName,
      },
    });
    await this.ensureIncident(created.id, tenantId);

    if (dto.lineId && dto.settlement) {
      return this.apply(
        albaranId,
        created.id,
        {
          lineId: dto.lineId,
          quantity: dto.quantity ?? 0,
          settlement: dto.settlement,
        },
        tenantId,
      );
    }
    return this.getReturn(created.id, tenantId);
  }

  async apply(
    albaranId: string,
    returnId: string,
    dto: ApplyAlbaranReturnDto,
    tenantId: string,
  ) {
    const albaran = await this.getAlbaran(albaranId, tenantId);
    const ret = await this.getReturn(returnId, tenantId);
    if (ret.albaranId !== albaranId) {
      throw new NotFoundException("Devolución no encontrada");
    }
    if (ret.status !== AlbaranReturnStatus.PENDIENTE) {
      throw new BadRequestException(
        "Esta devolución ya está aplicada o descartada",
      );
    }
    if (albaran.status === AlbaranStatus.ARCHIVADO) {
      throw new BadRequestException("El albarán está archivado");
    }
    if (albaran.status === AlbaranStatus.CONFIRMADO) {
      await this.assertNotInCuiner(albaranId);
    }

    const line = albaran.lines.find((l) => l.id === dto.lineId);
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }
    if (line.lineStatus === LineStatus.RECHAZADO) {
      throw new BadRequestException("La línea está rechazada");
    }
    if (Number(line.quantity) <= 0) {
      throw new BadRequestException(
        "Solo se puede devolver de una línea con cantidad positiva",
      );
    }
    if (!line.matchedProductId) {
      throw new BadRequestException(
        "Vincula primero la línea a un artículo para poder aplicar la devolución",
      );
    }

    const alreadyReturned = await this.prisma.albaranReturn.aggregate({
      where: {
        lineId: line.id,
        status: AlbaranReturnStatus.APLICADA,
        tenantId,
      },
      _sum: { quantity: true },
    });
    const remaining =
      Number(line.quantity) - Number(alreadyReturned._sum.quantity ?? 0);
    const quantity = Number(dto.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("Indica la cantidad devuelta");
    }
    if (quantity > remaining + 1e-9) {
      throw new BadRequestException(
        `No se puede devolver más de lo recibido (quedan ${String(round2(remaining)).replace(".", ",")} ${line.unit})`,
      );
    }

    const inAlbaran = dto.settlement === AlbaranReturnSettlement.IN_ALBARAN;
    const unitPrice = inAlbaran ? Number(line.unitPrice) : 0;
    const lineAmount = round2(-quantity * unitPrice);
    // Neto proporcional: si la línea traía descuento del papel, la devolución
    // resta lo que de verdad se pagaba por unidad.
    const originalNet =
      line.totalPrice !== null ? Number(line.totalPrice) : null;
    const totalPrice = !inAlbaran
      ? 0
      : originalNet !== null
        ? round2(-quantity * (originalNet / Number(line.quantity)))
        : lineAmount;

    await this.prisma.$transaction(async (tx) => {
      const returnLine = await tx.albaranLine.create({
        data: {
          albaranId,
          description: `Devolución: ${line.description}`,
          quantity: -quantity,
          unit: line.unit,
          unitPrice,
          vatPercent: line.vatPercent,
          priceWithVat: line.priceWithVat,
          lineAmount,
          totalPrice,
          lineOrder: line.lineOrder,
          lineStatus: LineStatus.CONFIRMADO,
          matchedProductId: line.matchedProductId,
          matchStatus: "MATCH_ALTO",
          confidence: 1.0,
        },
      });

      await tx.albaranReturn.update({
        where: { id: ret.id },
        data: {
          status: AlbaranReturnStatus.APLICADA,
          settlement: dto.settlement,
          lineId: line.id,
          appliedLineId: returnLine.id,
          quantity,
          unit: line.unit,
        },
      });

      // Albarán manual (sin total del papel): sus totales siguen a las líneas.
      if (!hasPaperTotal(albaran) && totalPrice !== 0) {
        const vat = round2(totalPrice * (Number(line.vatPercent) / 100));
        await tx.albaran.update({
          where: { id: albaranId },
          data: {
            grossAmount: { increment: lineAmount },
            base: { increment: totalPrice },
            vatTotal: { increment: vat },
            total: { increment: round2(totalPrice + vat) },
          },
        });
      }

      // Ya confirmado: el stock se asienta ahora (si no, al confirmar).
      if (albaran.status === AlbaranStatus.CONFIRMADO) {
        await this.stockService.processAddedLine(
          tx,
          albaran,
          returnLine,
          tenantId,
        );
      }
    });

    // Al anotarla quizá el OCR aún no había reconocido al proveedor.
    await this.ensureIncident(ret.id, tenantId);
    return this.getReturn(ret.id, tenantId);
  }

  /** Deshace una devolución aplicada mientras el albarán no esté confirmado. */
  async unapply(albaranId: string, returnId: string, tenantId: string) {
    const albaran = await this.getAlbaran(albaranId, tenantId);
    const ret = await this.getReturn(returnId, tenantId);
    if (
      ret.albaranId !== albaranId ||
      ret.status !== AlbaranReturnStatus.APLICADA
    ) {
      throw new BadRequestException("Esta devolución no está aplicada");
    }
    if (
      albaran.status === AlbaranStatus.CONFIRMADO ||
      albaran.status === AlbaranStatus.ARCHIVADO
    ) {
      throw new BadRequestException(
        "El albarán ya está confirmado: la devolución no se puede deshacer",
      );
    }
    const line = albaran.lines.find((l) => l.id === ret.appliedLineId);

    await this.prisma.$transaction(async (tx) => {
      await tx.albaranReturn.update({
        where: { id: ret.id },
        data: {
          status: AlbaranReturnStatus.PENDIENTE,
          settlement: null,
          lineId: null,
          appliedLineId: null,
        },
      });
      if (line) {
        await tx.albaranLine.delete({ where: { id: line.id } });
        const net = Number(line.totalPrice ?? 0);
        if (!hasPaperTotal(albaran) && net !== 0) {
          const vat = round2(net * (Number(line.vatPercent) / 100));
          await tx.albaran.update({
            where: { id: albaranId },
            data: {
              grossAmount: { decrement: Number(line.lineAmount) },
              base: { decrement: net },
              vatTotal: { decrement: vat },
              total: { decrement: round2(net + vat) },
            },
          });
        }
      }
    });
    return this.getReturn(ret.id, tenantId);
  }

  async discard(
    albaranId: string,
    returnId: string,
    dto: DiscardAlbaranReturnDto,
    tenantId: string,
  ) {
    const ret = await this.getReturn(returnId, tenantId);
    if (
      ret.albaranId !== albaranId ||
      ret.status !== AlbaranReturnStatus.PENDIENTE
    ) {
      throw new BadRequestException(
        "Solo se descarta una devolución pendiente",
      );
    }
    const note = dto.note.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.albaranReturn.update({
        where: { id: ret.id },
        data: { status: AlbaranReturnStatus.DESCARTADA, discardNote: note },
      });
      await resolveReturnIncident(tx, ret.sictedIncidentId, `Anulada: ${note}`);
    });
    return this.getReturn(ret.id, tenantId);
  }

  /** Devoluciones con abono aparte de un proveedor que aún no tienen abono. */
  async listPendingCreditNotes(tenantId: string, supplierId: string) {
    return this.prisma.albaranReturn.findMany({
      where: {
        tenantId,
        status: AlbaranReturnStatus.APLICADA,
        settlement: AlbaranReturnSettlement.CREDIT_NOTE,
        creditNoteSettledAt: null,
        albaran: { supplierId, deletedAt: null },
      },
      include: {
        albaran: {
          select: {
            id: true,
            albaranNumber: true,
            internalNumber: true,
            date: true,
          },
        },
      },
      orderBy: { reportedAt: "asc" },
    });
  }

  /**
   * Enlaza (o desenlaza) una línea de un abono aparte con la devolución que
   * cubre. Al confirmar el abono, esa línea no mueve stock (ya salió con la
   * devolución) ni se envía a Cuiner.
   */
  async coverReturn(
    albaranId: string,
    lineId: string,
    returnId: string | null | undefined,
    tenantId: string,
  ) {
    const albaran = await this.getAlbaran(albaranId, tenantId);
    if (
      albaran.status === AlbaranStatus.CONFIRMADO ||
      albaran.status === AlbaranStatus.ARCHIVADO
    ) {
      throw new BadRequestException(
        "Enlaza el abono con la devolución antes de confirmarlo",
      );
    }
    const line = albaran.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.albaranReturn.updateMany({
        where: { tenantId, creditNoteLineId: lineId },
        data: { creditNoteLineId: null },
      });
      if (!returnId) {
        return { success: true, data: null };
      }
      const ret = await tx.albaranReturn.findFirst({
        where: { id: returnId, tenantId },
        include: { albaran: { select: { supplierId: true } } },
      });
      if (
        !ret ||
        ret.status !== AlbaranReturnStatus.APLICADA ||
        ret.settlement !== AlbaranReturnSettlement.CREDIT_NOTE ||
        ret.creditNoteSettledAt
      ) {
        throw new BadRequestException(
          "Esa devolución no está pendiente de abono",
        );
      }
      if (
        ret.albaranId === albaranId ||
        ret.albaran.supplierId !== albaran.supplierId
      ) {
        throw new BadRequestException(
          "El abono tiene que ser del mismo proveedor y de otro albarán",
        );
      }
      if (ret.creditNoteLineId && ret.creditNoteLineId !== lineId) {
        throw new BadRequestException(
          "Esa devolución ya está enlazada con otra línea de abono",
        );
      }
      const updated = await tx.albaranReturn.update({
        where: { id: ret.id },
        data: { creditNoteLineId: lineId },
      });
      return { success: true, data: updated };
    });
  }

  private async getAlbaran(albaranId: string, tenantId: string) {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id: albaranId, tenantId, deletedAt: null },
      include: { lines: true, supplier: true },
    });
    if (!albaran) {
      throw new NotFoundException("Albarán no encontrado");
    }
    return albaran;
  }

  private async getReturn(returnId: string, tenantId: string) {
    const ret = await this.prisma.albaranReturn.findFirst({
      where: { id: returnId, tenantId },
    });
    if (!ret) {
      throw new NotFoundException("Devolución no encontrada");
    }
    return ret;
  }

  private async assertNotInCuiner(albaranId: string) {
    const cuinerExport = await this.prisma.cuinerAlbaranExport.findUnique({
      where: { albaranId },
      select: { status: true },
    });
    if (cuinerExport?.status === CuinerExportStatus.ENVIADO) {
      throw new BadRequestException(
        "Este albarán ya está en Cuiner: la devolución queda anotada, pero el ajuste hay que hacerlo allí",
      );
    }
    if (cuinerExport?.status === CuinerExportStatus.PENDIENTE) {
      throw new BadRequestException(
        "Este albarán está en cola de envío a Cuiner: espera a que termine",
      );
    }
  }

  /**
   * Incidencia de recepción PROV.3 de la devolución, si el cliente tiene SICTED
   * y el albarán ya tiene proveedor. Idempotente: se reintenta al aplicarla por
   * si al anotarla el OCR aún no había reconocido al proveedor.
   */
  async ensureIncident(returnId: string, tenantId: string): Promise<void> {
    const ret = await this.prisma.albaranReturn.findFirst({
      where: { id: returnId, tenantId },
      include: { albaran: { include: { supplier: true } } },
    });
    if (!ret || ret.sictedIncidentId || !ret.albaran.supplier) {
      return;
    }
    if (!(await this.modulesService.isModuleEnabled(tenantId, "sicted"))) {
      return;
    }
    const number = ret.albaran.albaranNumber || ret.albaran.internalNumber;
    const incident = await this.prisma.sictedSupplierIncident.create({
      data: {
        tenantId,
        supplierId: ret.albaran.supplier.id,
        supplierName: ret.albaran.supplier.name,
        albaranId: ret.albaranId,
        occurredAt: ret.reportedAt,
        rejectionCause: ret.reason,
        description: `Devuelto al repartidor: ${fmtQuantity(ret.quantity, ret.unit)}${ret.description} (albarán ${number})`,
        reportedByName: ret.reportedByName,
      },
    });
    await this.prisma.albaranReturn.update({
      where: { id: ret.id },
      data: { sictedIncidentId: incident.id },
    });
  }
}
