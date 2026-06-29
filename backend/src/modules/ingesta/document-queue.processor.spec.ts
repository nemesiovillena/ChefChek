import { Test, TestingModule } from "@nestjs/testing";
import {
  DocumentQueueProcessor,
  DocumentProcessingJob,
} from "./document-queue.processor";
import { IngestaService } from "./ingesta.service";
import { OcrAiService } from "./ocr-ai.service";
import { DocumentStatus } from "./dto/ingesta.dto";
import { Job } from "bull";

describe("DocumentQueueProcessor", () => {
  let processor: DocumentQueueProcessor;
  let ingestaService: {
    updateDocumentStatus: jest.Mock;
    updateDocumentOcrData: jest.Mock;
    updateDocumentError: jest.Mock;
    triggerCascadingCostUpdates: jest.Mock;
  };
  let ocrAiService: {
    extractText: jest.Mock;
    processDocumentData: jest.Mock;
  };

  beforeEach(async () => {
    ingestaService = {
      updateDocumentStatus: jest.fn(),
      updateDocumentOcrData: jest.fn(),
      updateDocumentError: jest.fn(),
      triggerCascadingCostUpdates: jest.fn(),
    };
    ocrAiService = {
      extractText: jest.fn(),
      processDocumentData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentQueueProcessor,
        { provide: IngestaService, useValue: ingestaService },
        { provide: OcrAiService, useValue: ocrAiService },
      ],
    }).compile();

    processor = module.get<DocumentQueueProcessor>(DocumentQueueProcessor);
  });

  const buildMockJob = (data: DocumentProcessingJob) => {
    return {
      data,
      id: "job-123",
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<DocumentProcessingJob>;
  };

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  describe("handleDocumentProcessing", () => {
    it("should process document successfully, update status to COMPLETED and trigger cost updates", async () => {
      const jobData: DocumentProcessingJob = {
        documentId: "doc-1",
        tenantId: "tenant-1",
        fileUrl: "http://storage.com/invoice.png",
        retryCount: 0,
      };
      const job = buildMockJob(jobData);

      ocrAiService.extractText.mockResolvedValue({
        text: "raw-ocr-text",
        confidence: 0.95,
      });
      ocrAiService.processDocumentData.mockResolvedValue({
        extractedProducts: [{ name: "Tomate", quantity: 10, unitPrice: 1.5 }],
        metadata: { supplierName: "Proveedor Local" },
      });

      const result = await processor.handleDocumentProcessing(job);

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-1");
      expect(result.productsCount).toBe(1);
      expect(result.confidence).toBe(0.95);

      expect(ingestaService.updateDocumentStatus).toHaveBeenNthCalledWith(
        1,
        "doc-1",
        DocumentStatus.PROCESSING,
      );
      expect(ocrAiService.extractText).toHaveBeenCalledWith(
        "http://storage.com/invoice.png",
      );
      expect(ocrAiService.processDocumentData).toHaveBeenCalledWith(
        "raw-ocr-text",
        "tenant-1",
      );
      expect(ingestaService.updateDocumentOcrData).toHaveBeenCalledWith(
        "doc-1",
        { text: "raw-ocr-text", confidence: 0.95 },
        [{ name: "Tomate", quantity: 10, unitPrice: 1.5 }],
        { supplierName: "Proveedor Local" },
      );
      expect(ingestaService.updateDocumentStatus).toHaveBeenNthCalledWith(
        2,
        "doc-1",
        DocumentStatus.COMPLETED,
      );
      expect(ingestaService.triggerCascadingCostUpdates).toHaveBeenCalledWith(
        [{ name: "Tomate", quantity: 10, unitPrice: 1.5 }],
        "tenant-1",
      );
    });

    it("should increment retryCount and update job data on failure if retries are within limit", async () => {
      const jobData: DocumentProcessingJob = {
        documentId: "doc-1",
        tenantId: "tenant-1",
        fileUrl: "http://storage.com/invoice.png",
        retryCount: 1, // Menor que MAX_RETRIES (3)
      };
      const job = buildMockJob(jobData);

      ocrAiService.extractText.mockRejectedValue(new Error("OCR timeout"));

      await expect(processor.handleDocumentProcessing(job)).rejects.toThrow(
        "OCR timeout",
      );

      expect(job.data.retryCount).toBe(2);
      expect(job.update).toHaveBeenCalledWith(job.data);
      expect(ingestaService.updateDocumentStatus).not.toHaveBeenCalledWith(
        "doc-1",
        DocumentStatus.FAILED,
      );
    });

    it("should mark document as FAILED and update error msg when max retries are exceeded", async () => {
      const jobData: DocumentProcessingJob = {
        documentId: "doc-1",
        tenantId: "tenant-1",
        fileUrl: "http://storage.com/invoice.png",
        retryCount: 3, // Igual o mayor a MAX_RETRIES (3)
      };
      const job = buildMockJob(jobData);

      ocrAiService.extractText.mockRejectedValue(
        new Error("Permanent API Error"),
      );

      await expect(processor.handleDocumentProcessing(job)).rejects.toThrow(
        "Permanent API Error",
      );

      expect(ingestaService.updateDocumentStatus).toHaveBeenCalledWith(
        "doc-1",
        DocumentStatus.FAILED,
      );
      expect(ingestaService.updateDocumentError).toHaveBeenCalledWith(
        "doc-1",
        "Failed after 3 attempts: Permanent API Error",
      );
    });
  });
});
