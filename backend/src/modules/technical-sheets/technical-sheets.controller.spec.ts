import { Test, TestingModule } from "@nestjs/testing";
import { TechnicalSheetsController } from "./technical-sheets.controller";
import { TechnicalSheetsService } from "./technical-sheets.service";
import { TemplateType } from "./dto/technical-sheets.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("TechnicalSheetsController", () => {
  let controller: TechnicalSheetsController;
  let service: TechnicalSheetsService;

  const mockService = {
    createTemplate: jest.fn(),
    getTemplates: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    generateTechnicalSheet: jest.fn(),
    generateBatch: jest.fn(),
    getDocuments: jest.fn(),
    getDocument: jest.fn(),
    deleteDocument: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TechnicalSheetsController],
      providers: [{ provide: TechnicalSheetsService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TechnicalSheetsController>(
      TechnicalSheetsController,
    );
    service = module.get<TechnicalSheetsService>(TechnicalSheetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should create a template and return result", async () => {
      const dto = {
        name: "Test Template",
        type: TemplateType.STANDARD,
        description: "Test description",
      } as any;

      mockService.createTemplate.mockResolvedValue({
        success: true,
        data: { id: "template-1", ...dto },
      });

      const result = await controller.createTemplate(mockReq, dto);

      expect(mockService.createTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Test Template");
    });
  });

  describe("getTemplates", () => {
    it("should return templates wrapped in success response", async () => {
      const templates = [
        { id: "template-1", name: "Template 1" },
        { id: "template-2", name: "Template 2" },
      ];

      mockService.getTemplates.mockResolvedValue(templates);

      const result = await controller.getTemplates(mockReq);

      expect(mockService.getTemplates).toHaveBeenCalledWith("tenant-1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getTemplate", () => {
    it("should return a single template wrapped in success response", async () => {
      const template = { id: "template-1", name: "Test Template" };

      mockService.getTemplate.mockResolvedValue(template);

      const result = await controller.getTemplate(mockReq, "template-1");

      expect(mockService.getTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "template-1",
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("template-1");
    });
  });

  describe("updateTemplate", () => {
    it("should update template and return result", async () => {
      const dto = { name: "Updated Template" };

      mockService.updateTemplate.mockResolvedValue({
        success: true,
        data: { id: "template-1", name: "Updated Template" },
      });

      const result = await controller.updateTemplate(
        mockReq,
        "template-1",
        dto,
      );

      expect(mockService.updateTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "template-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete template and return result", async () => {
      mockService.deleteTemplate.mockResolvedValue({
        success: true,
        message: "Template deleted successfully",
      });

      const result = await controller.deleteTemplate(mockReq, "template-1");

      expect(mockService.deleteTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "template-1",
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Template deleted successfully");
    });
  });

  describe("generateTechnicalSheet", () => {
    it("should generate PDF and send response", async () => {
      const dto = {
        recipeId: "recipe-1",
        templateId: "template-1",
      };

      const pdfBuffer = Buffer.from("mock-pdf-content");
      mockService.generateTechnicalSheet.mockResolvedValue(pdfBuffer);

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.generateTechnicalSheet(mockReq, dto, mockRes);

      expect(mockService.generateTechnicalSheet).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(mockRes.set).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it("should handle errors and return 500", async () => {
      const dto = {
        recipeId: "recipe-1",
        templateId: "template-1",
      };

      mockService.generateTechnicalSheet.mockRejectedValue(
        new Error("Generation failed"),
      );

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.generateTechnicalSheet(mockReq, dto, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Generation failed",
      });
    });
  });

  describe("generateBatch", () => {
    it("should generate batch PDF and send response", async () => {
      const dto = {
        recipeIds: ["recipe-1", "recipe-2"],
        templateId: "template-1",
      };

      const pdfBuffer = Buffer.from("mock-pdf-content");
      mockService.generateBatch.mockResolvedValue(pdfBuffer);

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.generateBatch(mockReq, dto, mockRes);

      expect(mockService.generateBatch).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(mockRes.set).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it("should handle errors and return 500", async () => {
      const dto = {
        recipeIds: ["recipe-1"],
        templateId: "template-1",
      };

      mockService.generateBatch.mockRejectedValue(new Error("Batch failed"));

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.generateBatch(mockReq, dto, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Batch failed",
      });
    });
  });

  describe("getDocuments", () => {
    it("should return documents wrapped in success response", async () => {
      const documents = [
        { id: "doc-1", name: "Document 1" },
        { id: "doc-2", name: "Document 2" },
      ];

      mockService.getDocuments.mockResolvedValue(documents);

      const result = await controller.getDocuments(mockReq);

      expect(mockService.getDocuments).toHaveBeenCalledWith(
        "tenant-1",
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("should pass filters to service", async () => {
      const filters = { type: "TECHNICAL_SHEET" };

      mockService.getDocuments.mockResolvedValue([]);

      await controller.getDocuments(mockReq, filters);

      expect(mockService.getDocuments).toHaveBeenCalledWith(
        "tenant-1",
        filters,
      );
    });
  });

  describe("getDocument", () => {
    it("should return a single document wrapped in success response", async () => {
      const document = { id: "doc-1", name: "Test Document" };

      mockService.getDocument.mockResolvedValue(document);

      const result = await controller.getDocument(mockReq, "doc-1");

      expect(mockService.getDocument).toHaveBeenCalledWith("tenant-1", "doc-1");
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("doc-1");
    });
  });

  describe("deleteDocument", () => {
    it("should delete document and return result", async () => {
      mockService.deleteDocument.mockResolvedValue({
        success: true,
        message: "Document deleted successfully",
      });

      const result = await controller.deleteDocument(mockReq, "doc-1");

      expect(mockService.deleteDocument).toHaveBeenCalledWith(
        "tenant-1",
        "doc-1",
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Document deleted successfully");
    });
  });

  describe("previewTechnicalSheet", () => {
    it("should generate PDF and return base64", async () => {
      const dto = {
        recipeId: "recipe-1",
        templateId: "template-1",
      };

      const pdfBuffer = Buffer.from("mock-pdf-content");
      mockService.generateTechnicalSheet.mockResolvedValue(pdfBuffer);

      const result = await controller.previewTechnicalSheet(mockReq, dto);

      expect(mockService.generateTechnicalSheet).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
      expect(result.data.base64).toBe(pdfBuffer.toString("base64"));
      expect(result.data.format).toBe("pdf");
      expect(result.data.size).toBe(pdfBuffer.length);
    });
  });
});
