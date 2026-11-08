import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { NotasService } from "./notas.service";
import { INITIAL_NOTE_TAGS, NoteTagsService } from "./note-tags.service";
import { endOfTodayIn, NoteActor } from "./note-actor";

const TENANT = "t1";
const personal: NoteActor = { id: "u1", role: "USER", isSharedAccount: false };
const otherPerson: NoteActor = {
  id: "u2",
  role: "USER",
  isSharedAccount: false,
};
const manager: NoteActor = { id: "m1", role: "ADMIN", isSharedAccount: false };
const kitchen: NoteActor = { id: "k1", role: "USER", isSharedAccount: true };

describe("Notas", () => {
  let notes: NotasService;
  let tags: NoteTagsService;

  const prisma: any = {
    note: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    noteTag: {
      count: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn((arg: any) =>
      typeof arg === "function" ? arg(prisma) : Promise.all(arg),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotasService,
        NoteTagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    notes = module.get(NotasService);
    tags = module.get(NoteTagsService);
    prisma.user.findFirst.mockResolvedValue({ name: "Ana Pérez" });
    prisma.note.create.mockImplementation(({ data }: any) => data);
    prisma.note.update.mockImplementation(({ data }: any) => data);
  });

  describe("visibilidad de privadas", () => {
    it("la lista solo trae públicas o privadas propias", async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);
      await notes.list(TENANT, manager, {});
      const where = prisma.note.findMany.mock.calls[0][0].where;
      expect(where.AND[0]).toEqual({
        tenantId: TENANT,
        deletedAt: null,
        OR: [{ isPrivate: false }, { createdBy: "m1" }],
      });
    });

    it("editar, marcar hecha y borrar una privada ajena → 404", async () => {
      prisma.note.findFirst.mockResolvedValue(null);
      await expect(
        notes.update(TENANT, manager, "n1", { body: "x" }),
      ).rejects.toThrow(NotFoundException);
      await expect(notes.markDone(TENANT, manager, "n1", {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(notes.remove(TENANT, manager, "n1")).rejects.toThrow(
        NotFoundException,
      );
      for (const call of prisma.note.findFirst.mock.calls) {
        expect(call[0].where.AND[0].OR).toEqual([
          { isPrivate: false },
          { createdBy: "m1" },
        ]);
      }
    });

    it("la card de un dispositivo compartido nunca trae privadas", async () => {
      prisma.note.findMany.mockResolvedValue([]);
      await notes.highlights(TENANT, personal, true);
      await notes.highlights(TENANT, kitchen, false);
      for (const call of prisma.note.findMany.mock.calls) {
        expect(call[0].where.AND[0]).toEqual({
          tenantId: TENANT,
          deletedAt: null,
          isPrivate: false,
        });
      }
    });

    it("la lista de un dispositivo compartido nunca trae privadas", async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);
      await notes.list(TENANT, kitchen, {});
      expect(prisma.note.findMany.mock.calls[0][0].where.AND[0]).toEqual({
        tenantId: TENANT,
        deletedAt: null,
        isPrivate: false,
      });
    });

    it("la card de una cuenta personal incluye sus privadas", async () => {
      prisma.note.findMany.mockResolvedValue([]);
      await notes.highlights(TENANT, personal, false);
      expect(prisma.note.findMany.mock.calls[0][0].where.AND[0].OR).toEqual([
        { isPrivate: false },
        { createdBy: "u1" },
      ]);
    });
  });

  describe("crear", () => {
    it("cuenta compartida no puede crear privadas", async () => {
      await expect(
        notes.create(TENANT, kitchen, {
          body: "x",
          isPrivate: true,
          byName: "Luis",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("cuenta compartida debe indicar quién", async () => {
      await expect(
        notes.create(TENANT, kitchen, { body: "x" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("cuenta compartida firma con el nombre indicado", async () => {
      const res = await notes.create(TENANT, kitchen, {
        body: "3 bolsas de fondo",
        byName: "Luis",
      });
      expect(res.data).toMatchObject({
        createdBy: "k1",
        createdByName: "Luis",
      });
    });

    it("cuenta personal firma con su nombre aunque mande otro", async () => {
      const res = await notes.create(TENANT, personal, {
        body: "Llamar al técnico",
        byName: "Otro",
        isPrivate: true,
      });
      expect(res.data).toMatchObject({
        createdByName: "Ana Pérez",
        isPrivate: true,
      });
    });

    it("sin fecha de aviso no guarda «con hora»", async () => {
      const res = await notes.create(TENANT, personal, {
        body: "x",
        remindHasTime: true,
      });
      expect(res.data).toMatchObject({ remindAt: null, remindHasTime: false });
    });

    it("etiqueta inexistente → 400", async () => {
      prisma.noteTag.findFirst.mockResolvedValue(null);
      await expect(
        notes.create(TENANT, personal, { body: "x", tagId: "nope" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("editar", () => {
    it("solo el autor cambia «solo para mí»", async () => {
      prisma.note.findFirst.mockResolvedValue({
        id: "n1",
        createdBy: "u1",
        isPrivate: false,
      });
      await expect(
        notes.update(TENANT, otherPerson, "n1", { isPrivate: true }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        notes.update(TENANT, personal, "n1", { isPrivate: true }),
      ).resolves.toBeDefined();
    });

    it("quitar la fecha de aviso quita también «con hora»", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", createdBy: "u1" });
      const res = await notes.update(TENANT, personal, "n1", {
        remindAt: null,
        remindHasTime: true,
      });
      expect(res.data).toMatchObject({ remindAt: null, remindHasTime: false });
    });
  });

  describe("hecha", () => {
    it("guarda quién y cuándo", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", doneAt: null });
      prisma.note.findUnique.mockResolvedValue({ id: "n1" });
      await notes.markDone(TENANT, kitchen, "n1", { byName: "Luis" });
      const call = prisma.note.updateMany.mock.calls[0][0];
      // Solo si sigue pendiente: dos «Hecha» a la vez no se pisan.
      expect(call.where).toEqual({ id: "n1", doneAt: null });
      expect(call.data).toMatchObject({ doneBy: "k1", doneByName: "Luis" });
      expect(call.data.doneAt).toBeInstanceOf(Date);
    });

    it("marcar otra vez no pisa quién la hizo", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", doneAt: new Date() });
      prisma.note.findUnique.mockResolvedValue({ id: "n1" });
      await notes.markDone(TENANT, kitchen, "n1", {});
      expect(prisma.note.update).not.toHaveBeenCalled();
    });

    it("deshacer limpia quién y cuándo", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1" });
      const res = await notes.markUndone(TENANT, personal, "n1");
      expect(res.data).toMatchObject({
        doneAt: null,
        doneBy: null,
        doneByName: null,
      });
    });
  });

  describe("borrar", () => {
    it("otra persona no puede borrar una nota ajena", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", createdBy: "u1" });
      await expect(notes.remove(TENANT, otherPerson, "n1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("gerencia y autor borran (blando, a la papelera)", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", createdBy: "u1" });
      await notes.remove(TENANT, manager, "n1");
      await notes.remove(TENANT, personal, "n1");
      expect(prisma.note.update).toHaveBeenCalledTimes(2);
      expect(prisma.note.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(
        Date,
      );
    });

    it("un dispositivo compartido con rol ADMIN no es gerencia", async () => {
      prisma.note.findFirst.mockResolvedValue({ id: "n1", createdBy: "u1" });
      await expect(
        notes.remove(TENANT, { ...kitchen, role: "ADMIN" }, "n1"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("etiquetas", () => {
    it("crea las iniciales la primera vez", async () => {
      prisma.noteTag.count.mockResolvedValue(0);
      prisma.noteTag.findMany.mockResolvedValue([]);
      await tags.list(TENANT);
      // Bajo candado por restaurante, para no duplicarlas.
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.noteTag.createMany).toHaveBeenCalledWith({
        data: INITIAL_NOTE_TAGS.map((tag, index) => ({
          tenantId: TENANT,
          name: tag.name,
          color: tag.color,
          sortOrder: index,
        })),
      });
    });

    it("si otro dispositivo las creó mientras esperaba el candado, no las repite", async () => {
      prisma.noteTag.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
      prisma.noteTag.findMany.mockResolvedValue([]);
      await tags.list(TENANT);
      expect(prisma.noteTag.createMany).not.toHaveBeenCalled();
    });

    it("reordenar exige todas las etiquetas una vez", async () => {
      prisma.noteTag.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
      await expect(
        tags.reorder(TENANT, manager, { ids: ["a"] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        tags.reorder(TENANT, manager, { ids: ["a", "a"] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("no vuelve a crearlas si gerencia las borró todas", async () => {
      prisma.noteTag.count.mockResolvedValue(5);
      prisma.noteTag.findMany.mockResolvedValue([]);
      await tags.list(TENANT);
      expect(prisma.noteTag.createMany).not.toHaveBeenCalled();
    });

    it("solo gerencia crea etiquetas", async () => {
      await expect(
        tags.create(TENANT, personal, { name: "Bodega", color: "rose" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("nombre repetido → 400", async () => {
      prisma.noteTag.findFirst.mockResolvedValue({ id: "x" });
      await expect(
        tags.create(TENANT, manager, { name: "congelador", color: "sky" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("borrar etiqueta deja sus notas sin etiqueta", async () => {
      prisma.noteTag.findFirst.mockResolvedValue({ id: "tag1" });
      await tags.remove(TENANT, manager, "tag1");
      expect(prisma.note.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, tagId: "tag1" },
        data: { tagId: null },
      });
      expect(
        prisma.noteTag.update.mock.calls[0][0].data.deletedAt,
      ).toBeInstanceOf(Date);
    });
  });

  describe("endOfTodayIn", () => {
    it("acaba a las 00:00 de mañana en Madrid (invierno, UTC+1)", () => {
      const end = endOfTodayIn(
        "Europe/Madrid",
        new Date("2026-11-08T22:30:00Z"),
      );
      expect(end.toISOString()).toBe("2026-11-08T23:00:00.000Z");
    });

    it("pasada la medianoche en Madrid ya es el día siguiente", () => {
      const end = endOfTodayIn(
        "Europe/Madrid",
        new Date("2026-11-08T23:30:00Z"),
      );
      expect(end.toISOString()).toBe("2026-11-09T23:00:00.000Z");
    });

    it("verano (UTC+2)", () => {
      const end = endOfTodayIn(
        "Europe/Madrid",
        new Date("2026-07-01T10:00:00Z"),
      );
      expect(end.toISOString()).toBe("2026-07-01T22:00:00.000Z");
    });
  });
});
