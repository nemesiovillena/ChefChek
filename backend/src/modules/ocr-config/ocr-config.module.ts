import { Module } from "@nestjs/common";
import { OcrConfigController } from "./ocr-config.controller";
import { OcrConfigService } from "./ocr-config.service";
import { PrismaModule } from "../../common/services/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [OcrConfigController],
  providers: [OcrConfigService],
  exports: [OcrConfigService],
})
export class OcrConfigModule {}
