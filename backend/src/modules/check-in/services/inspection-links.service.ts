import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../../common/services/prisma.service";
import { Actor } from "./adjustments.service";

const MAX_DAYS = 60;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const monthIndex = (year: number, month: number) => year * 12 + (month - 1);

export interface CreateInspectionLinkInput {
  label?: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  /** Días de validez (1-60). */
  validDays: number;
}

/**
 * Enlaces de solo lectura para la Inspección de Trabajo. El token solo se
 * devuelve al crearlo; en la base de datos queda su huella, así que ni con
 * acceso a la BD se puede reconstruir un enlace. Caducan y se pueden revocar.
 */
@Injectable()
export class InspectionLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, input: CreateInspectionLinkInput, by: Actor) {
    const from = monthIndex(input.fromYear, input.fromMonth);
    const to = monthIndex(input.toYear, input.toMonth);
    const now = new Date();
    if (to < from) {
      throw new BadRequestException("El periodo no es válido.");
    }
    if (to > monthIndex(now.getFullYear(), now.getMonth() + 1)) {
      throw new BadRequestException("El periodo no puede ser futuro.");
    }
    if (to - from > 47) {
      throw new BadRequestException("El periodo máximo es de 4 años.");
    }
    if (input.validDays < 1 || input.validDays > MAX_DAYS) {
      throw new BadRequestException(
        `La validez debe estar entre 1 y ${MAX_DAYS} días.`,
      );
    }
    const token = randomBytes(32).toString("base64url");
    const link = await this.prisma.checkInInspectionLink.create({
      data: {
        tenantId,
        tokenHash: hashToken(token),
        label: input.label?.trim() || null,
        fromYear: input.fromYear,
        fromMonth: input.fromMonth,
        toYear: input.toYear,
        toMonth: input.toMonth,
        expiresAt: new Date(now.getTime() + input.validDays * 86_400_000),
        createdByUserId: by.id,
        createdByName: by.name,
      },
    });
    return { ...toView(link), token };
  }

  async list(tenantId: string) {
    const links = await this.prisma.checkInInspectionLink.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return links.map(toView);
  }

  async revoke(tenantId: string, id: string) {
    const link = await this.prisma.checkInInspectionLink.findFirst({
      where: { id, tenantId },
    });
    if (!link) {
      throw new NotFoundException("Enlace no encontrado");
    }
    if (link.revokedAt) {
      return toView(link);
    }
    return toView(
      await this.prisma.checkInInspectionLink.update({
        where: { id },
        data: { revokedAt: new Date() },
      }),
    );
  }

  /**
   * Valida un token y anota el acceso. Un token desconocido, caducado o
   * revocado responde igual (404), sin dar pistas.
   */
  async resolve(token: string) {
    const link = await this.prisma.checkInInspectionLink.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!link || link.revokedAt || link.expiresAt <= new Date()) {
      throw new NotFoundException("Enlace no válido o caducado.");
    }
    await this.prisma.checkInInspectionLink.update({
      where: { id: link.id },
      data: { accessCount: { increment: 1 }, lastAccessAt: new Date() },
    });
    return link;
  }

  /** ¿Cae ese mes dentro del periodo que cubre el enlace? */
  covers(
    link: {
      fromYear: number;
      fromMonth: number;
      toYear: number;
      toMonth: number;
    },
    year: number,
    month: number,
  ): boolean {
    const index = monthIndex(year, month);
    return (
      index >= monthIndex(link.fromYear, link.fromMonth) &&
      index <= monthIndex(link.toYear, link.toMonth)
    );
  }
}

function toView(link: {
  id: string;
  label: string | null;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  expiresAt: Date;
  createdByName: string;
  createdAt: Date;
  revokedAt: Date | null;
  accessCount: number;
  lastAccessAt: Date | null;
}) {
  return {
    id: link.id,
    label: link.label,
    fromYear: link.fromYear,
    fromMonth: link.fromMonth,
    toYear: link.toYear,
    toMonth: link.toMonth,
    expiresAt: link.expiresAt,
    createdByName: link.createdByName,
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
    accessCount: link.accessCount,
    lastAccessAt: link.lastAccessAt,
    active: !link.revokedAt && link.expiresAt > new Date(),
  };
}
