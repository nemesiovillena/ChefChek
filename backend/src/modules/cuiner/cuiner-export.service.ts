import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AlbaranStatus,
  CuinerExportStatus,
  LineStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  buildCuinerAlbaranPayload,
  CuinerAlbaranPayload,
  vatCodeFor,
} from "./cuiner-albaran-payload";
import { ExportResultDto } from "./dto/cuiner.dto";

/** Diferencia máxima (€) admitida entre el total calculado y el del albarán. */
const TOTAL_MISMATCH_TOLERANCE = 0.05;

export interface CuinerExportPreview {
  /** Qué impide enviar el albarán (vacío = se puede enviar). */
  problems: string[];
  payload: CuinerAlbaranPayload | null;
}

/**
 * Cola de envío de albaranes a Cuiner. El usuario la alimenta con el botón
 * «Enviar a Cuiner» (nunca de forma automática) y el conector la vacía y
 * registra el resultado. El payload se calcula aquí y se congela en la cola,
 * así el conector escribe exactamente lo que el usuario previsualizó.
 */
@Injectable()
export class CuinerExportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    tenantId: string,
    albaranId: string,
  ): Promise<CuinerExportPreview> {
    const [config, albaran] = await Promise.all([
      this.prisma.cuinerConfig.findUnique({ where: { tenantId } }),
      this.prisma.albaran.findFirst({
        where: { id: albaranId, tenantId, deletedAt: null },
        include: {
          supplier: { select: { name: true } },
          lines: { orderBy: { lineOrder: "asc" } },
        },
      }),
    ]);
    if (!albaran) {
      throw new NotFoundException("Albarán no encontrado");
    }

    const problems: string[] = [];
    if (!config) {
      return {
        problems: ["El conector de Cuiner no está configurado"],
        payload: null,
      };
    }
    if (!config.enabled) {
      problems.push("El conector de Cuiner está desactivado");
    }
    if (albaran.status !== AlbaranStatus.CONFIRMADO) {
      problems.push("Solo se pueden enviar albaranes confirmados");
    }

    const supplierMap = albaran.supplierId
      ? await this.prisma.cuinerSupplierMap.findUnique({
          where: {
            tenantId_supplierId: { tenantId, supplierId: albaran.supplierId },
          },
        })
      : null;
    if (!albaran.supplierId) {
      problems.push("El albarán no tiene proveedor");
    } else if (!supplierMap) {
      problems.push(
        `El proveedor «${albaran.supplier?.name}» no está enlazado con Cuiner`,
      );
    }

    const lines = albaran.lines.filter(
      (l) => l.lineStatus !== LineStatus.RECHAZADO,
    );
    if (lines.length === 0) {
      problems.push("El albarán no tiene líneas");
    }

    const productIds = [
      ...new Set(
        lines.map((l) => l.matchedProductId).filter((id): id is string => !!id),
      ),
    ];
    const productMaps = await this.prisma.cuinerProductMap.findMany({
      where: { tenantId, productId: { in: productIds } },
    });
    const articuloByProduct = new Map(
      productMaps.map((m) => [m.productId, m.articulo]),
    );
    const articles = await this.prisma.cuinerArticle.findMany({
      where: { tenantId, codigo: { in: productMaps.map((m) => m.articulo) } },
    });
    const medidaByArticulo = new Map(articles.map((a) => [a.codigo, a.medida]));
    // Cuiner graba en la línea el nombre de su artículo, no el texto del papel:
    // la descripción del OCR puede venir mal leída («CORSA CORU PIEL Fine»).
    const descripcionByArticulo = new Map(
      articles.map((a) => [a.codigo, a.descripcion?.trim()]),
    );

    for (const line of lines) {
      if (!line.matchedProductId) {
        problems.push(
          `La línea «${line.description}» no está vinculada a un artículo`,
        );
      } else if (!articuloByProduct.has(line.matchedProductId)) {
        problems.push(
          `El artículo de la línea «${line.description}» no está enlazado con Cuiner`,
        );
      }
      if (vatCodeFor(line.vatPercent) === undefined) {
        problems.push(
          `IVA ${line.vatPercent}% de «${line.description}» no existe en Cuiner`,
        );
      }
      if (!(line.quantity > 0)) {
        problems.push(`La línea «${line.description}» no tiene cantidad`);
      }
    }

    if (problems.length > 0 || !supplierMap) {
      return { problems, payload: null };
    }

    const payload = buildCuinerAlbaranPayload({
      albaranId: albaran.id,
      empresa: config.empresa,
      centro: config.centro,
      almacen: config.almacen,
      proveedor: supplierMap.codigo,
      actUsuario: config.actUsuario ?? "",
      date: albaran.date,
      albaranNumber: albaran.albaranNumber,
      lines: lines.map((line) => {
        const articulo = articuloByProduct.get(
          line.matchedProductId as string,
        ) as string;
        return {
          articulo,
          description: descripcionByArticulo.get(articulo) || line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          netAmount: line.totalPrice,
          vatPercent: line.vatPercent,
          medida: medidaByArticulo.get(articulo) ?? null,
          lot: line.lot,
        };
      }),
    });
    // Última barrera: si lo que se escribiría en Cuiner no cuadra con el
    // total del papel, casi siempre es un IVA mal leído por el OCR en alguna
    // línea. Mejor bloquear que meter un albarán con el IVA equivocado.
    if (
      albaran.total > 0 &&
      Math.abs(payload.total - albaran.total) > TOTAL_MISMATCH_TOLERANCE
    ) {
      const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
      return {
        problems: [
          `El total calculado (${fmt(payload.total)}) no cuadra con el total del albarán (${fmt(albaran.total)}): revisa el IVA y los importes de las líneas`,
        ],
        payload: null,
      };
    }
    return { problems, payload };
  }

  /** Botón «Enviar a Cuiner»: valida, congela el payload y lo encola. */
  async requestSend(tenantId: string, albaranId: string, userId: string) {
    const existing = await this.prisma.cuinerAlbaranExport.findUnique({
      where: { albaranId },
    });
    if (existing && existing.tenantId !== tenantId) {
      throw new NotFoundException("Albarán no encontrado");
    }
    if (existing?.status === CuinerExportStatus.ENVIADO) {
      throw new ConflictException(
        `Este albarán ya está en Cuiner (documento ${existing.cuinerIdDocsCab})`,
      );
    }

    const { problems, payload } = await this.preview(tenantId, albaranId);
    if (problems.length > 0 || !payload) {
      throw new BadRequestException({
        message: "No se puede enviar a Cuiner",
        problems,
      });
    }

    const data = {
      status: CuinerExportStatus.PENDIENTE,
      payload: payload as unknown as Prisma.InputJsonValue,
      error: null,
      requestedBy: userId,
      requestedAt: new Date(),
      processedAt: null,
    };
    return this.prisma.cuinerAlbaranExport.upsert({
      where: { albaranId },
      create: { tenantId, albaranId, ...data },
      update: data,
    });
  }

  async list(tenantId: string, status?: CuinerExportStatus) {
    return this.prisma.cuinerAlbaranExport.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { requestedAt: "desc" },
      take: 200,
    });
  }

  async getForAlbaran(tenantId: string, albaranId: string) {
    return this.prisma.cuinerAlbaranExport.findFirst({
      where: { tenantId, albaranId },
    });
  }

  // ─── Conector ────────────────────────────────────────────────────────────

  async listPendingForConnector(tenantId: string) {
    return this.prisma.cuinerAlbaranExport.findMany({
      where: { tenantId, status: CuinerExportStatus.PENDIENTE },
      orderBy: { requestedAt: "asc" },
      select: { id: true, albaranId: true, payload: true },
      take: 20,
    });
  }

  /**
   * Resultado del conector. Solo transiciona desde PENDIENTE: un resultado
   * tardío o repetido nunca pisa un ENVIADO ya registrado.
   */
  async recordResult(tenantId: string, exportId: string, dto: ExportResultDto) {
    if (dto.ok && !dto.simulated && !dto.idDocsCab) {
      throw new BadRequestException(
        "Un envío real debe indicar el Id_DocsCab de Cuiner",
      );
    }
    const status = !dto.ok
      ? CuinerExportStatus.ERROR
      : dto.simulated
        ? CuinerExportStatus.SIMULADO
        : CuinerExportStatus.ENVIADO;

    const { count } = await this.prisma.cuinerAlbaranExport.updateMany({
      where: { id: exportId, tenantId, status: CuinerExportStatus.PENDIENTE },
      data: {
        status,
        cuinerIdDocsCab:
          status === CuinerExportStatus.ENVIADO ? dto.idDocsCab : null,
        error: dto.ok ? null : (dto.error ?? "Error sin detalle"),
        attempts: { increment: 1 },
        processedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException("El envío no existe o ya no está pendiente");
    }
    return { status };
  }
}
