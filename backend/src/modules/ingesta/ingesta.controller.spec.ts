import { Test, TestingModule } from "@nestjs/testing";
import { IngestaController } from "./ingesta.controller";
import { IngestaService } from "./ingesta.service";
import { TelegramBotService } from "./telegram-bot.service";
import { PythonOcrService } from "./python-ocr.service";
import { ProductRecognitionService } from "./product-recognition.service";
import {
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
  AssociateTelegramBotDto,
  AuthorizeTelegramUserDto,
  DocumentStatus,
  DocumentType,
} from "./dto/ingesta.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("IngestaController", () => {
  let controller: IngestaController;

  const mockIngestaService = {
    createDocument: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    getProcessingStats: jest.fn(),
    processDocument: jest.fn(),
  };

  const mockTelegramBotService = {
    handleWebhook: jest.fn(),
    associateBot: jest.fn(),
    updateBot: jest.fn(),
    getActiveBots: jest.fn(),
    authorizeUser: jest.fn(),
    getAuthorizedUsers: jest.fn(),
    revokeUser: jest.fn(),
  };

  const mockPythonOcrService = {
    processImage: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
    getProviderInfo: jest.fn().mockReturnValue({
      name: "PaddleOCR Microservice",
      version: "1.0.0",
      configured: true,
      features: [],
    }),
  };

  const mockProductRecognitionService = {
    recognizeProduct: jest.fn(),
    trainModel: jest.fn(),
    handleUnknownProduct: jest.fn(),
    validateProductForReview: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestaController],
      providers: [
        { provide: IngestaService, useValue: mockIngestaService },
        { provide: TelegramBotService, useValue: mockTelegramBotService },
        { provide: PythonOcrService, useValue: mockPythonOcrService },
        {
          provide: ProductRecognitionService,
          useValue: mockProductRecognitionService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IngestaController>(IngestaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createDocument", () => {
    it("should create a document and return success response", async () => {
      const createDto: CreateDocumentDto = {
        tenantId: "tenant-1",
        documentType: DocumentType.INVOICE,
        fileUrl: "https://example.com/file.pdf",
        source: "upload",
      };

      const mockDocument = { id: "doc-1", ...createDto };
      mockIngestaService.createDocument.mockResolvedValue({
        success: true,
        data: mockDocument,
      });

      const result = await controller.createDocument(createDto);

      expect(mockIngestaService.createDocument).toHaveBeenCalledWith(createDto);
      expect(result.success).toBe(true);
    });
  });

  describe("telegramWebhook", () => {
    it("should process telegram webhook", async () => {
      const webhookData = {
        update_id: "123",
        message: { text: "/start" },
      };
      mockTelegramBotService.handleWebhook.mockResolvedValue({ success: true });

      const result = await controller.telegramWebhook("tenant-1", webhookData);

      expect(mockTelegramBotService.handleWebhook).toHaveBeenCalledWith(
        "tenant-1",
        webhookData,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("associateBot", () => {
    it("should associate telegram bot with tenant", async () => {
      const dto: AssociateTelegramBotDto = {
        tenantId: "tenant-1",
        botToken: "token-123",
      };
      mockTelegramBotService.associateBot.mockResolvedValue({ success: true });

      const result = await controller.associateBot(dto);

      expect(mockTelegramBotService.associateBot).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe("updateBot", () => {
    it("should update bot status", async () => {
      mockTelegramBotService.updateBot.mockResolvedValue({ success: true });

      const result = await controller.updateBot("tenant-1", {
        isActive: false,
      });

      expect(mockTelegramBotService.updateBot).toHaveBeenCalledWith(
        "tenant-1",
        false,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("getActiveBots", () => {
    it("should return list of active bots", async () => {
      const mockBots = [{ id: "bot-1", isActive: true }];
      mockTelegramBotService.getActiveBots.mockResolvedValue(mockBots);

      const result = await controller.getActiveBots();

      expect(mockTelegramBotService.getActiveBots).toHaveBeenCalled();
      expect(result).toEqual(mockBots);
    });
  });

  describe("authorizeUser", () => {
    it("should authorize telegram user", async () => {
      const dto: AuthorizeTelegramUserDto = {
        tenantId: "tenant-1",
        telegramUserId: 12345,
        username: "testuser",
      };
      mockTelegramBotService.authorizeUser.mockResolvedValue({ success: true });

      const result = await controller.authorizeUser(dto);

      expect(mockTelegramBotService.authorizeUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe("getAuthorizedUsers", () => {
    it("should return authorized users for tenant", async () => {
      const mockUsers = [{ id: "user-1", telegramUserId: 12345 }];
      mockTelegramBotService.getAuthorizedUsers.mockResolvedValue(mockUsers);

      const result = await controller.getAuthorizedUsers("tenant-1");

      expect(mockTelegramBotService.getAuthorizedUsers).toHaveBeenCalledWith(
        "tenant-1",
      );
      expect(result).toEqual(mockUsers);
    });
  });

  describe("revokeUser", () => {
    it("should revoke telegram user", async () => {
      mockTelegramBotService.revokeUser.mockResolvedValue({ success: true });

      const result = await controller.revokeUser("user-1");

      expect(mockTelegramBotService.revokeUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("findAll", () => {
    it("should return all documents matching query", async () => {
      const query: DocumentQueryDto = { tenantId: "tenant-1" };
      const mockDocuments = [{ id: "doc-1" }, { id: "doc-2" }];
      mockIngestaService.findAll.mockResolvedValue({
        success: true,
        data: mockDocuments,
        count: 2,
      });

      const result = await controller.findAll(query);

      expect(mockIngestaService.findAll).toHaveBeenCalledWith(query);
      expect(result.count).toBe(2);
    });

    it("should filter documents by status", async () => {
      const query: DocumentQueryDto = {
        tenantId: "tenant-1",
        status: DocumentStatus.COMPLETED,
      };
      mockIngestaService.findAll.mockResolvedValue({ success: true, data: [] });

      await controller.findAll(query);

      expect(mockIngestaService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe("findOne", () => {
    it("should return a single document", async () => {
      const mockDocument = { id: "doc-1", tenantId: "tenant-1" };
      mockIngestaService.findOne.mockResolvedValue({
        success: true,
        data: mockDocument,
      });

      const result = await controller.findOne("doc-1", "tenant-1");

      expect(mockIngestaService.findOne).toHaveBeenCalledWith(
        "doc-1",
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });

    it("should return error when document not found", async () => {
      mockIngestaService.findOne.mockResolvedValue({
        success: false,
        error: { code: "NOT_FOUND", message: "Document not found" },
      });

      const result = await controller.findOne("doc-1", "tenant-1");

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("updateStatus", () => {
    it("should update document status", async () => {
      const updateDto: UpdateDocumentDto = { status: DocumentStatus.COMPLETED };
      const mockUpdated = { id: "doc-1", status: DocumentStatus.COMPLETED };
      mockIngestaService.updateStatus.mockResolvedValue({
        success: true,
        data: mockUpdated,
      });

      const result = await controller.updateStatus(
        "doc-1",
        updateDto,
        "tenant-1",
      );

      expect(mockIngestaService.updateStatus).toHaveBeenCalledWith(
        "doc-1",
        updateDto,
        "tenant-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getProcessingStats", () => {
    it("should return processing statistics", async () => {
      const mockStats = {
        pending: 5,
        processing: 2,
        completed: 20,
        failed: 1,
        total: 28,
      };
      mockIngestaService.getProcessingStats.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const result = await controller.getProcessingStats("tenant-1");

      expect(mockIngestaService.getProcessingStats).toHaveBeenCalledWith(
        "tenant-1",
      );
      expect(result.data).toEqual(mockStats);
    });
  });

  describe("processDocument", () => {
    it("should process document manually", async () => {
      mockIngestaService.processDocument.mockResolvedValue({
        success: true,
        message: "Document processed successfully",
        extractedProductsCount: 5,
      });

      const result = await controller.processDocument("doc-1", "tenant-1");

      expect(mockIngestaService.processDocument).toHaveBeenCalledWith("doc-1");
      expect(result.success).toBe(true);
      expect(result.extractedProductsCount).toBe(5);
    });
  });
});
