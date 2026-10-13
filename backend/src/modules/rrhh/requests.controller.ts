import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { CHECK_IN_MANAGER_ROLE } from "../check-in/constants/check-in-permissions";
import { CheckInManagerGuard } from "../check-in/guards/check-in-manager.guard";
import { DecideEmployeeRequestDto } from "./dto/employee-request.dto";
import { EmployeeRequestsService } from "./services/employee-requests.service";

/** Bandeja de gerencia: cambios de datos y peticiones libres del equipo. */
@Controller("api/v1/rrhh/requests")
@UseGuards(
  AuthGuard,
  TenantGuard,
  RolesGuard,
  ModuleGuard,
  SectionAccessGuard,
  CheckInManagerGuard,
)
@RequireModule("rrhh")
@RequireSection("rrhh")
@Roles(CHECK_IN_MANAGER_ROLE)
export class RequestsController {
  constructor(private readonly requests: EmployeeRequestsService) {}

  /** Pendientes por defecto; `?all=true` trae también las ya respondidas. */
  @Get()
  async list(@Req() req: any, @Query("all") all?: string) {
    return this.requests.listForManagers(req.tenantId, all !== "true");
  }

  @Post(":id/decision")
  async decide(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: DecideEmployeeRequestDto,
  ) {
    return this.requests.decide(req.tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
    });
  }
}
