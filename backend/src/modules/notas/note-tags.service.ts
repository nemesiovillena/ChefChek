import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateNoteTagDto,
  NoteTagColor,
  ReorderNoteTagsDto,
  UpdateNoteTagDto,
} from "./dto/note-tag.dto";
import { isNoteManager, NoteActor } from "./note-actor";

/** Etiquetas con las que empieza cada restaurante; gerencia añade las que quiera. */
export const INITIAL_NOTE_TAGS: { name: string; color: NoteTagColor }[] = [
  { name: "Congelador", color: "sky" },
  { name: "Recordatorio", color: "amber" },
  { name: "Proveedores", color: "emerald" },
  { name: "Mantenimiento", color: "orange" },
  { name: "General", color: "slate" },
];

const TAG_SELECT = { id: true, name: true, color: true, sortOrder: true };

@Injectable()
export class NoteTagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista las etiquetas. La primera vez que un restaurante abre Notas (nunca
   * ha tenido etiquetas, ni borradas) se crean las iniciales.
   */
  async list(tenantId: string) {
    const everHad = await this.prisma.noteTag.count({ where: { tenantId } });
    if (everHad === 0) {
      await this.seedInitialTags(tenantId);
    }

    const data = await this.prisma.noteTag.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: TAG_SELECT,
    });
    return { success: true, data };
  }

  async create(tenantId: string, actor: NoteActor, dto: CreateNoteTagDto) {
    this.assertManager(actor);
    await this.assertNameFree(tenantId, dto.name);
    const last = await this.prisma.noteTag.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const data = await this.prisma.noteTag.create({
      data: {
        tenantId,
        name: dto.name,
        color: dto.color,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: TAG_SELECT,
    });
    return { success: true, data };
  }

  async update(
    tenantId: string,
    actor: NoteActor,
    id: string,
    dto: UpdateNoteTagDto,
  ) {
    this.assertManager(actor);
    await this.findTag(tenantId, id);
    if (dto.name) {
      await this.assertNameFree(tenantId, dto.name, id);
    }
    const data = await this.prisma.noteTag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      select: TAG_SELECT,
    });
    return { success: true, data };
  }

  async reorder(tenantId: string, actor: NoteActor, dto: ReorderNoteTagsDto) {
    this.assertManager(actor);
    // La lista debe traer todas las etiquetas activas, sin repetir.
    const active = await this.prisma.noteTag.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((t) => t.id));
    const requested = new Set(dto.ids);
    if (
      requested.size !== dto.ids.length ||
      requested.size !== activeIds.size ||
      dto.ids.some((id) => !activeIds.has(id))
    ) {
      throw new BadRequestException(
        "El orden debe incluir todas las etiquetas una vez",
      );
    }
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.noteTag.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.list(tenantId);
  }

  /** Las notas de una etiqueta borrada se quedan sin etiqueta (no se pierden). */
  async remove(tenantId: string, actor: NoteActor, id: string) {
    this.assertManager(actor);
    await this.findTag(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.note.updateMany({
        where: { tenantId, tagId: id },
        data: { tagId: null },
      }),
      this.prisma.noteTag.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);
    return { success: true, message: "Etiqueta borrada" };
  }

  /**
   * Crea las etiquetas iniciales bajo un candado por restaurante: si dos
   * dispositivos abren Notas por primera vez a la vez, solo uno las crea.
   */
  private async seedInitialTags(tenantId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`note_tags:${tenantId}`}))`;
      const count = await tx.noteTag.count({ where: { tenantId } });
      if (count > 0) {
        return;
      }
      await tx.noteTag.createMany({
        data: INITIAL_NOTE_TAGS.map((tag, index) => ({
          tenantId,
          name: tag.name,
          color: tag.color,
          sortOrder: index,
        })),
      });
    });
  }

  private assertManager(actor: NoteActor) {
    if (!isNoteManager(actor)) {
      throw new ForbiddenException("Solo gerencia gestiona las etiquetas.");
    }
  }

  private async findTag(tenantId: string, id: string) {
    const tag = await this.prisma.noteTag.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tag) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    return tag;
  }

  private async assertNameFree(
    tenantId: string,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.noteTag.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException("Ya hay una etiqueta con ese nombre");
    }
  }
}
