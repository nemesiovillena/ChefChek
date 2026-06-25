import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { IOcrService } from "./services/ocr-service.interface";

@Injectable()
export class PythonOcrService implements IOcrService {
  private readonly logger = new Logger(PythonOcrService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly ocrServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.ocrServiceUrl = this.configService.get<string>(
      "OCR_SERVICE_URL",
      "http://localhost:8000",
    );

    this.axiosInstance = axios.create({
      baseURL: this.ocrServiceUrl,
      timeout: 30000, // 30 segundos
    });

    this.logger.log(`Python OCR Service inicializado: ${this.ocrServiceUrl}`);
  }

  /**
   * Extrae texto de un documento usando el microservicio Python
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones específicas del proveedor
   * @returns Promesa con resultado de OCR con datos estructurados
   */
  async extractText(
    fileUrl: string,
    options?: any,
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    processingTime: number;
    rawResult?: any;
  }> {
    const startTime = Date.now();

    try {
      let formData: FormData;
      let endpoint: string;

      // Determinar si es base64, URL o Buffer
      if (options?.fileBuffer) {
        // Buffer directo (upload)
        formData = new FormData();
        const { fileBuffer, filename, mimetype } = options;
        formData.append(
          "file",
          new Blob([new Uint8Array(fileBuffer)], { type: mimetype || "image/jpeg" }),
          filename,
        );
        endpoint = mimetype === "application/pdf" ? "/ocr/pdf" : "/ocr/image";
      } else if (this.isBase64(fileUrl)) {
        // Base64 string
        const base64Data = fileUrl.replace(/^data:.*,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        formData = new FormData();
        formData.append(
          "file",
          new Blob([buffer], { type: "image/jpeg" }),
          "image.jpg",
        );
        endpoint = "/ocr/image";
      } else {
        // URL remota
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        formData = new FormData();
        formData.append(
          "file",
          new Blob([buffer], { type: "image/jpeg" }),
          "image.jpg",
        );
        endpoint = "/ocr/image";
      }

      formData.append("enable_preprocessing", "true");
      formData.append("enable_validation", "true");

      this.logger.log(`Enviando a microservicio: ${endpoint}`);

      const axiosResponse = await this.axiosInstance.post(endpoint, formData, {
        headers: {
          // Axios deja que FormData establezca el Content-Type
        },
      });

      const result = axiosResponse.data;
      const processingTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || "OCR processing failed");
      }

      this.logger.log(
        `✅ OCR completado: ${result.document?.products?.length || 0} productos, confianza=${
          result.document?.confidence?.toFixed(2)
        }`,
      );

      return {
        text: result.document?.raw_text || "",
        confidence: result.document?.confidence || 0,
        provider: "paddleocr-microservice",
        processingTime,
        rawResult: {
          document: result.document,
          validation: result.validation,
          metadata: result.metadata,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando OCR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean {
    return !!this.ocrServiceUrl;
  }

  /**
   * Verifica si una cadena es base64
   */
  private isBase64(str: string): boolean {
    return (
      /^data:image\/[a-z]+;base64,/.test(str) ||
      (/^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0)
    );
  }

  /**
   * Retorna información del proveedor
   */
  getProviderInfo() {
    return {
      name: "PaddleOCR Microservice",
      version: "1.0.0",
      configured: this.isConfigured(),
      features: [
        "TEXT_DETECTION",
        "DOCUMENT_PROCESSING",
        "PRODUCT_EXTRACTION",
        "CIF_NIF_DETECTION",
        "HEIC_SUPPORT",
      ],
    };
  }

  /**
   * Procesa una imagen con OCR usando el microservicio Python
   * @param fileBuffer Buffer del archivo
   * @param filename Nombre del archivo
   * @param mimetype MIME type del archivo
   * @returns Resultado del OCR con productos estructurados
   */
  async processImage(
    fileBuffer: Buffer,
    filename: string,
    mimetype: string = "image/jpeg",
    aiModel?: string,
    aiApiKey?: string,
  ): Promise<{
    success: boolean;
    document: any;
    validation: any;
    processingTime: number;
    error?: string;
    metadata: any;
  }> {
    const startTime = Date.now();
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], { type: mimetype || "image/jpeg" }),
      filename,
    );
    formData.append("enable_preprocessing", "true");
    formData.append("enable_validation", "true");

    // Pasar modelo IA y API key si están disponibles
    if (aiModel) {
      formData.append("ai_model", aiModel);
      this.logger.log(`Usando modelo IA para extracción: ${aiModel}`);
    }
    if (aiApiKey) {
      formData.append("ai_api_key", aiApiKey);
    }

    try {
      this.logger.log(
        `Procesando imagen: ${filename} (${fileBuffer.length} bytes, MIME: ${mimetype})`,
      );

      // Usar endpoint correcto según el tipo de archivo
      const endpoint = mimetype === "application/pdf" ? "/ocr/pdf" : "/ocr/image";

      const response = await this.axiosInstance.post(endpoint, formData, {
        headers: {},
      });

      const result = response.data;

      this.logger.log(
        `✅ OCR completado: ${result.success ? "EXITOSO" : "FALLO"}`,
      );

      if (result.success) {
        this.logger.log(
          `📊 Documento: proveedor="${result.document?.supplier_name}", ` +
            `productos=${result.document?.products?.length || 0}, ` +
            `confianza=${result.document?.confidence?.toFixed(2)}`,
        );

        if (result.validation) {
          this.logger.log(
            `🔍 Validación: ${result.validation.is_valid ? "VÁLIDO" : "INVÁLIDO"}, ` +
              `acción=${result.validation.recommended_action}`,
          );
        }
      }

      return {
        ...result,
        processingTime: Date.now() - startTime,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando imagen: ${error.message}`);

      return {
        success: false,
        document: null,
        validation: null,
        processingTime: Date.now() - startTime,
        error: error.message,
        metadata: {
          filename,
          mimetype,
          fileSize: fileBuffer.length,
        },
      };
    }
  }

  /**
   * Procesa un PDF con OCR usando el microservicio Python
   * @param fileBuffer Buffer del archivo PDF
   * @param filename Nombre del archivo
   * @returns Resultado del OCR
   */
  async processPdf(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<any> {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" }), filename);
    formData.append("enable_preprocessing", "true");
    formData.append("enable_validation", "true");

    try {
      this.logger.log(`Procesando PDF: ${filename} (${fileBuffer.length} bytes)`);

      const response = await this.axiosInstance.post("/ocr/pdf", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const result = response.data;

      this.logger.log(
        `✅ PDF procesado: ${result.success ? "EXITOSO" : "FALLO"}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(`❌ Error procesando PDF: ${error.message}`);

      return {
        success: false,
        document: null,
        validation: null,
        processingTime: 0,
        error: error.message,
        metadata: {
          filename,
          fileSize: fileBuffer.length,
        },
      };
    }
  }

  /**
   * Refina la extracción OCR usando hints de layout del proveedor.
   * Llama al endpoint /ocr/refine del microservicio Python.
   */
  async refineExtraction(
    ocrText: string,
    supplierHints: any,
    aiModel?: string,
    aiApiKey?: string,
  ): Promise<{
    success: boolean;
    document: any;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Refinando OCR con hints de proveedor: ${supplierHints?.supplierName || "desconocido"}`,
      );

      const response = await this.axiosInstance.post("/ocr/refine", {
        ocr_text: ocrText,
        supplier_hints: supplierHints,
        ai_model: aiModel || "gemini-2.0-flash",
        ai_api_key: aiApiKey,
      });

      const result = response.data;
      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(
          `✅ Refinamiento OK: ${result.document?.products?.length || 0} productos en ${processingTime}ms`,
        );
      }

      return {
        success: result.success,
        document: result.document,
        processingTime,
        error: result.error,
      };
    } catch (error: any) {
      this.logger.warn(`⚠️ Refinamiento falló (no crítico): ${error.message}`);
      return {
        success: false,
        document: null,
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Verifica el estado del servicio OCR
   * @returns Estado del servicio
   */
  async healthCheck(): Promise<{
    status: string;
    version: string;
    uptime: number;
    dependencies: any;
  }> {
    try {
      const response = await this.axiosInstance.get("/health");
      return response.data;
    } catch (error: any) {
      this.logger.error(`Health check falló: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene la configuración actual del servicio
   * @returns Configuración del servicio
   */
  async getConfig(): Promise<any> {
    try {
      const response = await this.axiosInstance.get("/config");
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error obteniendo config: ${error.message}`);
      throw error;
    }
  }
}