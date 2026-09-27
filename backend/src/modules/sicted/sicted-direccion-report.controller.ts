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
import { SictedAnnualReportService } from "./services/sicted-annual-report.service";
import { SictedAnnualReportPdfService } from "./services/sicted-annual-report-pdf.service";

/**
 * Fachada SICTED de Dirección — informe anual de calidad (DIR.10, fase 9,
 * sub-PR 4/4). Controlador propio, tercero bajo `api/v1/sicted/direccion`
 * junto a `SictedDireccionController` (catálogo/autoevaluación/mejora/
 * objetivos) y `SictedDireccionLegalController` (eventos/legal) — mismo
 * criterio de modularización por archivo.
 */
@Controller("api/v1/sicted/direccion")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedDireccionReportController {
  constructor(
    private readonly aggregator: SictedAnnualReportService,
    private readonly pdf: SictedAnnualReportPdfService,
  ) {}

  @Get("annual-report")
  @Roles("USER")
  async annualReport(@Req() req: any, @Query("year") yearParam?: string) {
    const year = this.parseYear(yearParam);
    const data = await this.aggregator.aggregate(req.tenantId, year);
    return { success: true, data };
  }

  @Get("annual-report.pdf")
  @Roles("USER")
  async annualReportPdf(
    @Req() req: any,
    @Res() res: Response,
    @Query("year") yearParam?: string,
  ) {
    const year = this.parseYear(yearParam);
    const buffer = await this.pdf.generate(req.tenantId, year);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-anual-sicted-${year}.pdf"`,
    });
    res.send(buffer);
  }

  private parseYear(yearParam?: string): number {
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new BadRequestException("Año inválido");
    }
    return year;
  }
}
