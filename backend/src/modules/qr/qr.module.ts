import { Module } from "@nestjs/common";
import { QRService } from "./qr.service";
import { QRController } from "./qr.controller";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QRController],
  providers: [QRService],
  exports: [QRService],
})
export class QRModule {}
