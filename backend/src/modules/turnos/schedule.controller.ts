import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { PrismaService } from "../../common/services/prisma.service";
import { CHECK_IN_MANAGER_ROLE } from "../check-in/constants/check-in-permissions";
import { CheckInManagerGuard } from "../check-in/guards/check-in-manager.guard";
import {
  CopyWeekDto,
  CreateShiftDto,
  OwnShiftsQueryDto,
  PublishWeekDto,
  SaveShiftTemplateDto,
  ScheduleQueryDto,
  UpdateShiftDto,
} from "./dto/shift.dto";
import { ShiftsService } from "./services/shifts.service";

/**
 * Planificador de turnos. Planificar es de gerencia (desde su cuenta
 * personal); cada persona solo consulta sus turnos publicados.
 */
@Controller("api/v1/turnos")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("turnos")
@RequireSection("turnos")
@Roles("VIEWER")
export class ScheduleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftsService,
  ) {}

  /** Mis turnos publicados entre dos fechas. */
  @Get("me/shifts")
  async listOwn(@Req() req: any, @Query() query: OwnShiftsQueryDto) {
    const employee = req.user.isSharedAccount
      ? null
      : await this.prisma.employee.findFirst({
          where: { tenantId: req.tenantId, userId: req.user.id },
        });
    if (!employee) {
      throw new ForbiddenException(
        "Tu cuenta no está vinculada a una ficha de empleado.",
      );
    }
    return this.shifts.listOwn(req.tenantId, employee.id, query.from, query.to);
  }

  @Get("schedule")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async getWeek(@Req() req: any, @Query() query: ScheduleQueryDto) {
    return this.shifts.getWeek(req.tenantId, query.locationId, query.weekStart);
  }

  @Post("schedule/copy-week")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async copyWeek(@Req() req: any, @Body() dto: CopyWeekDto) {
    return this.shifts.copyWeek(req.tenantId, dto);
  }

  @Post("schedule/publish")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async publish(@Req() req: any, @Body() dto: PublishWeekDto) {
    return this.shifts.publishWeek(
      req.tenantId,
      dto.locationId,
      dto.weekStart,
      {
        id: req.user.id,
        name: req.user.name,
      },
    );
  }

  @Post("shifts")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async create(@Req() req: any, @Body() dto: CreateShiftDto) {
    return this.shifts.create(req.tenantId, dto);
  }

  @Patch("shifts/:id")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shifts.update(req.tenantId, id, dto);
  }

  @Delete("shifts/:id")
  @HttpCode(204)
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async remove(@Req() req: any, @Param("id") id: string) {
    await this.shifts.remove(req.tenantId, id);
  }

  @Post("shift-templates")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async createTemplate(@Req() req: any, @Body() dto: SaveShiftTemplateDto) {
    return this.shifts.createTemplate(req.tenantId, dto);
  }

  @Patch("shift-templates/:id")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async updateTemplate(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SaveShiftTemplateDto,
  ) {
    return this.shifts.updateTemplate(req.tenantId, id, dto);
  }
}
