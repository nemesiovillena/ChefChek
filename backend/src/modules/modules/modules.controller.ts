import { Controller, Get, UseGuards, Req } from "@nestjs/common";
import { ModulesService } from "./modules.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";

@Controller("api/v1/modules")
@UseGuards(AuthGuard, TenantGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /** Retorna los módulos activos del tenant autenticado (solo lectura). */
  @Get()
  async getModules(@Req() req: any) {
    return await this.modulesService.getModules(req.tenantId);
  }
}
