import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AbsenceStatus } from "@prisma/client";
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
  AbsenceRangeQueryDto,
  CancelAbsenceDto,
  CreateAbsenceDto,
  CreateHolidayDto,
  DecideAbsenceDto,
  SaveAbsenceTypeDto,
  SaveLeaveBalanceDto,
  YearQueryDto,
} from "./dto/absence.dto";
import { parseDate } from "./services/absence-days.util";
import { AbsenceTypesService } from "./services/absence-types.service";
import { AbsencesService } from "./services/absences.service";
import { HolidaysService } from "./services/holidays.service";
import { LeaveBalanceService } from "./services/leave-balance.service";

/**
 * Ausencias, vacaciones, bajas y festivos (módulo `turnos`).
 *
 * Rutas `me/...`: cada persona, desde su cuenta, ve y pide lo suyo; el
 * empleado sale siempre de la sesión.
 * El resto de escrituras y las vistas de equipo: solo quien gestiona, desde
 * su cuenta personal (mismo criterio que Check-In).
 */
@Controller("api/v1/turnos")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("turnos")
@RequireSection("turnos")
@Roles("VIEWER")
export class TurnosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly absences: AbsencesService,
    private readonly types: AbsenceTypesService,
    private readonly balances: LeaveBalanceService,
    private readonly holidays: HolidaysService,
  ) {}

  // ─────────────────────────────────────────── Catálogos (lectura para todos)

  @Get("absence-types")
  async listTypes(@Req() req: any, @Query("all") all?: string) {
    return this.types.list(req.tenantId, all === "true");
  }

  @Get("holidays")
  async listHolidays(@Req() req: any, @Query() query: YearQueryDto) {
    return this.holidays.list(
      req.tenantId,
      new Date(Date.UTC(query.year, 0, 1)),
      new Date(Date.UTC(query.year, 11, 31)),
    );
  }

  // ───────────────────────────────────────────────────────────────── Lo mío

  @Get("me/absences")
  async listOwn(@Req() req: any, @Query() query: YearQueryDto) {
    const employee = await this.ownEmployee(req);
    return this.absences.list(req.tenantId, {
      employeeId: employee.id,
      from: new Date(Date.UTC(query.year, 0, 1)),
      to: new Date(Date.UTC(query.year, 11, 31)),
    });
  }

  @Get("me/balance")
  async getOwnBalance(@Req() req: any, @Query() query: YearQueryDto) {
    const employee = await this.ownEmployee(req);
    return this.balances.forEmployee(req.tenantId, employee.id, query.year);
  }

  @Post("me/absences")
  async requestAbsence(@Req() req: any, @Body() dto: CreateAbsenceDto) {
    const employee = await this.ownEmployee(req);
    return this.absences.request(req.tenantId, employee, dto, actorOf(req));
  }

  /** Retirar una solicitud propia que aún no tiene respuesta. */
  @Post("me/absences/:id/cancel")
  async cancelOwn(@Req() req: any, @Param("id") id: string) {
    const employee = await this.ownEmployee(req);
    return this.absences.cancel(req.tenantId, id, actorOf(req), {
      ownEmployeeId: employee.id,
    });
  }

  // ─────────────────────────────────────────────────────────────── Gerencia

  /** Ausencias del equipo que pisan un rango (calendario). */
  @Get("absences")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async listTeam(@Req() req: any, @Query() query: AbsenceRangeQueryDto) {
    return this.absences.list(req.tenantId, {
      from: parseDate(query.from),
      to: parseDate(query.to),
      statuses: [AbsenceStatus.PENDING, AbsenceStatus.APPROVED],
    });
  }

  @Get("absences/pending")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async listPending(@Req() req: any) {
    return this.absences.listPending(req.tenantId);
  }

  /** Ausencia registrada por gerencia (p. ej. una baja): queda aprobada. */
  @Post("absences")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async createAbsence(@Req() req: any, @Body() dto: CreateAbsenceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId ?? "", tenantId: req.tenantId },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return this.absences.createApproved(
      req.tenantId,
      employee,
      dto,
      actorOf(req),
    );
  }

  @Post("absences/:id/decision")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async decide(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: DecideAbsenceDto,
  ) {
    return this.absences.decide(
      req.tenantId,
      id,
      dto.approve,
      dto.note,
      actorOf(req),
    );
  }

  @Post("absences/:id/cancel")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async cancel(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CancelAbsenceDto,
  ) {
    return this.absences.cancel(req.tenantId, id, actorOf(req), {
      note: dto.note,
    });
  }

  @Get("balances")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async listBalances(@Req() req: any, @Query() query: YearQueryDto) {
    return this.balances.forAll(req.tenantId, query.year);
  }

  @Put("balances/:employeeId/:year")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async saveBalance(
    @Req() req: any,
    @Param("employeeId") employeeId: string,
    @Param("year", ParseIntPipe) year: number,
    @Body() dto: SaveLeaveBalanceDto,
  ) {
    return this.balances.save(req.tenantId, employeeId, year, dto);
  }

  @Post("absence-types")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async createType(@Req() req: any, @Body() dto: SaveAbsenceTypeDto) {
    return this.types.create(req.tenantId, dto);
  }

  @Patch("absence-types/:id")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async updateType(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SaveAbsenceTypeDto,
  ) {
    return this.types.update(req.tenantId, id, dto);
  }

  @Post("holidays")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async createHoliday(@Req() req: any, @Body() dto: CreateHolidayDto) {
    return this.holidays.create(req.tenantId, dto);
  }

  @Delete("holidays/:id")
  @HttpCode(204)
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async removeHoliday(@Req() req: any, @Param("id") id: string) {
    await this.holidays.remove(req.tenantId, id);
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
