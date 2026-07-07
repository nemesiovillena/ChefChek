import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { CostingConfigService } from "./costing-config.service";
import { UpdateCostingConfigDto } from "./dto/costing-config.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

@Controller("api/v1/costing-config")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class CostingConfigController {
  constructor(private readonly costingConfigService: CostingConfigService) {}

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  async getConfig(@Req() req: any) {
    const data = await this.costingConfigService.getConfig(req.tenantId);
    return { success: true, data };
  }

  @Patch()
  @Roles("ADMIN")
  async updateConfig(@Req() req: any, @Body() dto: UpdateCostingConfigDto) {
    const data = await this.costingConfigService.updateConfig(
      req.tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data };
  }
}
