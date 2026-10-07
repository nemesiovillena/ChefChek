import { Injectable } from "@nestjs/common";
import { CheckInLegalText, CheckInLegalTextKind } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { findLegalTextDraft } from "../constants/legal-text-drafts";

/**
 * Textos que el empleado debe leer antes de fichar desde su cuenta. El
 * protocolo interno queda a su disposición pero no bloquea el fichaje.
 */
const ACK_REQUIRED_KINDS: CheckInLegalTextKind[] = [
  CheckInLegalTextKind.REGISTRO_JORNADA_INFO,
  CheckInLegalTextKind.GEOLOCALIZACION,
];

export interface LegalTextForEmployee {
  id: string;
  kind: CheckInLegalTextKind;
  title: string;
  version: number;
  content: string;
}

/**
 * Acuses de los textos legales vigentes. Si el administrador valida una
 * versión nueva, el empleado vuelve a tener pendiente esa versión.
 */
@Injectable()
export class LegalAcksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Versión vigente (última validada) de cada tipo de texto. */
  async listCurrent(tenantId: string): Promise<LegalTextForEmployee[]> {
    const validated = await this.prisma.checkInLegalText.findMany({
      where: { tenantId, validatedAt: { not: null } },
      orderBy: { version: "desc" },
    });
    const current = new Map<CheckInLegalTextKind, CheckInLegalText>();
    for (const row of validated) {
      if (!current.has(row.kind)) {
        current.set(row.kind, row);
      }
    }
    return [...current.values()].map((row) => ({
      id: row.id,
      kind: row.kind,
      title: findLegalTextDraft(row.kind)?.title ?? row.kind,
      version: row.version,
      content: row.content,
    }));
  }

  /** Textos vigentes de lectura obligatoria que el empleado aún no ha acusado. */
  async listPending(
    tenantId: string,
    employeeId: string,
  ): Promise<LegalTextForEmployee[]> {
    const required = (await this.listCurrent(tenantId)).filter((text) =>
      ACK_REQUIRED_KINDS.includes(text.kind),
    );
    if (required.length === 0) {
      return [];
    }
    const acks = await this.prisma.checkInLegalAck.findMany({
      where: {
        tenantId,
        employeeId,
        legalTextId: { in: required.map((text) => text.id) },
      },
      select: { legalTextId: true },
    });
    const acked = new Set(acks.map((ack) => ack.legalTextId));
    return required.filter((text) => !acked.has(text.id));
  }

  /** Registra el acuse de todos los textos pendientes del empleado. */
  async ackPending(
    tenantId: string,
    employee: { id: string; name: string },
  ): Promise<number> {
    const pending = await this.listPending(tenantId, employee.id);
    if (pending.length === 0) {
      return 0;
    }
    const result = await this.prisma.checkInLegalAck.createMany({
      data: pending.map((text) => ({
        tenantId,
        legalTextId: text.id,
        kind: text.kind,
        version: text.version,
        employeeId: employee.id,
        employeeName: employee.name,
      })),
      // Doble pulsación: el unique (legalTextId, employeeId) ya lo cubre.
      skipDuplicates: true,
    });
    return result.count;
  }
}
