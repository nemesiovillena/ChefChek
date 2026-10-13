import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiAssistantModule } from "../ai-assistant/ai-assistant.module";
import { AiAssistantConfigModule } from "../ai-assistant/config/ai-assistant-config.module";
import { RecipeCaptureConfigModule } from "./config/recipe-capture-config.module";
import { RecipeCaptureCompletionService } from "./recipe-capture-completion.service";
import { ProductsModule } from "../products/products.module";
import { CaptureIngredientMatcher } from "./capture-ingredient-matcher";
import { RecipesModule } from "../recipes/recipes.module";
import { RecipeCaptureController } from "./recipe-capture.controller";
import { RecipeCapturePromotionService } from "./recipe-capture-promotion.service";
import { RecipeCaptureService } from "./recipe-capture.service";
import { RecipeStructuringService } from "./recipe-structuring.service";

/**
 * Captura de recetas: importa una receta externa (URL, texto o foto/PDF) con
 * la IA del tenant y la deja en revisión antes de pasarla a Recetas.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiAssistantModule,
    AiAssistantConfigModule,
    RecipeCaptureConfigModule,
    ProductsModule,
    RecipesModule,
  ],
  controllers: [RecipeCaptureController],
  providers: [
    RecipeCaptureService,
    RecipeCapturePromotionService,
    RecipeStructuringService,
    RecipeCaptureCompletionService,
    CaptureIngredientMatcher,
  ],
})
export class RecipeCaptureModule {}
