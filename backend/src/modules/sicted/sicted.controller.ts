import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";

/**
 * Punto de entrada del módulo SICTED. Fase 1 solo prueba el andamiaje
 * (activación por tenant + sección); el dominio real (plantillas, hojas,
 * marcas del motor `checklists`, y el resto de fases 6-9) llega en fases
 * posteriores.
 */
@Controller("api/v1/sicted")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedController {
  /** Temporal: prueba que el guard stack (módulo + sección) funciona. */
  @Get("ping")
  ping() {
    return { success: true, data: { module: "sicted", status: "ok" } };
  }
}
