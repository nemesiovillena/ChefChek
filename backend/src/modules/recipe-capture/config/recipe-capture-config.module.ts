import { Module } from "@nestjs/common";
import { RecipeCaptureConfigController } from "./recipe-capture-config.controller";
import { RecipeCaptureConfigService } from "./recipe-capture-config.service";
import { PrismaModule } from "../../../common/services/prisma.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RecipeCaptureConfigController],
  providers: [RecipeCaptureConfigService],
  exports: [RecipeCaptureConfigService],
})
export class RecipeCaptureConfigModule {}
