import { Module } from "@nestjs/common";
import { QRService } from "./qr.service";
import { QRController } from "./qr.controller";
import { PrismaModule } from "../../common/services/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [QRController],
  providers: [QRService],
  exports: [QRService],
})
export class QRModule {}
