import { Module } from "@nestjs/common";
import { PythonOcrService } from "./python-ocr.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { PrismaModule } from "../../common/services/prisma.module";

/**
 * Módulo OCR compartido.
 * Contiene el cliente del microservicio Python (PaddleOCR) y el reconocedor
 * de productos por nombre. Consumido principalmente por el módulo `albaranes`.
 *
 * Sustituye al pipeline paralelo `ingesta` (eliminado): sólo sobrevive aquí
 * lo que Albaranes realmente usa.
 */
@Module({
  imports: [PrismaModule],
  providers: [PythonOcrService, ProductRecognitionService],
  exports: [PythonOcrService, ProductRecognitionService],
})
export class OcrModule {}
