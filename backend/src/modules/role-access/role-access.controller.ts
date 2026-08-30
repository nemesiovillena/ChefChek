import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { RoleAccessService } from "./role-access.service";
import { UpdateRoleAccessDto } from "./dto/role-access.dto";
import { isRoleAccessRole } from "./constants/section-registry";

@Controller("api/v1/role-access")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class RoleAccessController {
  constructor(private readonly roleAccessService: RoleAccessService) {}

  /** Full config (both role columns + section list). OWNER/ADMIN only. */
  @Get()
  @Roles("ADMIN")
  async getConfig(@Req() req: any) {
    return this.roleAccessService.getRoleAccessConfig(req.tenantId);
  }

  /** Effective section map for the authenticated user. */
  @Get("me")
  async getMine(@Req() req: any) {
    const role: string = req.user?.role;
    if (!isRoleAccessRole(role)) {
      // ADMIN and above see everything; return an empty map (all allowed).
      return {};
    }
    return this.roleAccessService.getRoleSectionMap(req.tenantId, role);
  }

  /** Persist role-access changes. OWNER/ADMIN only. */
  @Put()
  @Roles("ADMIN")
  async update(@Req() req: any, @Body() dto: UpdateRoleAccessDto) {
    return this.roleAccessService.updateRoleAccess(
      req.tenantId,
      req.user.id,
      dto,
    );
  }
}
