import { Module } from "@nestjs/common";
import { SictedController } from "./sicted.controller";
import { SictedChecklistController } from "./sicted-checklist.controller";
import { ChecklistsModule } from "../checklists/checklists.module";
import { AuthModule } from "../auth/auth.module";

/**
 * Módulo SICTED (Sostenibilidad, Inteligencia y Calidad Turística en el
 * Ecosistema del Destino). Independiente de `appcc`: activación propia vía
 * `@RequireModule("sicted")`, sin tocar el módulo `appcc` existente.
 *
 * El motor de checklist compartido (limpieza, mantenimiento, temperatura,
 * averías) vive en `ChecklistsModule`, importado aquí; este módulo consume
 * ese dominio filtrando siempre por `usedByModules` incluyendo `"sicted"`.
 */
@Module({
  imports: [ChecklistsModule, AuthModule],
  controllers: [SictedController, SictedChecklistController],
  providers: [],
  exports: [],
})
export class SictedModule {}
