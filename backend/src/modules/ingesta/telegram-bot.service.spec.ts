import { Test, TestingModule } from "@nestjs/testing";
import { TelegramBotService } from "./telegram-bot.service";
import { PrismaService } from "../../common/services/prisma.service";
import { Telegraf } from "telegraf";

// Mock Telegraf
jest.mock("telegraf", () => {
  return {
    Telegraf: jest.fn().mockImplementation(() => ({
      telegram: {
        setWebhook: jest.fn().mockResolvedValue(true),
        getFileLink: jest.fn().mockResolvedValue({
          href: "https://api.telegram.org/file/test.jpg",
        }),
        sendMessage: jest.fn().mockResolvedValue(true),
      },
      handleUpdate: jest.fn(),
      stop: jest.fn(),
    })),
  };
});

describe("TelegramBotService", () => {
  let service: TelegramBotService;
  let mockPrismaService: any;

  const mockBot = {
    id: "bot-id-1",
    tenantId: "tenant-1",
    botToken: "test-token",
    webhookUrl: "https://example.com/webhook",
    isActive: true,
    environment: "development",
  };

  const mockTelegramUser = {
    id: "user-id-1",
    tenantId: "tenant-1",
    telegramBotId: "bot-id-1",
    telegramUserId: BigInt(123456789),
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    isActive: true,
  };

  beforeEach(async () => {
    mockPrismaService = {
      telegramBot: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(mockBot),
        findFirst: jest.fn().mockResolvedValue(mockBot),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      telegramUser: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockTelegramUser),
        update: jest.fn().mockResolvedValue(mockTelegramUser),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramBotService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TelegramBotService>(TelegramBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should initialize service and load active bots", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      await service.onModuleInit();

      expect(mockPrismaService.telegramBot.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it("should handle errors when loading bots", async () => {
      const error = new Error("Database error");
      mockPrismaService.telegramBot.findMany.mockRejectedValueOnce(error);

      await expect(service.onModuleInit()).rejects.toThrow("Database error");
    });
  });

  describe("onModuleDestroy", () => {
    it("should stop all bots and clear the map", async () => {
      await service.onModuleDestroy();
      // Verify bots map is cleared
      expect(await service.getBotByTenant("tenant-1")).toBeNull();
    });
  });

  describe("associateBot", () => {
    const dto = {
      tenantId: "tenant-1",
      botToken: "test-token",
      webhookUrl: "https://example.com/webhook",
      isActive: true,
      environment: "production",
    };

    it("should successfully associate a bot", async () => {
      mockPrismaService.telegramBot.create.mockResolvedValue(mockBot);

      const result = await service.associateBot(dto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBot);
      expect(result.message).toBe("Telegram bot associated successfully");
    });

    it("should create bot with default values", async () => {
      const dtoWithoutDefaults = {
        tenantId: "tenant-1",
        botToken: "test-token",
      };

      mockPrismaService.telegramBot.create.mockResolvedValue(mockBot);

      const result = await service.associateBot(dtoWithoutDefaults as any);

      expect(result.success).toBe(true);
    });

    it("should throw error on database failure", async () => {
      const error = new Error("Database error");
      mockPrismaService.telegramBot.create.mockRejectedValueOnce(error);

      await expect(service.associateBot(dto)).rejects.toThrow("Database error");
    });

    it("should not activate bot if isActive is false", async () => {
      const inactiveDto = { ...dto, isActive: false };
      mockPrismaService.telegramBot.create.mockResolvedValue({
        ...mockBot,
        isActive: false,
      });

      const result = await service.associateBot(inactiveDto);

      expect(result.success).toBe(true);
    });
  });

  describe("handleWebhook", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("should return error if no bot found for tenant", async () => {
      const result = (await service.handleWebhook("unknown-tenant", {})) as any;

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NO_BOT");
    });

    it("should process webhook without message", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const result = await service.handleWebhook("tenant-1", {
        update_id: "123",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook processed (no message)");
    });

    it("should process photo message", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          photo: [{ file_id: "photo123" }],
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.data.documentType).toBe("RECEIPT");
    });

    it("should process document message with pedido in filename", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          document: { file_id: "doc123", file_name: "pedido_2024.pdf" },
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.data.documentType).toBe("ORDER_CONFIRMATION");
    });

    it("should process document message with catálogo in filename", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          document: { file_id: "doc123", file_name: "catálogo_productos.pdf" },
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.data.documentType).toBe("PRODUCT_CATALOG");
    });

    it("should process document message with nota in filename", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          document: { file_id: "doc123", file_name: "nota_entrega.pdf" },
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(true);
      expect((result as any).data.documentType).toBe("DELIVERY_NOTE");
    });

    it("should process document message as invoice by default", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          document: { file_id: "doc123", file_name: "factura.pdf" },
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.data.documentType).toBe("INVOICE");
    });

    it("should handle /start command for authorized user", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/start",
        },
      };

      const result = await service.handleWebhook("tenant-1", webhookData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Bienvenido");
    });

    it("should handle /ingest command", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/ingest",
        },
      };

      const result = await service.handleWebhook("tenant-1", webhookData);

      expect(result.success).toBe(true);
    });

    it("should handle /status command", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/status",
        },
      };

      const result = await service.handleWebhook("tenant-1", webhookData);

      expect(result.success).toBe(true);
    });

    it("should handle /help command", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/help",
        },
      };

      const result = await service.handleWebhook("tenant-1", webhookData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Comandos disponibles");
    });

    it("should handle unknown command", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(
        mockTelegramUser,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/unknown",
        },
      };

      const result = await service.handleWebhook("tenant-1", webhookData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("no reconocido");
    });

    it("should reject unauthorized user for commands", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 999999 },
          text: "/start",
        },
      };

      const result = (await service.handleWebhook(
        "tenant-1",
        webhookData,
      )) as any;

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe("UNAUTHORIZED");
    });

    it("should throw error on webhook processing failure", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      service = module.get<TelegramBotService>(TelegramBotService);
      await service.onModuleInit();

      // Force an error by making handleUpdate throw
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockTelegraf = require("telegraf").Telegraf;
      mockTelegraf.mockImplementationOnce(() => ({
        telegram: {
          setWebhook: jest.fn().mockResolvedValue(true),
          getFileLink: jest
            .fn()
            .mockResolvedValue({ href: "https://test.com/file.jpg" }),
          sendMessage: jest.fn().mockResolvedValue(true),
        },
        handleUpdate: jest.fn().mockImplementation(() => {
          throw new Error("Webhook error");
        }),
        stop: jest.fn(),
      }));

      // Create a new service instance with the failing mock
      const failingModule: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramBotService,
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      const failingService =
        failingModule.get<TelegramBotService>(TelegramBotService);
      await failingService.onModuleInit();

      const webhookData = {
        message: {
          chat: { id: 12345 },
          from: { id: 123456789 },
          text: "/start",
        },
      };

      // This should throw or handle the error gracefully
      await expect(
        failingService.handleWebhook("tenant-1", webhookData),
      ).rejects.toThrow();
    });
  });

  describe("authorizeUser", () => {
    const dto = {
      tenantId: "tenant-1",
      telegramUserId: 123456789,
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      userId: "user-1",
    };

    it("should successfully authorize a new user", async () => {
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(null);
      mockPrismaService.telegramUser.create.mockResolvedValue(mockTelegramUser);

      const result = await service.authorizeUser(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Telegram user authorized successfully");
    });

    it("should reactivate existing user", async () => {
      const existingUser = { ...mockTelegramUser, isActive: false };
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findFirst.mockResolvedValue(existingUser);
      mockPrismaService.telegramUser.update.mockResolvedValue({
        ...existingUser,
        isActive: true,
      });

      const result = await service.authorizeUser(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Telegram user reactivated");
    });

    it("should return error if no bot found", async () => {
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(null);

      const result = await service.authorizeUser(dto);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NO_BOT");
    });

    it("should throw error on database failure", async () => {
      mockPrismaService.telegramBot.findFirst.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await expect(service.authorizeUser(dto)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getAuthorizedUsers", () => {
    it("should return empty list if no bot found", async () => {
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(null);

      const result = await service.getAuthorizedUsers("tenant-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("should return list of authorized users", async () => {
      mockPrismaService.telegramBot.findFirst.mockResolvedValue(mockBot);
      mockPrismaService.telegramUser.findMany.mockResolvedValue([
        mockTelegramUser,
      ]);

      const result = await service.getAuthorizedUsers("tenant-1");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(1);
    });
  });

  describe("revokeUser", () => {
    it("should successfully revoke user", async () => {
      mockPrismaService.telegramUser.update.mockResolvedValue({
        ...mockTelegramUser,
        isActive: false,
      });

      const result = await service.revokeUser("user-id-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Telegram user revoked");
    });
  });

  describe("sendMessage", () => {
    beforeEach(async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);
      await service.onModuleInit();
    });

    it("should return undefined if no bot found", async () => {
      const result = await service.sendMessage(
        "unknown-tenant",
        "12345",
        "Test message",
      );
      expect(result).toBeUndefined();
    });

    it("should send message successfully", async () => {
      // The bot should be loaded from onModuleInit
      await expect(
        service.sendMessage("tenant-1", "12345", "Test message"),
      ).resolves.not.toThrow();
    });
  });

  describe("getBotByTenant", () => {
    it("should return null for unknown tenant", async () => {
      const result = await service.getBotByTenant("unknown-tenant");
      expect(result).toBeNull();
    });
  });

  describe("getActiveBots", () => {
    it("should return list of active bots", async () => {
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const result = await service.getActiveBots();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(1);
    });
  });

  describe("updateBot", () => {
    it("should activate a bot", async () => {
      mockPrismaService.telegramBot.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.telegramBot.findMany.mockResolvedValue([mockBot]);

      const result = await service.updateBot("tenant-1", true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("activated");
    });

    it("should deactivate a bot", async () => {
      mockPrismaService.telegramBot.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateBot("tenant-1", false);

      expect(result.success).toBe(true);
      expect(result.message).toContain("deactivated");
    });
  });
});
