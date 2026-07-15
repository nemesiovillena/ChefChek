import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MailService } from "./mail.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("MailService", () => {
  let service: MailService;

  const prismaMock = {
    configuration: { findMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };

  const tenantId = "t1";
  const ORIGINAL_KEY = process.env.CONFIG_ENCRYPTION_KEY;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.CONFIG_ENCRYPTION_KEY = "test-secret-key";
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(MailService);
  });

  afterAll(() => {
    process.env.CONFIG_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("getPublicConfig nunca expone el password (solo hasPassword)", async () => {
    prismaMock.configuration.findMany.mockResolvedValue([
      { key: "smtp.host", value: "smtp.example.com" },
      { key: "smtp.port", value: "587" },
      { key: "smtp.user", value: "user@example.com" },
      { key: "smtp.pass", value: "aa:bb:cc" },
    ]);
    const config = await service.getPublicConfig(tenantId);
    expect(config).toEqual({
      configured: true,
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "user@example.com",
      from: undefined,
      hasPassword: true,
    });
    expect(JSON.stringify(config)).not.toContain("aa:bb:cc");
  });

  it("saveConfig cifra el password (no queda en claro en la BD)", async () => {
    prismaMock.configuration.upsert.mockImplementation((args: any) => args);
    prismaMock.configuration.findMany.mockResolvedValue([]);

    await service.saveConfig(
      tenantId,
      { host: "smtp.example.com", port: 587, pass: "super-secreta" },
      "u1",
    );

    const upsertCalls = prismaMock.configuration.upsert.mock.calls.map(
      (c: any[]) => c[0],
    );
    const passCall = upsertCalls.find(
      (c: any) => c.where.tenantId_key.key === "smtp.pass",
    );
    expect(passCall).toBeDefined();
    expect(passCall.create.value).not.toContain("super-secreta");
    // Formato iv:tag:cipher en hex
    expect(passCall.create.value.split(":")).toHaveLength(3);
  });

  it("saveConfig sin pass conserva el existente (no lo borra)", async () => {
    prismaMock.configuration.upsert.mockImplementation((args: any) => args);
    prismaMock.configuration.findMany.mockResolvedValue([]);

    await service.saveConfig(
      tenantId,
      { host: "smtp.example.com", port: 587 },
      "u1",
    );

    const keys = prismaMock.configuration.upsert.mock.calls.map(
      (c: any[]) => c[0].where.tenantId_key.key,
    );
    expect(keys).not.toContain("smtp.pass");
  });

  it("sendMail sin configuración → 400 claro", async () => {
    prismaMock.configuration.findMany.mockResolvedValue([]);
    await expect(
      service.sendMail(tenantId, { to: "a@b.c", subject: "x", text: "y" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("guardar password sin CONFIG_ENCRYPTION_KEY → 400 con mensaje accionable", async () => {
    delete process.env.CONFIG_ENCRYPTION_KEY;
    await expect(
      service.saveConfig(
        tenantId,
        { host: "smtp.example.com", port: 587, pass: "x" },
        "u1",
      ),
    ).rejects.toThrow(/CONFIG_ENCRYPTION_KEY/);
  });
});
