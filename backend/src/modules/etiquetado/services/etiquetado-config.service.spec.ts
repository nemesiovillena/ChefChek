import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import {
  DEFAULT_THERMAL_PROFILES,
  EtiquetadoConfigService,
} from "./etiquetado-config.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("EtiquetadoConfigService", () => {
  let service: EtiquetadoConfigService;
  const mockPrisma = {
    configuration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtiquetadoConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(EtiquetadoConfigService);
  });

  it("returns default thermal profiles when nothing is stored", async () => {
    mockPrisma.configuration.findUnique.mockResolvedValue(null);
    expect(await service.getThermalProfiles("t1")).toEqual(
      DEFAULT_THERMAL_PROFILES,
    );
  });

  it("parses stored profiles, falls back to defaults on bad JSON", async () => {
    mockPrisma.configuration.findUnique.mockResolvedValue({ value: "{bad" });
    expect(await service.getThermalProfiles("t1")).toEqual(
      DEFAULT_THERMAL_PROFILES,
    );
  });

  it("validates and clamps on save, rejects out-of-range mm", async () => {
    await expect(
      service.setThermalProfiles(
        "t1",
        [{ id: "a", name: "X", widthMm: 5, heightMm: 40 }],
        "u1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an empty profile list", async () => {
    await expect(
      service.setThermalProfiles("t1", [], "u1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists cleaned profiles", async () => {
    mockPrisma.configuration.upsert.mockResolvedValue({});
    const saved = await service.setThermalProfiles(
      "t1",
      [{ id: "rollo", name: "Mi rollo", widthMm: 57.04, heightMm: 40 }],
      "u1",
    );
    expect(saved[0].widthMm).toBe(57);
    expect(mockPrisma.configuration.upsert).toHaveBeenCalled();
  });

  describe("defaultFormat", () => {
    it("returns null when no preference is stored", async () => {
      mockPrisma.configuration.findUnique.mockResolvedValue(null);
      expect(await service.getDefaultFormat("t1")).toBeNull();
    });

    it("returns the stored preference trimmed", async () => {
      mockPrisma.configuration.findUnique.mockResolvedValue({
        value: "  a4-70x37  ",
      });
      expect(await service.getDefaultFormat("t1")).toBe("a4-70x37");
    });

    it("getConfig includes defaultFormat", async () => {
      mockPrisma.configuration.findUnique.mockImplementation(
        ({ where }: any) =>
          where.tenantId_key.key === "ETIQUETADO_DEFAULT_FORMAT"
            ? { value: "thermal:default-57x40" }
            : null,
      );
      const config = await service.getConfig("t1");
      expect(config.defaultFormat).toBe("thermal:default-57x40");
      expect(config.thermalProfiles).toEqual(DEFAULT_THERMAL_PROFILES);
    });

    it("saves a valid thermal format from the same request", async () => {
      mockPrisma.configuration.upsert.mockResolvedValue({});
      const saved = await service.setDefaultFormat(
        "t1",
        "u1",
        "thermal:rollo",
        [{ id: "rollo", name: "Rollo", widthMm: 57, heightMm: 40 }],
      );
      expect(saved).toBe("thermal:rollo");
      expect(mockPrisma.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            key: "ETIQUETADO_DEFAULT_FORMAT",
            value: "thermal:rollo",
          }),
        }),
      );
    });

    it("rejects a thermal id not in the profile list", async () => {
      await expect(
        service.setDefaultFormat("t1", "u1", "thermal:no-existe"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an unknown format string", async () => {
      await expect(
        service.setDefaultFormat("t1", "u1", "a4-99x99"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("empty string clears the preference", async () => {
      mockPrisma.configuration.deleteMany.mockResolvedValue({ count: 0 });
      expect(await service.setDefaultFormat("t1", "u1", "  ")).toBeNull();
      expect(mockPrisma.configuration.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", key: "ETIQUETADO_DEFAULT_FORMAT" },
      });
    });
  });

  describe("resolveSpec", () => {
    it("resolves an A4 built-in format", async () => {
      const spec = await service.resolveSpec("t1", "a4-70x37");
      expect(spec.kind).toBe("a4");
    });

    it("resolves a thermal profile by id", async () => {
      mockPrisma.configuration.findUnique.mockResolvedValue({
        value: JSON.stringify([
          { id: "r1", name: "R1", widthMm: 60, heightMm: 45 },
        ]),
      });
      const spec = await service.resolveSpec("t1", "thermal:r1");
      expect(spec).toMatchObject({
        kind: "thermal",
        widthMm: 60,
        heightMm: 45,
      });
    });

    it("falls back to the first thermal profile for an unknown format", async () => {
      mockPrisma.configuration.findUnique.mockResolvedValue(null);
      const spec = await service.resolveSpec("t1", "garbage");
      expect(spec).toMatchObject({ kind: "thermal", widthMm: 57 });
    });
  });
});
