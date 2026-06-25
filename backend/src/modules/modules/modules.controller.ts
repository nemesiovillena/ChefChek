import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ModulesService } from "./modules.service";
import { UpdateModuleDto } from "./dto/module.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";

@Controller("api/v1/modules")
@UseGuards(AuthGuard, TenantGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /**
   * Get all modules with their activation states.
   */
  @Get()
  async getModules(@Req() req: any) {
    const tenantId = req.tenantId;
    return await this.modulesService.getModules(tenantId);
  }

  /**
   * Toggle a module's activation state.
   */
  @Patch(":id")
  async toggleModule(
    @Param("id") id: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return await this.modulesService.toggleModule(tenantId, id, dto, userId);
  }
}
