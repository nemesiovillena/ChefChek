import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { IngestaService } from "./ingesta.service";
import { OcrAiService } from "./ocr-ai.service";
import { DocumentStatus } from "./dto/ingesta.dto";

export interface DocumentProcessingJob {
  documentId: string;
  tenantId: string;
  fileUrl: string;
  retryCount: number;
}

@Processor("document-processing")
export class DocumentQueueProcessor {
  private readonly logger = new Logger(DocumentQueueProcessor.name);
  private static readonly MAX_RETRIES = 3;

  constructor(
    private readonly ingestaService: IngestaService,
    private readonly ocrAiService: OcrAiService,
  ) {}

  @Process("process-document")
  async handleDocumentProcessing(job: Job<DocumentProcessingJob>) {
    const { documentId, tenantId, fileUrl } = job.data;

    this.logger.log(
      `Processing document ${documentId} for tenant ${tenantId} (attempt ${job.data.retryCount + 1})`,
    );

    try {
      // Update status to PROCESSING
      await this.ingestaService.updateDocumentStatus(
        documentId,
        DocumentStatus.PROCESSING,
      );

      // Extract text using OCR
      const { text, confidence } = await this.ocrAiService.extractText(fileUrl);

      // Process document data and extract products
      const { extractedProducts, metadata } =
        await this.ocrAiService.processDocumentData(text, tenantId);

      // Update document with OCR results
      await this.ingestaService.updateDocumentOcrData(
        documentId,
        {
          text,
          confidence,
        },
        extractedProducts,
        metadata,
      );

      // Update status to COMPLETED
      await this.ingestaService.updateDocumentStatus(
        documentId,
        DocumentStatus.COMPLETED,
      );

      // Trigger cascading cost updates
      await this.ingestaService.triggerCascadingCostUpdates(
        extractedProducts,
        tenantId,
      );

      this.logger.log(
        `Document ${documentId} processed successfully with ${extractedProducts.length} products`,
      );

      return {
        success: true,
        documentId,
        productsCount: extractedProducts.length,
        confidence,
      };
    } catch (error) {
      this.logger.error(
        `Error processing document ${documentId}: ${error.message}`,
        error.stack,
      );

      // Update status to FAILED if max retries reached
      if (job.data.retryCount >= DocumentQueueProcessor.MAX_RETRIES) {
        await this.ingestaService.updateDocumentStatus(
          documentId,
          DocumentStatus.FAILED,
        );
        await this.ingestaService.updateDocumentError(
          documentId,
          `Failed after ${DocumentQueueProcessor.MAX_RETRIES} attempts: ${error.message}`,
        );
      } else {
        // Update retry count and retry
        job.data.retryCount = job.data.retryCount + 1;
        await job.update(job.data);
      }

      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<DocumentProcessingJob>) {
    this.logger.log(
      `Job ${job.id} started processing document ${job.data.documentId}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<DocumentProcessingJob>, result: any) {
    this.logger.log(
      `Job ${job.id} completed for document ${job.data.documentId}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<DocumentProcessingJob>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for document ${job.data.documentId}: ${error.message}`,
    );
  }
}
