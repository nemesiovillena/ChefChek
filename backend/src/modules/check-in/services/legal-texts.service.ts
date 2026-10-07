import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CheckInLegalText, CheckInLegalTextKind } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  LEGAL_TEXT_DRAFTS,
  findLegalTextDraft,
} from "../constants/legal-text-drafts";

export interface LegalTextState {
  kind: CheckInLegalTextKind;
  title: string;
  description: string;
  /** Última versión (puede ser un borrador sin validar). */
  latest: CheckInLegalText;
  /** Versión vigente: la última validada, o null si nunca se validó. */
  current: CheckInLegalText | null;
  /** true si hay cambios guardados posteriores a la versión vigente. */
  hasPendingChanges: boolean;
}

export interface CheckInReadiness {
  ready: boolean;
  /** Tipos de texto que aún no tienen ninguna versión validada. */
  missing: CheckInLegalTextKind[];
}

/**
 * Textos legales versionados. Editar un texto validado crea una versión nueva
 * sin validar; la vigente sigue siendo la última validada. El fichaje exige
 * que todos los tipos tengan una versión validada (ver getReadiness).
 */
@Injectable()
export class LegalTextsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Estado de cada texto; siembra los borradores que falten. */
  async list(tenantId: string): Promise<LegalTextState[]> {
    await this.ensureDrafts(tenantId);
    const rows = await this.prisma.checkInLegalText.findMany({
      where: { tenantId },
      orderBy: { version: "desc" },
    });
    return LEGAL_TEXT_DRAFTS.map((draft) => {
      const versions = rows.filter((row) => row.kind === draft.kind);
      const latest = versions[0];
      const current = versions.find((row) => row.validatedAt !== null) ?? null;
      return {
        kind: draft.kind,
        title: draft.title,
        description: draft.description,
        latest,
        current,
        hasPendingChanges: current !== null && latest.id !== current.id,
      };
    });
  }

  /**
   * Guarda contenido: sobre el borrador en curso si la última versión no está
   * validada; si lo está, abre una versión nueva (la validada no se toca).
   */
  async save(
    tenantId: string,
    kind: CheckInLegalTextKind,
    content: string,
    userId: string,
  ) {
    const latest = await this.findLatest(tenantId, kind);
    const trimmed = content.trim();
    if (latest.validatedAt === null) {
      return this.prisma.checkInLegalText.update({
        where: { id: latest.id },
        data: { content: trimmed, createdByUserId: userId },
      });
    }
    if (latest.content === trimmed) {
      return latest;
    }
    return this.prisma.checkInLegalText.create({
      data: {
        tenantId,
        kind,
        version: latest.version + 1,
        content: trimmed,
        createdByUserId: userId,
      },
    });
  }

  /** Valida la última versión: queda como vigente, con quién y cuándo. */
  async validate(
    tenantId: string,
    kind: CheckInLegalTextKind,
    user: { id: string; name: string },
  ) {
    const latest = await this.findLatest(tenantId, kind);
    if (latest.validatedAt !== null) {
      return latest;
    }
    if (/\[[^\]]+\]/.test(latest.content)) {
      throw new BadRequestException(
        "El texto aún tiene campos entre corchetes sin completar.",
      );
    }
    return this.prisma.checkInLegalText.update({
      where: { id: latest.id },
      data: {
        validatedAt: new Date(),
        validatedByUserId: user.id,
        validatedByName: user.name,
      },
    });
  }

  /** ¿Se puede fichar? Solo si cada tipo de texto tiene una versión validada. */
  async getReadiness(tenantId: string): Promise<CheckInReadiness> {
    const validated = await this.prisma.checkInLegalText.findMany({
      where: { tenantId, validatedAt: { not: null } },
      select: { kind: true },
      distinct: ["kind"],
    });
    const done = new Set(validated.map((row) => row.kind));
    const missing = LEGAL_TEXT_DRAFTS.map((draft) => draft.kind).filter(
      (kind) => !done.has(kind),
    );
    return { ready: missing.length === 0, missing };
  }

  private async ensureDrafts(tenantId: string) {
    const existing = await this.prisma.checkInLegalText.findMany({
      where: { tenantId },
      select: { kind: true },
      distinct: ["kind"],
    });
    const present = new Set(existing.map((row) => row.kind));
    const toCreate = LEGAL_TEXT_DRAFTS.filter(
      (draft) => !present.has(draft.kind),
    );
    if (toCreate.length === 0) {
      return;
    }
    // skipDuplicates: dos peticiones simultáneas no deben chocar con el unique.
    await this.prisma.checkInLegalText.createMany({
      data: toCreate.map((draft) => ({
        tenantId,
        kind: draft.kind,
        version: 1,
        content: draft.content,
      })),
      skipDuplicates: true,
    });
  }

  private async findLatest(tenantId: string, kind: CheckInLegalTextKind) {
    if (!findLegalTextDraft(kind)) {
      throw new NotFoundException("Tipo de texto no reconocido");
    }
    await this.ensureDrafts(tenantId);
    const latest = await this.prisma.checkInLegalText.findFirst({
      where: { tenantId, kind },
      orderBy: { version: "desc" },
    });
    if (!latest) {
      throw new NotFoundException("Texto no encontrado");
    }
    return latest;
  }
}
