import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
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
import { CheckInManagerGuard } from "./guards/check-in-manager.guard";
import { CreateInspectionLinkDto, ReportQueryDto } from "./dto/report.dto";
import { InspectionLinksService } from "./services/inspection-links.service";
import { IntegrityService } from "./services/integrity.service";
import { ReportExportService } from "./services/report-export.service";
import { ReportService } from "./services/report.service";
import { sendWorkdayReport } from "./services/report-file.util";

/**
 * Informes del registro de jornada, verificación de integridad y enlaces para
 * la Inspección. Solo quien gestiona el módulo, desde su cuenta personal.
 */
@Controller("api/v1/check-in")
@UseGuards(
  AuthGuard,
  TenantGuard,
  RolesGuard,
  ModuleGuard,
  SectionAccessGuard,
  CheckInManagerGuard,
)
@RequireModule("check-in")
@RequireSection("check-in")
@Roles(CHECK_IN_MANAGER_ROLE)
export class ReportsController {
  constructor(
    private readonly reports: ReportService,
    private readonly exporter: ReportExportService,
    private readonly integrity: IntegrityService,
    private readonly links: InspectionLinksService,
  ) {}

  /** Registro de jornada de un mes: de una persona o de todo el equipo. */
  @Get("reports/workdays")
  async downloadWorkdays(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    await sendWorkdayReport(
      res,
      {
        reports: this.reports,
        exporter: this.exporter,
        integrity: this.integrity,
      },
      { tenantId: req.tenantId, ...query },
    );
  }

  /** Recorre la cadena de huellas de los fichajes y dice si está íntegra. */
  @Get("reports/integrity")
  async verifyIntegrity(@Req() req: any) {
    return this.integrity.verify(req.tenantId);
  }

  @Get("inspection-links")
  async listLinks(@Req() req: any) {
    return this.links.list(req.tenantId);
  }

  /** Crea un enlace; el token solo se devuelve en esta respuesta. */
  @Post("inspection-links")
  async createLink(@Req() req: any, @Body() dto: CreateInspectionLinkDto) {
    return this.links.create(req.tenantId, dto, {
      id: req.user.id,
      name: req.user.name,
    });
  }

  @Post("inspection-links/:id/revoke")
  async revokeLink(@Req() req: any, @Param("id") id: string) {
    return this.links.revoke(req.tenantId, id);
  }
}
