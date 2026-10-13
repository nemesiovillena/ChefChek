import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { CreateEmployeeRequestDto } from "./dto/employee-request.dto";
import { EmployeeRequestsService } from "./services/employee-requests.service";
import { EmployeeSelfService } from "./services/employee-self.service";

/**
 * "Mi espacio": lo que cada persona ve y pide de sí misma. El empleado sale
 * siempre de la sesión; ninguna ruta acepta un id de empleado.
 */
@Controller("api/v1/rrhh/me")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("rrhh")
@RequireSection("rrhh")
@Roles("VIEWER")
export class MeController {
  constructor(
    private readonly self: EmployeeSelfService,
    private readonly requests: EmployeeRequestsService,
  ) {}

  @Get("profile")
  async getProfile(@Req() req: any) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.self.getProfile(req.tenantId, employee);
  }

  @Get("requests")
  async listRequests(@Req() req: any) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.requests.listOwn(req.tenantId, employee);
  }

  @Post("requests")
  async createRequest(@Req() req: any, @Body() dto: CreateEmployeeRequestDto) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.requests.create(req.tenantId, employee, dto);
  }

  @Post("requests/:id/cancel")
  async cancelRequest(@Req() req: any, @Param("id") id: string) {
    const employee = await this.self.resolve(req.tenantId, req.user);
    return this.requests.cancelOwn(req.tenantId, employee, id);
  }
}
