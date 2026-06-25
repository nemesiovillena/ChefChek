import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { IngestaService } from "./ingesta.service";
import { TelegramBotService } from "./telegram-bot.service";
import { PythonOcrService } from "./python-ocr.service";
import { OcrAiService } from "./ocr-ai.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { DocumentQueueProcessor } from "./document-queue.processor";
import { IngestaController } from "./ingesta.controller";
import { TesseractService } from "./services/tesseract.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { CoreModule } from "../core/core.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    forwardRef(() => AuthModule),
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
    TesseractService,
    {
      provide: "PRIMARY_OCR_SERVICE",
      useExisting: PythonOcrService, // ✅ Microservicio Python como principal
    },
    {
      provide: "FALLBACK_OCR_SERVICE",
      useExisting: TesseractService, // Fallback (si está disponible)
    },
    IngestaService,
    TelegramBotService,
    PythonOcrService,
    OcrAiService,
    ProductRecognitionService,
    DocumentQueueProcessor,
  ],
  exports: [
    IngestaService,
    TelegramBotService,
    PythonOcrService,
    OcrAiService,
    ProductRecognitionService,
  ],
})
export class IngestaModule {}
