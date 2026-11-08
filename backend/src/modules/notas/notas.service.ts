import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateNoteDto,
  ListNotesQueryDto,
  MarkNoteDoneDto,
  UpdateNoteDto,
} from "./dto/note.dto";
import { endOfTodayIn, isNoteManager, NoteActor } from "./note-actor";

const DEFAULT_PAGE_SIZE = 30;
const HIGHLIGHTS_LIMIT = 20;
const TIME_ZONE = "Europe/Madrid";

const NOTE_INCLUDE = {
  tag: { select: { id: true, name: true, color: true } },
} as const;

/** Orden de la lista: fijadas, luego por aviso más próximo, luego recientes. */
const NOTE_ORDER: Prisma.NoteOrderByWithRelationInput[] = [
  { pinned: "desc" },
  { remindAt: { sort: "asc", nulls: "last" } },
  { updatedAt: "desc" },
  { id: "asc" },
];

@Injectable()
export class NotasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Toda consulta de notas pasa por aquí: una nota privada solo existe para su
   * autor (ni gerencia la ve). Una privada ajena responde 404, no 403.
   */
  private visibleWhere(
    tenantId: string,
    actor: NoteActor,
  ): Prisma.NoteWhereInput {
    // Un dispositivo compartido nunca ve privadas, aunque las creara su
    // cuenta cuando aún era personal.
    if (actor.isSharedAccount) {
      return { tenantId, deletedAt: null, isPrivate: false };
    }
    return {
      tenantId,
      deletedAt: null,
      OR: [{ isPrivate: false }, { createdBy: actor.id }],
    };
  }

  async list(tenantId: string, actor: NoteActor, query: ListNotesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const and: Prisma.NoteWhereInput[] = [this.visibleWhere(tenantId, actor)];

    if (query.status === "done") {
      and.push({ doneAt: { not: null } });
    } else if (query.status === "pending") {
      and.push({ doneAt: null });
    }
    if (query.tagId) {
      and.push({ tagId: query.tagId });
    }
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { body: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.NoteWhereInput = { AND: and };
    const orderBy =
      query.status === "done"
        ? [{ doneAt: "desc" as const }, { id: "asc" as const }]
        : NOTE_ORDER;

    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        orderBy,
        include: NOTE_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.note.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Para la card del inicio: pendientes fijadas o con aviso de hoy o anterior.
   * Un dispositivo compartido nunca recibe privadas, aunque las creara su cuenta.
   */
  async highlights(tenantId: string, actor: NoteActor, sharedDevice: boolean) {
    const visibility: Prisma.NoteWhereInput = sharedDevice
      ? { tenantId, deletedAt: null, isPrivate: false }
      : this.visibleWhere(tenantId, actor);

    const data = await this.prisma.note.findMany({
      where: {
        AND: [
          visibility,
          { doneAt: null },
          {
            OR: [
              { pinned: true },
              { remindAt: { lt: endOfTodayIn(TIME_ZONE) } },
            ],
          },
        ],
      },
      orderBy: NOTE_ORDER,
      include: NOTE_INCLUDE,
      take: HIGHLIGHTS_LIMIT,
    });

    return { success: true, data };
  }

  async create(tenantId: string, actor: NoteActor, dto: CreateNoteDto) {
    if (dto.isPrivate && actor.isSharedAccount) {
      throw new BadRequestException(
        "Las notas «solo para mí» se crean desde una cuenta personal.",
      );
    }
    const byName = await this.resolvePersonName(actor, dto.byName);
    if (dto.tagId) {
      await this.assertTag(tenantId, dto.tagId);
    }

    const data = await this.prisma.note.create({
      data: {
        tenantId,
        body: dto.body,
        title: dto.title ?? null,
        tagId: dto.tagId ?? null,
        isPrivate: dto.isPrivate ?? false,
        pinned: dto.pinned ?? false,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
        remindHasTime: dto.remindAt ? (dto.remindHasTime ?? false) : false,
        createdBy: actor.id,
        createdByName: byName,
      },
      include: NOTE_INCLUDE,
    });

    return { success: true, data };
  }

  async update(
    tenantId: string,
    actor: NoteActor,
    id: string,
    dto: UpdateNoteDto,
  ) {
    const note = await this.findVisible(tenantId, actor, id);
    if (dto.isPrivate !== undefined && dto.isPrivate !== note.isPrivate) {
      // Solo el autor, desde su cuenta personal, decide si su nota es privada.
      if (actor.isSharedAccount || note.createdBy !== actor.id) {
        throw new ForbiddenException(
          "Solo quien escribió la nota puede cambiar «solo para mí».",
        );
      }
    }
    if (dto.tagId) {
      await this.assertTag(tenantId, dto.tagId);
    }

    const data = await this.prisma.note.update({
      where: { id: note.id },
      data: {
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.tagId !== undefined && { tagId: dto.tagId }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
        ...(dto.remindAt !== undefined && {
          remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
          ...(dto.remindAt === null && { remindHasTime: false }),
        }),
        ...(dto.remindHasTime !== undefined &&
          dto.remindAt !== null && { remindHasTime: dto.remindHasTime }),
        updatedBy: actor.id,
      },
      include: NOTE_INCLUDE,
    });

    return { success: true, data };
  }

  async markDone(
    tenantId: string,
    actor: NoteActor,
    id: string,
    dto: MarkNoteDoneDto,
  ) {
    const note = await this.findVisible(tenantId, actor, id);
    if (note.doneAt) {
      // Ya hecha: idempotente, no pisa quién ni cuándo.
      const data = await this.prisma.note.findUnique({
        where: { id: note.id },
        include: NOTE_INCLUDE,
      });
      return { success: true, data };
    }
    const byName = await this.resolvePersonName(actor, dto.byName);

    // Solo si sigue pendiente: si otra persona la marcó a la vez, gana la primera.
    await this.prisma.note.updateMany({
      where: { id: note.id, doneAt: null },
      data: { doneAt: new Date(), doneBy: actor.id, doneByName: byName },
    });
    const data = await this.prisma.note.findUnique({
      where: { id: note.id },
      include: NOTE_INCLUDE,
    });
    return { success: true, data };
  }

  async markUndone(tenantId: string, actor: NoteActor, id: string) {
    const note = await this.findVisible(tenantId, actor, id);
    const data = await this.prisma.note.update({
      where: { id: note.id },
      data: {
        doneAt: null,
        doneBy: null,
        doneByName: null,
        updatedBy: actor.id,
      },
      include: NOTE_INCLUDE,
    });
    return { success: true, data };
  }

  /** Borrado blando → Papelera. Borra el autor o gerencia. */
  async remove(tenantId: string, actor: NoteActor, id: string) {
    const note = await this.findVisible(tenantId, actor, id);
    if (note.createdBy !== actor.id && !isNoteManager(actor)) {
      throw new ForbiddenException(
        "Solo quien escribió la nota o gerencia pueden borrarla.",
      );
    }
    await this.prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });
    return { success: true, message: "Nota enviada a la papelera" };
  }

  private async findVisible(tenantId: string, actor: NoteActor, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { AND: [this.visibleWhere(tenantId, actor), { id }] },
    });
    if (!note) {
      throw new NotFoundException("Nota no encontrada");
    }
    return note;
  }

  private async assertTag(tenantId: string, tagId: string) {
    const tag = await this.prisma.noteTag.findFirst({
      where: { id: tagId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tag) {
      throw new BadRequestException("Etiqueta no encontrada");
    }
  }

  /**
   * «Quién»: una cuenta personal firma siempre con su nombre (se ignora lo que
   * mande el cliente); un dispositivo compartido debe decir quién es.
   */
  private async resolvePersonName(
    actor: NoteActor,
    requested: string | undefined,
  ): Promise<string> {
    if (!actor.isSharedAccount) {
      const user = await this.prisma.user.findFirst({
        where: { id: actor.id },
        select: { name: true },
      });
      return user?.name ?? requested ?? "";
    }
    if (!requested) {
      throw new BadRequestException("Indica quién eres para guardar la nota.");
    }
    return requested;
  }
}
