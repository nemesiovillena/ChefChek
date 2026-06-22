import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import Tesseract from "tesseract.js";
import { OCRResultDto } from "../dto/google-vision.dto";
import { IOcrService } from "./ocr-service.interface";

@Injectable()
export class TesseractService implements IOcrService {
  private readonly logger = new Logger(TesseractService.name);
  private readonly DEFAULT_LANGUAGE = "spa";
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1500;

  /**
   * Extrae texto de una imagen usando Tesseract.js
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones de configuración
   * @returns Promesa con resultado de OCR
   */
  async extractText(fileUrl: string, options: any = {}): Promise<OCRResultDto> {
    const startTime = Date.now();

    try {
      // Validar input
      this.validateInput(fileUrl);

      // Configurar lenguaje
      const language = options.language || this.DEFAULT_LANGUAGE;

      // Crear worker y ejecutar OCR con retry
      const result = await this.callWithRetry(() =>
        this.performTesseractOcr(fileUrl, language),
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Tesseract OCR completed in ${processingTime}ms with confidence ${result.confidence}`,
      );

      return {
        text: result.text,
        confidence: result.confidence,
        provider: "tesseract",
        processingTime,
        rawResult: {
          textLength: result.text.length,
          workerLanguage: language,
        },
      };
    } catch (error) {
      this.logger.error(`Tesseract OCR failed: ${error.message}`);
      throw new InternalServerErrorException(
        `OCR processing failed: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return true; // Tesseract.js siempre está disponible
  }

  /**
   * Retorna información del proveedor
   */
  getProviderInfo() {
    return {
      name: "Tesseract.js",
      version: "5.0.0",
      configured: this.isConfigured(),
      features: ["TEXT_DETECTION", "MULTI_LANGUAGE"],
    };
  }

  // ========== Métodos Privados ==========

  private validateInput(fileUrl: string): void {
    if (!fileUrl || fileUrl.trim().length === 0) {
      throw new InternalServerErrorException("File URL is required");
    }
  }

  private async performTesseractOcr(
    fileUrl: string,
    language: string,
  ): Promise<{ text: string; confidence: number }> {
    const worker = await Tesseract.createWorker(language);

    try {
      const { data } = await worker.recognize(fileUrl);

      return {
        text: data.text,
        confidence: data.confidence / 100, // Convert to 0-1 range
      };
    } finally {
      await worker.terminate();
    }
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Tesseract attempt ${attempt} failed: ${error.message}`,
        );

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
