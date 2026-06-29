import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("CategoriesService", () => {
  let service: CategoriesService;

  const prisma = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("throws Conflict when slug already exists for tenant+context", async () => {
      prisma.category.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        service.create("t1", {
          name: "C",
          slug: "dup",
          context: "articles",
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it("creates the category when slug is free", async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({ id: "c1" });

      const dto = { name: "C", slug: "new", context: "articles" } as any;
      const result = await service.create("t1", dto);

      expect(result).toEqual({ id: "c1" });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { ...dto, tenantId: "t1" },
      });
    });
  });

  describe("findAll", () => {
    it("returns categories without context filter", async () => {
      prisma.category.findMany.mockResolvedValue([{ id: "c1" }]);
      await service.findAll("t1");
      expect(prisma.category.findMany.mock.calls[0][0].where).toEqual({
        tenantId: "t1",
      });
    });

    it("applies context filter when provided", async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await service.findAll("t1", "recipes");
      expect(prisma.category.findMany.mock.calls[0][0].where).toEqual({
        tenantId: "t1",
        context: "recipes",
      });
    });
  });

  describe("findOne", () => {
    it("returns the category when found", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        _count: { products: 0, recipes: 0 },
      });
      await expect(service.findOne("t1", "c1")).resolves.toMatchObject({
        id: "c1",
      });
    });

    it("throws NotFound when category does not exist", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.findOne("t1", "x")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("throws NotFound when category does not exist", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(
        service.update("t1", "x", { name: "n" } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates without slug conflict check when slug is unchanged", async () => {
      prisma.category.findFirst.mockResolvedValue({ id: "c1", slug: "same" });
      prisma.category.update.mockResolvedValue({ id: "c1" });

      await service.update("t1", "c1", { slug: "same" } as any);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { slug: "same" },
      });
    });

    it("uses dto context for slug conflict check when changing slug", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        slug: "old",
        context: "articles",
      });
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.update.mockResolvedValue({ id: "c1" });

      await service.update("t1", "c1", {
        slug: "new",
        context: "recipes",
      } as any);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_context_slug: {
            tenantId: "t1",
            context: "recipes",
            slug: "new",
          },
        },
      });
    });

    it("falls back to existing context when dto omits it", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        slug: "old",
        context: "articles",
      });
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.update.mockResolvedValue({ id: "c1" });

      await service.update("t1", "c1", { slug: "new" } as any);

      expect(
        prisma.category.findUnique.mock.calls[0][0].where.tenantId_context_slug
          .context,
      ).toBe("articles");
    });

    it("throws Conflict when the new slug is taken", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        slug: "old",
        context: "articles",
      });
      prisma.category.findUnique.mockResolvedValue({ id: "other" });

      await expect(
        service.update("t1", "c1", { slug: "taken" } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    it("throws NotFound when category does not exist", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.remove("t1", "x")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws Conflict when category has products", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        _count: { products: 2, recipes: 0 },
      });
      await expect(service.remove("t1", "c1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws Conflict when category has recipes", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        _count: { products: 0, recipes: 1 },
      });
      await expect(service.remove("t1", "c1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("deletes an empty category", async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: "c1",
        _count: { products: 0, recipes: 0 },
      });
      prisma.category.delete.mockResolvedValue({ id: "c1" });

      await service.remove("t1", "c1");

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: "c1" },
      });
    });
  });

  describe("getTree", () => {
    it("returns root categories without context filter", async () => {
      prisma.category.findMany.mockResolvedValue([{ id: "c1" }]);
      await service.getTree("t1");
      expect(prisma.category.findMany.mock.calls[0][0].where).toEqual({
        tenantId: "t1",
        parentId: null,
      });
    });

    it("applies context filter when provided", async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await service.getTree("t1", "articles");
      expect(prisma.category.findMany.mock.calls[0][0].where).toEqual({
        tenantId: "t1",
        parentId: null,
        context: "articles",
      });
    });
  });
});
