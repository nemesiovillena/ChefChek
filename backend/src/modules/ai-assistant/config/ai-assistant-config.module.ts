import { Module } from "@nestjs/common";
import { AiAssistantConfigController } from "./ai-assistant-config.controller";
import { AiAssistantConfigService } from "./ai-assistant-config.service";
import { PrismaModule } from "../../../common/services/prisma.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiAssistantConfigController],
  providers: [AiAssistantConfigService],
  exports: [AiAssistantConfigService],
})
export class AiAssistantConfigModule {}
