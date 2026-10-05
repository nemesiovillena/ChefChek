import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { CHECK_IN_MANAGER_ROLE } from "./constants/check-in-permissions";
import {
  CreateEmployeeDto,
  SetEmployeePinDto,
  UpdateEmployeeDto,
} from "./dto/employee.dto";
import { EmployeesService } from "./services/employees.service";
import { EmployeePinService } from "./services/employee-pin.service";

/**
 * Fichas laborales de Check-In. Contienen DNI y nº de Seguridad Social, así
 * que todo el controlador es solo para quien gestiona el módulo.
 */
@Controller("api/v1/check-in/employees")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("check-in")
@RequireSection("check-in")
@Roles(CHECK_IN_MANAGER_ROLE)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly pins: EmployeePinService,
  ) {}

  @Get()
  async list(
    @Req() req: any,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.employees.list(req.tenantId, includeInactive === "true");
  }

  // Antes de ":id" para que no lo capture el parámetro.
  @Get("linkable-users")
  async listLinkableUsers(@Req() req: any) {
    return this.employees.listLinkableUsers(req.tenantId);
  }

  @Get(":id")
  async getOne(@Req() req: any, @Param("id") id: string) {
    return this.employees.getOne(req.tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(req.tenantId, dto);
  }

  @Patch(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(req.tenantId, id, dto);
  }

  @Put(":id/pin")
  @HttpCode(204)
  async setPin(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SetEmployeePinDto,
  ) {
    await this.pins.setPin(req.tenantId, id, dto.pin);
  }

  @Delete(":id/pin")
  @HttpCode(204)
  async clearPin(@Req() req: any, @Param("id") id: string) {
    await this.pins.clearPin(req.tenantId, id);
  }
}
