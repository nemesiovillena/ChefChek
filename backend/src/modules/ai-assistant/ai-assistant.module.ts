import { Module } from "@nestjs/common";
import { AiAssistantController } from "./ai-assistant.controller";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantConfigModule } from "./config/ai-assistant-config.module";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { OpenAiProviderAdapter } from "./providers/openai-provider.adapter";
import { GeminiProviderAdapter } from "./providers/gemini-provider.adapter";
import { AnthropicProviderAdapter } from "./providers/anthropic-provider.adapter";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ComprasModule } from "../compras/compras.module";
import { ProductsModule } from "../products/products.module";
import { RecipesModule } from "../recipes/recipes.module";
import { AlmacenesModule } from "../almacenes/almacenes.module";

/**
 * Asistente IA "Chefchek": consultas en lenguaje natural sobre datos del
 * tenant vía tool-calling seguro (ver plans/260826-1843-asistente-ia-chefchek).
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiAssistantConfigModule,
    ComprasModule,
    ProductsModule,
    RecipesModule,
    AlmacenesModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    ToolRegistryService,
    OpenAiProviderAdapter,
    GeminiProviderAdapter,
    AnthropicProviderAdapter,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
