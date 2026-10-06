import {
  Body,
  Controller,
  ForbiddenException,
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
import { PrismaService } from "../../common/services/prisma.service";
import { CHECK_IN_MANAGER_ROLE } from "./constants/check-in-permissions";
import { CheckInManagerGuard } from "./guards/check-in-manager.guard";
import {
  ApproveTimesheetDto,
  CreateAdjustmentDto,
  DecideAdjustmentDto,
  EmployeeMonthQueryDto,
  MonthQueryDto,
  WorkdaysQueryDto,
} from "./dto/workday.dto";
import { AdjustmentsService } from "./services/adjustments.service";
import { TimesheetsService } from "./services/timesheets.service";
import { WorkdaysService, fullName } from "./services/workdays.service";

/**
 * Registro de jornada, correcciones y hojas de horas.
 *
 * Rutas `me/...`: cada persona ve y gestiona lo suyo desde su cuenta; el
 * empleado sale siempre de la sesión, nunca de un parámetro.
 * El resto: solo quien gestiona el módulo, desde su cuenta personal.
 */
@Controller("api/v1/check-in")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("check-in")
@RequireSection("check-in")
@Roles("VIEWER")
export class WorkdaysController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
    private readonly adjustments: AdjustmentsService,
    private readonly timesheets: TimesheetsService,
  ) {}

  // ───────────────────────────────────────────────────────── Lo mío

  @Get("me/workdays")
  async getOwnWorkdays(@Req() req: any, @Query() query: WorkdaysQueryDto) {
    const employee = await this.ownEmployee(req);
    return this.workdays.getWorkdays(
      req.tenantId,
      employee.id,
      query.from,
      query.to,
    );
  }

  @Get("me/adjustments")
  async listOwnAdjustments(@Req() req: any) {
    const employee = await this.ownEmployee(req);
    return this.adjustments.list(req.tenantId, { employeeId: employee.id });
  }

  @Post("me/adjustments")
  async requestAdjustment(@Req() req: any, @Body() dto: CreateAdjustmentDto) {
    const employee = await this.ownEmployee(req);
    return this.adjustments.request(
      req.tenantId,
      { id: employee.id, name: fullName(employee) },
      dto,
      actorOf(req),
    );
  }

  @Get("me/timesheet")
  async getOwnTimesheet(@Req() req: any, @Query() query: MonthQueryDto) {
    const employee = await this.ownEmployee(req);
    return this.timesheets.getState(
      req.tenantId,
      employee.id,
      query.year,
      query.month,
    );
  }

  @Post("me/timesheet/ack")
  async ackOwnTimesheet(@Req() req: any, @Body() dto: MonthQueryDto) {
    const employee = await this.ownEmployee(req);
    return this.timesheets.acknowledge(
      req.tenantId,
      employee.id,
      dto.year,
      dto.month,
    );
  }

  // ─────────────────────────────────────────────────────── Gerencia

  @Get("workdays")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async getWorkdays(@Req() req: any, @Query() query: WorkdaysQueryDto) {
    return this.workdays.getWorkdays(
      req.tenantId,
      query.employeeId ?? "",
      query.from,
      query.to,
    );
  }

  @Get("adjustments")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async listAdjustments(
    @Req() req: any,
    @Query("pending") pending?: string,
    @Query("employeeId") employeeId?: string,
  ) {
    return this.adjustments.list(req.tenantId, {
      employeeId: employeeId || undefined,
      onlyPending: pending === "true",
    });
  }

  /** Corrección hecha por gerencia: queda aprobada, con su motivo y su autor. */
  @Post("adjustments")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async createAdjustment(@Req() req: any, @Body() dto: CreateAdjustmentDto) {
    const employee = await this.workdays.findEmployee(
      req.tenantId,
      dto.employeeId ?? "",
    );
    return this.adjustments.createApproved(
      req.tenantId,
      { id: employee.id, name: fullName(employee) },
      dto,
      actorOf(req),
    );
  }

  @Post("adjustments/:id/decision")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async decideAdjustment(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: DecideAdjustmentDto,
  ) {
    return this.adjustments.decide(
      req.tenantId,
      id,
      dto.approve,
      dto.note,
      actorOf(req),
    );
  }

  @Get("timesheets")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async listTimesheets(@Req() req: any, @Query() query: MonthQueryDto) {
    return this.timesheets.listMonth(req.tenantId, query.year, query.month);
  }

  /** Mes de una persona: jornadas, totales, hoja aprobada y conformidad. */
  @Get("timesheets/employee")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async getEmployeeTimesheet(
    @Req() req: any,
    @Query() query: EmployeeMonthQueryDto,
  ) {
    return this.timesheets.getState(
      req.tenantId,
      query.employeeId,
      query.year,
      query.month,
    );
  }

  @Post("timesheets/approve")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async approveTimesheet(@Req() req: any, @Body() dto: ApproveTimesheetDto) {
    return this.timesheets.approve(
      req.tenantId,
      dto.employeeId,
      dto.year,
      dto.month,
      actorOf(req),
      dto.reopenReason,
    );
  }

  /** Ficha del dueño de la sesión; las cuentas compartidas no tienen. */
  private async ownEmployee(req: any) {
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
    return employee;
  }
}

function actorOf(req: any) {
  return { id: req.user.id, name: req.user.name };
}
