/**
 * Interfaz para proveedores de OCR
 */
export interface IOcrService {
  /**
   * Extrae texto de una imagen
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones específicas del proveedor
   * @returns Promesa con resultado de OCR
   */
  extractText(
    fileUrl: string,
    options?: any,
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    processingTime: number;
    rawResult?: any;
  }>;

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean;

  /**
   * Retorna información del proveedor
   */
  getProviderInfo(): {
    name: string;
    version: string;
    configured: boolean;
    features: string[];
  };
}
