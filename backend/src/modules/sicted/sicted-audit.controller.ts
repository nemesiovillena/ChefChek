import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { SictedPlanPdfService } from "./services/sicted-plan-pdf.service";
import { SictedRegistrosPdfService } from "./services/sicted-registros-pdf.service";
import { SictedMantenimientoPdfService } from "./services/sicted-mantenimiento-pdf.service";
import { SictedAuditCsvService } from "./services/sicted-audit-csv.service";
import { SictedCoverageService } from "./services/sicted-coverage.service";

/** Pack de auditoría (fase 5): PDFs deterministas, CSV, panel de cobertura. Todo lectura, filtrado por `usedByModules` incluye "sicted". */
@Controller("api/v1/sicted/audit")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedAuditController {
  constructor(
    private readonly planPdf: SictedPlanPdfService,
    private readonly registrosPdf: SictedRegistrosPdfService,
    private readonly mantenimientoPdf: SictedMantenimientoPdfService,
    private readonly csv: SictedAuditCsvService,
    private readonly coverage: SictedCoverageService,
  ) {}

  @Get("plan.pdf")
  @Roles("USER")
  async planPdfEndpoint(
    @Req() req: any,
    @Res() res: Response,
    @Query("area") area?: string,
  ) {
    const buffer = await this.planPdf.generate(req.tenantId, area);
    this.sendPdf(res, buffer, `plan-sicted${area ? `-${area}` : ""}.pdf`);
  }

  @Get("registros.pdf")
  @Roles("USER")
  async registrosPdfEndpoint(
    @Req() req: any,
    @Res() res: Response,
    @Query("templateId") templateId?: string,
    @Query("month") month?: string,
  ) {
    if (!templateId || !month) {
      throw new BadRequestException(
        "templateId y month (YYYY-MM) son obligatorios",
      );
    }
    const buffer = await this.registrosPdf.generate(
      req.tenantId,
      templateId,
      month,
    );
    this.sendPdf(res, buffer, `registros-${month}.pdf`);
  }

  @Get("mantenimiento.pdf")
  @Roles("USER")
  async mantenimientoPdfEndpoint(
    @Req() req: any,
    @Res() res: Response,
    @Query("year") yearParam?: string,
  ) {
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isInteger(year)) {
      throw new BadRequestException("year inválido");
    }
    const buffer = await this.mantenimientoPdf.generate(req.tenantId, year);
    this.sendPdf(res, buffer, `mantenimiento-${year}.pdf`);
  }

  @Get("registros.csv")
  @Roles("USER")
  async csvEndpoint(
    @Req() req: any,
    @Res() res: Response,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
  ) {
    const { from, to } = this.parseRange(fromParam, toParam);
    const csv = await this.csv.generate(req.tenantId, from, to);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registros-sicted.csv"`,
    });
    res.send(csv);
  }

  @Get("coverage")
  @Roles("USER")
  async coverageEndpoint(
    @Req() req: any,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
  ) {
    const { from, to } = this.parseRange(fromParam, toParam);
    const data = await this.coverage.coverage(req.tenantId, from, to);
    return { success: true, data };
  }

  private parseRange(
    fromParam?: string,
    toParam?: string,
  ): { from: Date; to: Date } {
    if (!fromParam || !toParam) {
      throw new BadRequestException("from y to (ISO) son obligatorios");
    }
    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to
    ) {
      throw new BadRequestException("Rango de fechas inválido");
    }
    return { from, to };
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string): void {
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
