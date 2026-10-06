import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { CuinerConfig } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { UpdateCuinerConfigDto } from "./dto/cuiner.dto";

/** Configuración visible por el usuario: nunca incluye el hash del token. */
export type CuinerConfigPublic = Omit<CuinerConfig, "connectorTokenHash"> & {
  hasConnectorToken: boolean;
};

export const hashConnectorToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const toPublic = ({
  connectorTokenHash,
  ...rest
}: CuinerConfig): CuinerConfigPublic => ({
  ...rest,
  hasConnectorToken: Boolean(connectorTokenHash),
});

/**
 * Configuración del conector Cuiner por tenant: a qué Centro de Cuiner
 * corresponde, en qué modo trabaja (simulación por defecto) y el token con el
 * que se autentica el servicio instalado en el servidor de Cuiner.
 */
@Injectable()
export class CuinerConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<CuinerConfigPublic | null> {
    const config = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
    });
    return config ? toPublic(config) : null;
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateCuinerConfigDto,
  ): Promise<CuinerConfigPublic> {
    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId },
        select: { id: true },
      });
      if (!warehouse) {
        throw new BadRequestException("Almacén no encontrado");
      }
    }

    const existing = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
    });
    if (!existing && !dto.centro) {
      throw new BadRequestException(
        "Indica el centro de Cuiner al configurar el conector por primera vez",
      );
    }

    const merged = { ...existing, ...dto };
    if (merged.mode === "LIVE" && !merged.actUsuario) {
      throw new BadRequestException(
        "El modo real necesita el usuario de Cuiner que firma los albaranes",
      );
    }

    const data = {
      enabled: dto.enabled,
      mode: dto.mode,
      centro: dto.centro,
      almacen: dto.almacen,
      actUsuario: dto.actUsuario,
      warehouseId: dto.warehouseId,
    };
    const config = existing
      ? await this.prisma.cuinerConfig.update({ where: { tenantId }, data })
      : await this.prisma.cuinerConfig.create({
          data: { ...data, tenantId, centro: dto.centro as string },
        });
    return toPublic(config);
  }

  /**
   * Genera un token nuevo para el conector e invalida el anterior. El token
   * en claro solo se devuelve aquí; se guarda únicamente su sha256.
   */
  async regenerateConnectorToken(tenantId: string): Promise<{ token: string }> {
    const config = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!config) {
      throw new BadRequestException(
        "Configura el conector antes de generar el token",
      );
    }
    const token = `ckc_${randomBytes(32).toString("base64url")}`;
    await this.prisma.cuinerConfig.update({
      where: { tenantId },
      data: { connectorTokenHash: hashConnectorToken(token) },
    });
    return { token };
  }

  async findByConnectorToken(token: string): Promise<CuinerConfig | null> {
    if (!token) {
      return null;
    }
    return this.prisma.cuinerConfig.findFirst({
      where: { connectorTokenHash: hashConnectorToken(token) },
    });
  }

  async touchLastSeen(tenantId: string): Promise<void> {
    await this.prisma.cuinerConfig.update({
      where: { tenantId },
      data: { lastSeenAt: new Date() },
    });
  }

  /**
   * Primer arranque del conector: el cursor se coloca en la última venta
   * existente para no descontar del stock el histórico de años de ventas.
   * Solo actúa si el cursor sigue en 0 (idempotente).
   */
  async bootstrapSalesCursor(
    tenantId: string,
    maxVentasCabId: number,
  ): Promise<{ lastVentasCabId: number }> {
    await this.prisma.cuinerConfig.updateMany({
      where: { tenantId, lastVentasCabId: 0 },
      data: { lastVentasCabId: maxVentasCabId },
    });
    const config = await this.prisma.cuinerConfig.findUniqueOrThrow({
      where: { tenantId },
      select: { lastVentasCabId: true },
    });
    return config;
  }
}
