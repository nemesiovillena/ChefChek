import { Module } from "@nestjs/common";
import { DigitalMenuController } from "./digital-menu.controller";
import { DigitalMenuService } from "./digital-menu.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [DigitalMenuController],
  providers: [DigitalMenuService, PrismaService],
  exports: [DigitalMenuService],
})
export class DigitalMenuModule {}
