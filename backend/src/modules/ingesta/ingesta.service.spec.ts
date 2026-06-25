import { Test, TestingModule } from "@nestjs/testing";
import { IngestaService } from "./ingesta.service";
import { PrismaService } from "../../common/services/prisma.service";
import { TelegramBotService } from "./telegram-bot.service";
import { OcrAiService } from "./ocr-ai.service";
import { NotificationsService } from "../core/notifications.service";
import { DocumentStatus, DocumentType } from "./dto/ingesta.dto";
import { Queue } from "bull";

describe("IngestaService", () => {
  let service: IngestaService;
  let prismaService: any;
  let telegramBotService: any;
  let ocrAiService: any;
  let notificationsService: any;
  let documentQueue: any;

  const mockPrismaService = {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    product: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockTelegramBotService = {
    sendMessage: jest.fn(),
  };

  const mockOcrAiService = {
    extractText: jest.fn(),
    processDocumentData: jest.fn(),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockDocumentQueue = {
    add: jest.fn(),
  };

  const tenantId = "tenant-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestaService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TelegramBotService,
          useValue: mockTelegramBotService,
        },
        {
          provide: OcrAiService,
          useValue: mockOcrAiService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: "BullQueue_document-processing",
          useValue: mockDocumentQueue,
        },
      ],
    }).compile();

    service = module.get<IngestaService>(IngestaService);
    prismaService = mockPrismaService;
    telegramBotService = mockTelegramBotService;
    ocrAiService = mockOcrAiService;
    notificationsService = mockNotificationsService;
    documentQueue = mockDocumentQueue;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createDocument", () => {
    it("should create document and enqueue for processing", async () => {
      const createDto = {
        tenantId,
        documentType: DocumentType.INVOICE,
        fileUrl: "https://example.com/invoice.pdf",
        fileName: "invoice-001.pdf",
        source: "upload",
      };

      const mockDocument = {
        id: "doc-1",
        tenantId,
        type: DocumentType.INVOICE,
        name: "invoice-001.pdf",
        status: DocumentStatus.PENDING,
        url: createDto.fileUrl,
        createdAt: new Date(),
      };

      prismaService.document.create.mockResolvedValue(mockDocument);
      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      documentQueue.add.mockResolvedValue({ id: "job-1" });

      const result = await service.createDocument(createDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDocument);
      expect(result.message).toBe("Document created and queued for processing");
      expect(prismaService.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            type: DocumentType.INVOICE,
            url: createDto.fileUrl,
            status: DocumentStatus.PENDING,
          }),
        }),
      );
      expect(documentQueue.add).toHaveBeenCalledWith(
        "process-document",
        expect.objectContaining({
          documentId: "doc-1",
          tenantId,
        }),
        expect.any(Object),
      );
    });

    it("should create document with extracted products", async () => {
      const createDto = {
        tenantId,
        documentType: DocumentType.INVOICE,
        fileUrl: "https://example.com/invoice.pdf",
        source: "telegram",
        extractedProducts: [
          {
            name: "Tomate",
            quantity: 10,
            unitPrice: 2.5,
          },
        ],
      };

      const mockDocument = {
        id: "doc-2",
        tenantId,
        type: DocumentType.INVOICE,
        status: DocumentStatus.PENDING,
      };

      prismaService.document.create.mockResolvedValue(mockDocument);
      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      documentQueue.add.mockResolvedValue({ id: "job-2" });

      const result = await service.createDocument(createDto);

      expect(result.success).toBe(true);
      expect(prismaService.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedProducts: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  name: "Tomate",
                  quantity: 10,
                  unitPrice: 2.5,
                }),
              ]),
            },
          }),
        }),
      );
    });

    it("should handle creation error", async () => {
      const createDto = {
        tenantId,
        documentType: DocumentType.INVOICE,
        fileUrl: "https://example.com/invoice.pdf",
        source: "upload",
      };

      const error = new Error("Database error");
      prismaService.document.create.mockRejectedValue(error);

      await expect(service.createDocument(createDto)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("findAll", () => {
    it("should return all documents for tenant", async () => {
      const mockDocuments = [
        {
          id: "doc-1",
          tenantId,
          type: DocumentType.INVOICE,
          status: DocumentStatus.COMPLETED,
          extractedProducts: [],
        },
        {
          id: "doc-2",
          tenantId,
          type: DocumentType.ORDER_CONFIRMATION,
          status: DocumentStatus.PENDING,
          extractedProducts: [],
        },
      ];

      prismaService.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.findAll({ tenantId });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          include: { extractedProducts: true },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should filter by document type", async () => {
      prismaService.document.findMany.mockResolvedValue([]);

      await service.findAll({
        tenantId,
        documentType: DocumentType.INVOICE,
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            type: DocumentType.INVOICE,
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      prismaService.document.findMany.mockResolvedValue([]);

      await service.findAll({
        tenantId,
        status: DocumentStatus.COMPLETED,
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: DocumentStatus.COMPLETED,
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      prismaService.document.findMany.mockResolvedValue([]);

      const startDate = "2024-01-01";
      const endDate = "2024-12-31";

      await service.findAll({
        tenantId,
        startDate,
        endDate,
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        }),
      );
    });

    it("should filter by start date only", async () => {
      prismaService.document.findMany.mockResolvedValue([]);

      await service.findAll({
        tenantId,
        startDate: "2024-01-01",
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date("2024-01-01"),
            },
          }),
        }),
      );
    });

    it("should filter by end date only", async () => {
      prismaService.document.findMany.mockResolvedValue([]);

      await service.findAll({
        tenantId,
        endDate: "2024-12-31",
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              lte: new Date("2024-12-31"),
            },
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return document by id", async () => {
      const mockDocument = {
        id: "doc-1",
        tenantId,
        type: DocumentType.INVOICE,
        status: DocumentStatus.COMPLETED,
        extractedProducts: [],
      };

      prismaService.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.findOne("doc-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDocument);
      expect(prismaService.document.findFirst).toHaveBeenCalledWith({
        where: { id: "doc-1", tenantId },
        include: { extractedProducts: true },
      });
    });

    it("should return error when document not found", async () => {
      prismaService.document.findFirst.mockResolvedValue(null);

      const result = await service.findOne("nonexistent", tenantId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("Document not found");
    });
  });

  describe("updateStatus", () => {
    it("should update document status", async () => {
      const existingDocument = {
        id: "doc-1",
        tenantId,
        status: DocumentStatus.PENDING,
      };

      const updateDto = {
        status: DocumentStatus.COMPLETED,
      };

      const updatedDocument = {
        ...existingDocument,
        status: DocumentStatus.COMPLETED,
      };

      prismaService.document.findFirst.mockResolvedValue(existingDocument);
      prismaService.document.update.mockResolvedValue(updatedDocument);

      const result = await service.updateStatus("doc-1", updateDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(DocumentStatus.COMPLETED);
      expect(result.message).toBe("Document updated successfully");
    });

    it("should update with OCR and AI data", async () => {
      const existingDocument = {
        id: "doc-1",
        tenantId,
        status: DocumentStatus.PROCESSING,
      };

      const updateDto = {
        status: DocumentStatus.COMPLETED,
        ocrData: { text: "extracted text", confidence: 0.95 },
        aiData: { products: [] },
      };

      prismaService.document.findFirst.mockResolvedValue(existingDocument);
      prismaService.document.update.mockResolvedValue({
        ...existingDocument,
        ...updateDto,
      });

      const result = await service.updateStatus("doc-1", updateDto, tenantId);

      expect(result.success).toBe(true);
      expect(prismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ocrData: updateDto.ocrData,
            aiData: updateDto.aiData,
          }),
        }),
      );
    });

    it("should update extracted products", async () => {
      const existingDocument = {
        id: "doc-1",
        tenantId,
        status: DocumentStatus.PROCESSING,
      };

      const updateDto = {
        status: DocumentStatus.COMPLETED,
        extractedProducts: [
          { name: "Product 1", quantity: 5, unitPrice: 10 },
          { name: "Product 2", quantity: 3, unitPrice: 15 },
        ],
      };

      prismaService.document.findFirst.mockResolvedValue(existingDocument);
      prismaService.document.update.mockResolvedValue(existingDocument);

      const result = await service.updateStatus("doc-1", updateDto, tenantId);

      expect(result.success).toBe(true);
      expect(prismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedProducts: {
              deleteMany: {},
              create: expect.arrayContaining([
                expect.objectContaining({ name: "Product 1" }),
                expect.objectContaining({ name: "Product 2" }),
              ]),
            },
          }),
        }),
      );
    });

    it("should return error when updating nonexistent document", async () => {
      prismaService.document.findFirst.mockResolvedValue(null);

      const result = await service.updateStatus(
        "nonexistent",
        { status: DocumentStatus.COMPLETED },
        tenantId,
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("should trigger cascading costs when completed with products", async () => {
      const existingDocument = {
        id: "doc-1",
        tenantId,
        status: DocumentStatus.PROCESSING,
      };

      const updateDto = {
        status: DocumentStatus.COMPLETED,
        extractedProducts: [{ name: "Tomate", quantity: 10, unitPrice: 2.5 }],
      };

      prismaService.document.findFirst.mockResolvedValue(existingDocument);
      prismaService.document.update.mockResolvedValue(existingDocument);
      prismaService.product.findFirst.mockResolvedValue(null);
      prismaService.category.findFirst.mockResolvedValue(null);
      prismaService.category.create.mockResolvedValue({ id: "cat-1" });
      prismaService.supplier.findFirst.mockResolvedValue(null);
      prismaService.product.create.mockResolvedValue({ id: "prod-1" });

      await service.updateStatus("doc-1", updateDto, tenantId);

      expect(prismaService.product.findFirst).toHaveBeenCalled();
    });

    it("should handle update error", async () => {
      const existingDocument = {
        id: "doc-1",
        tenantId,
        status: DocumentStatus.PENDING,
      };

      prismaService.document.findFirst.mockResolvedValue(existingDocument);
      const error = new Error("Update failed");
      prismaService.document.update.mockRejectedValue(error);

      await expect(
        service.updateStatus(
          "doc-1",
          { status: DocumentStatus.COMPLETED },
          tenantId,
        ),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("processDocument", () => {
    it("should process document successfully", async () => {
      const mockDocument = {
        id: "doc-1",
        tenantId,
        fileUrl: "https://example.com/doc.pdf",
        status: DocumentStatus.PENDING,
      };

      const ocrResult = {
        text: "Invoice content...",
        confidence: 0.95,
      };

      const aiResult = {
        extractedProducts: [
          { name: "Product A", quantity: 10, unitPrice: 5.0 },
        ],
      };

      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      prismaService.document.update
        .mockResolvedValue({
          ...mockDocument,
          status: DocumentStatus.PROCESSING,
        })
        .mockResolvedValue({
          ...mockDocument,
          status: DocumentStatus.COMPLETED,
        });
      ocrAiService.extractText.mockResolvedValue(ocrResult);
      ocrAiService.processDocumentData.mockResolvedValue(aiResult);
      prismaService.product.findFirst.mockResolvedValue(null);
      prismaService.category.findFirst.mockResolvedValue(null);
      prismaService.product.create.mockResolvedValue({ id: "prod-1" });

      const result = await service.processDocument("doc-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document processed successfully");
      expect(result.extractedProductsCount).toBe(1);
      expect(ocrAiService.extractText).toHaveBeenCalledWith(
        mockDocument.fileUrl,
      );
      expect(ocrAiService.processDocumentData).toHaveBeenCalledWith(
        ocrResult.text,
        tenantId,
        ocrResult,
      );
    });

    it("should throw error if document not found", async () => {
      prismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.processDocument("nonexistent")).rejects.toThrow(
        "Document not found",
      );
    });

    it("should update status to PROCESSING on start", async () => {
      const mockDocument = {
        id: "doc-1",
        tenantId,
        fileUrl: "https://example.com/doc.pdf",
      };

      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({});
      ocrAiService.extractText.mockRejectedValue(new Error("OCR failed"));

      await expect(service.processDocument("doc-1")).rejects.toThrow();

      expect(prismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: DocumentStatus.PROCESSING },
        }),
      );
    });

    it("should set status to FAILED on error", async () => {
      const mockDocument = {
        id: "doc-1",
        tenantId,
        fileUrl: "https://example.com/doc.pdf",
      };

      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({});
      ocrAiService.extractText.mockRejectedValue(new Error("OCR failed"));

      await expect(service.processDocument("doc-1")).rejects.toThrow(
        "OCR failed",
      );

      expect(prismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: DocumentStatus.FAILED,
            errorMessage: "OCR failed",
          },
        }),
      );
    });

    it("should trigger cascading cost updates after processing", async () => {
      const mockDocument = {
        id: "doc-1",
        tenantId,
        fileUrl: "https://example.com/doc.pdf",
      };

      const aiResult = {
        extractedProducts: [
          { name: "Product A", quantity: 10, unitPrice: 5.0 },
        ],
      };

      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({});
      ocrAiService.extractText.mockResolvedValue({
        text: "content",
        confidence: 0.9,
      });
      ocrAiService.processDocumentData.mockResolvedValue(aiResult);
      prismaService.product.findFirst.mockResolvedValue(null);
      prismaService.category.findFirst.mockResolvedValue(null);
      prismaService.product.create.mockResolvedValue({ id: "prod-1" });

      await service.processDocument("doc-1");

      expect(prismaService.product.findFirst).toHaveBeenCalled();
    });
  });

  describe("getProcessingStats", () => {
    it("should return processing statistics", async () => {
      prismaService.document.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2) // processing
        .mockResolvedValueOnce(20) // completed
        .mockResolvedValueOnce(3); // failed

      const result = await service.getProcessingStats(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        pending: 5,
        processing: 2,
        completed: 20,
        failed: 3,
        total: 30,
      }));
    });

    it("should return zero stats when no documents", async () => {
      prismaService.document.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getProcessingStats(tenantId);

      expect(result.data.total).toBe(0);
    });
  });

  describe("updateDocumentStatus", () => {
    it("should update document status", async () => {
      const mockDocument = {
        id: "doc-1",
        status: DocumentStatus.COMPLETED,
      };

      prismaService.document.update.mockResolvedValue(mockDocument);

      const result = await service.updateDocumentStatus(
        "doc-1",
        DocumentStatus.COMPLETED,
      );

      expect(result.status).toBe(DocumentStatus.COMPLETED);
      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { status: DocumentStatus.COMPLETED },
      });
    });
  });

  describe("updateDocumentOcrData", () => {
    it("should update OCR data and extracted products", async () => {
      const mockDocument = {
        id: "doc-1",
        ocrData: { text: "content", confidence: 0.95 },
      };

      const ocrData = { text: "extracted text", confidence: 0.95 };
      const extractedProducts = [{ name: "Product", quantity: 5 }];
      const metadata = { pages: 3 };

      prismaService.document.update.mockResolvedValue(mockDocument);

      const result = await service.updateDocumentOcrData(
        "doc-1",
        ocrData,
        extractedProducts,
        metadata,
      );

      expect(result).toEqual(mockDocument);
      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          ocrData: ocrData,
          aiData: {
            extractedProducts,
            metadata,
          },
        },
      });
    });
  });

  describe("updateDocumentError", () => {
    it("should update document error message", async () => {
      const mockDocument = {
        id: "doc-1",
        errorMessage: "Processing failed",
      };

      prismaService.document.update.mockResolvedValue(mockDocument);

      const result = await service.updateDocumentError(
        "doc-1",
        "Processing failed",
      );

      expect(result.errorMessage).toBe("Processing failed");
      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { errorMessage: "Processing failed" },
      });
    });
  });

  describe("triggerCascadingCostUpdates", () => {
    it("should update existing product price", async () => {
      const existingProduct = {
        id: "prod-1",
        name: "Tomate",
        netPrice: 2.0,
      };

      const extractedProducts = [
        {
          name: "Tomate",
          quantity: 10,
          unitPrice: 2.5,
        },
      ];

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        netPrice: 2.5,
      });

      await service.triggerCascadingCostUpdates(extractedProducts, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { netPrice: 2.5 },
      });
    });

    it("should notify on significant price change (>10%)", async () => {
      const existingProduct = {
        id: "prod-1",
        name: "Tomate",
        netPrice: 2.0,
      };

      const extractedProducts = [
        {
          name: "Tomate",
          unitPrice: 2.5, // 25% increase - exactly at threshold for WARNING
        },
      ];

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        netPrice: 2.5,
      });

      await service.triggerCascadingCostUpdates(extractedProducts, tenantId);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          type: "WARNING",
          title: expect.stringContaining("Tomate"),
        }),
      );
    });

    it("should create error notification on very high price change (>25%)", async () => {
      const existingProduct = {
        id: "prod-1",
        name: "Tomate",
        netPrice: 2.0,
      };

      const extractedProducts = [
        {
          name: "Tomate",
          unitPrice: 3.5, // 75% increase
        },
      ];

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        netPrice: 3.5,
      });

      await service.triggerCascadingCostUpdates(extractedProducts, tenantId);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          type: "ERROR",
        }),
      );
    });

    it("should create new product when not exists", async () => {
      const extractedProducts = [
        {
          name: "New Product",
          description: "A new product",
          quantity: 5,
          unit: "kg",
          unitPrice: 10.0,
          category: "Vegetables",
          supplier: "Supplier A",
          allergens: ["Gluten"],
        },
      ];

      prismaService.product.findFirst.mockResolvedValue(null);
      prismaService.category.findFirst.mockResolvedValue(null);
      prismaService.category.create.mockResolvedValue({
        id: "cat-1",
        name: "Vegetables",
      });
      prismaService.supplier.findFirst.mockResolvedValue(null);
      prismaService.supplier.create.mockResolvedValue({
        id: "supp-1",
        name: "Supplier A",
      });
      prismaService.product.create.mockResolvedValue({
        id: "prod-new",
        name: "New Product",
      });

      await service.triggerCascadingCostUpdates(extractedProducts, tenantId);

      expect(prismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            name: "New Product",
            netPrice: 10.0,
          }),
        }),
      );
    });

    it("should not create product without price", async () => {
      const extractedProducts = [
        {
          name: "Incomplete Product",
          quantity: 5,
          // no unitPrice
        },
      ];

      prismaService.product.findFirst.mockResolvedValue(null);

      await service.triggerCascadingCostUpdates(extractedProducts, tenantId);

      expect(prismaService.product.create).not.toHaveBeenCalled();
    });

    it("should handle cascading update errors gracefully", async () => {
      const extractedProducts = [
        {
          name: "Product",
          unitPrice: 10.0,
        },
      ];

      prismaService.product.findFirst.mockRejectedValue(new Error("DB error"));

      // Should not throw - cascading updates should not fail main flow
      await expect(
        service.triggerCascadingCostUpdates(extractedProducts, tenantId),
      ).resolves.not.toThrow();
    });
  });
});
