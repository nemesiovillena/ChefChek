import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { IngestaService } from "./ingesta.service";
import { TelegramBotService } from "./telegram-bot.service";
import { OcrAiService } from "./ocr-ai.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { DocumentQueueProcessor } from "./document-queue.processor";
import { IngestaController } from "./ingesta.controller";
import { PrismaModule } from "../../common/services/prisma.module";
import { CoreModule } from "../core/core.module";
import { GoogleVisionService } from "./services/google-vision.service";
import { TesseractService } from "./services/tesseract.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "document-processing",
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        db: parseInt(process.env.REDIS_DB || "0"),
      },
    }),
    PrismaModule,
    CoreModule,
  ],
  controllers: [IngestaController],
  providers: [
    IngestaService,
    TelegramBotService,
    OcrAiService,
    ProductRecognitionService,
    DocumentQueueProcessor,
    GoogleVisionService,
    TesseractService,
    {
      provide: "PRIMARY_OCR_SERVICE",
      useFactory: (
        googleVision: GoogleVisionService,
        tesseract: TesseractService,
      ) => {
        // Usar Google Vision si está configurado, sino Tesseract
        const useGoogleVision = googleVision.isConfigured();
        const selected = useGoogleVision ? googleVision : tesseract;
        return selected;
      },
      inject: [GoogleVisionService, TesseractService],
    },
    {
      provide: "FALLBACK_OCR_SERVICE",
      useFactory: (
        googleVision: GoogleVisionService,
        tesseract: TesseractService,
      ) => {
        // Si Google Vision es primario, Tesseract es fallback
        // Si Tesseract es primario, no hay fallback (retorno null)
        return googleVision.isConfigured() ? tesseract : null;
      },
      inject: [GoogleVisionService, TesseractService],
    },
  ],
  exports: [
    IngestaService,
    TelegramBotService,
    OcrAiService,
    ProductRecognitionService,
  ],
})
export class IngestaModule {}
