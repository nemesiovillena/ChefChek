import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AssistantCompletionError } from "../ai-assistant/assistant-completion.service";
import {
  BALANCE_FILE_TYPES,
  BalanceExtractionError,
  GestionBalanceImportService,
} from "./gestion-balance-import.service";
import type { BalanceTarget } from "./gestion-balance-import.util";
import { Response } from "express";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import { CuinerTenantRequiredGuard } from "../cuiner/guards/cuiner-tenant-required.guard";
import { CuinerSalesReportService } from "../cuiner/cuiner-sales-report.service";
import {
  CuinerSalesReportExportService,
  SALES_REPORT_CONTENT_TYPES,
} from "../cuiner/cuiner-sales-report-export.service";
import {
  SalesReportExportQueryDto,
  SalesReportQueryDto,
} from "../cuiner/dto/cuiner.dto";
import {
  GestionBalanceApplyDto,
  GestionCalendarDateDto,
  GestionCopyExpensesDto,
  GestionExpenseDto,
  GestionExpenseUpdateDto,
  GestionDashboardQueryDto,
  GestionRangeDto,
  GestionMenuEngineeringQueryDto,
  GestionSeedDatesDto,
  GestionYearDto,
  GestionReportExportQueryDto,
  GestionReportQueryDto,
  GestionTicketsQueryDto,
} from "./dto/gestion-query.dto";
import { GestionDashboardService } from "./gestion-dashboard.service";
import { GestionReportsService } from "./gestion-reports.service";
import { GestionSeasonalityService } from "./gestion-seasonality.service";
import { GestionResultsService, madridToday } from "./gestion-results.service";
import { GestionExpensesService } from "./gestion-expenses.service";
import {
  GestionTicketReportsService,
  TICKET_REPORT_KEYS,
} from "./gestion-ticket-reports.service";
import { GESTION_ROLES } from "./gestion-roles";
import {
  GestionProfitabilityReportsService,
  PROFITABILITY_REPORT_KEYS,
} from "./gestion-profitability-reports.service";
import { GestionTableExportService } from "./gestion-table-export.service";
import { GestionMenuEngineeringService } from "./gestion-menu-engineering.service";
import { GestionTicketsService } from "./gestion-tickets.service";
import { GESTION_CONTENT_TYPES } from "./gestion-table.types";

interface AuthedRequest {
  tenantId: string;
}

function sendFile(
  res: Response,
  buffer: Buffer,
  contentType: string,
  fileName: string,
) {
  res.set({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
  });
  res.send(buffer);
}

/**
 * Gestión: panel e informes de ventas del TPV (Cuiner). Solo lectura: no toca
 * stock ni ventas. Ve facturación, así que solo gerencia y oficina.
 */
/** El balance del gestor son 2–3 páginas; con margen para fotos. */
const MAX_BALANCE_BYTES = 15 * 1024 * 1024;
// Cada lectura es una llamada de pago a la IA.
const BALANCE_EXTRACT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@ApiTags("Gestión")
@Controller("api/v1/gestion")
@UseGuards(
  AuthGuard,
  TenantGuard,
  CuinerTenantRequiredGuard,
  RolesGuard,
  ModuleGuard,
)
@RequireModule("gestion")
@Roles(...GESTION_ROLES)
export class GestionController {
  constructor(
    private readonly dashboard: GestionDashboardService,
    private readonly reports: GestionReportsService,
    private readonly profitability: GestionProfitabilityReportsService,
    private readonly seasonality: GestionSeasonalityService,
    private readonly results: GestionResultsService,
    private readonly expenses: GestionExpensesService,
    private readonly balanceImport: GestionBalanceImportService,
    private readonly ticketReports: GestionTicketReportsService,
    private readonly tickets: GestionTicketsService,
    private readonly tableExport: GestionTableExportService,
    private readonly salesReport: CuinerSalesReportService,
    private readonly salesReportExport: CuinerSalesReportExportService,
    private readonly menuEngineering: GestionMenuEngineeringService,
  ) {}

  @Get("dashboard")
  getDashboard(
    @Req() req: AuthedRequest,
    @Query() q: GestionDashboardQueryDto,
  ) {
    return this.dashboard.build(
      req.tenantId,
      { from: q.from, to: q.to },
      q.compare ?? "year",
    );
  }

  /** Ventas por periodo y familia: el mismo informe que tenía Cuiner. */
  @Get("reports/ventas")
  salesByFamily(@Req() req: AuthedRequest, @Query() q: SalesReportQueryDto) {
    return this.salesReport.build(req.tenantId, q);
  }

  @Get("reports/ventas/export")
  async exportSalesByFamily(
    @Req() req: AuthedRequest,
    @Query() q: SalesReportExportQueryDto,
    @Res() res: Response,
  ) {
    const { format, ...query } = q;
    const report = await this.salesReport.build(req.tenantId, query);
    const buffer =
      format === "csv"
        ? this.salesReportExport.toCsv(report)
        : format === "xlsx"
          ? await this.salesReportExport.toXlsx(report)
          : await this.salesReportExport.toPdf(report);
    sendFile(
      res,
      buffer,
      SALES_REPORT_CONTENT_TYPES[format],
      this.salesReportExport.fileName(report, format),
    );
  }

  @Get("reports/:key")
  getReport(
    @Req() req: AuthedRequest,
    @Param("key") key: string,
    @Query() q: GestionReportQueryDto,
  ) {
    return this.table(req.tenantId, key, q);
  }

  @Get("reports/:key/export")
  async exportReport(
    @Req() req: AuthedRequest,
    @Param("key") key: string,
    @Query() q: GestionReportExportQueryDto,
    @Res() res: Response,
  ) {
    const { format, ...query } = q;
    const table = await this.table(req.tenantId, key, query);
    const buffer = await this.tableExport.export(table, format);
    sendFile(
      res,
      buffer,
      GESTION_CONTENT_TYPES[format],
      this.tableExport.fileName(table, format),
    );
  }

  /** Cuenta de explotación del año por meses, punto de equilibrio y avisos. */
  @Get("results")
  getResults(@Req() req: AuthedRequest, @Query() q: GestionYearDto) {
    return this.results.build(req.tenantId, q.year);
  }

  @Get("expenses")
  listExpenses(@Req() req: AuthedRequest, @Query() q: GestionYearDto) {
    return this.expenses.list(req.tenantId, q.year);
  }

  @Post("expenses")
  createExpense(@Req() req: AuthedRequest, @Body() dto: GestionExpenseDto) {
    return this.expenses.create(req.tenantId, dto);
  }

  /** Copia los gastos de un mes a otro vacío (alquiler, seguros… se repiten). */
  @Post("expenses/copy")
  copyExpenses(@Req() req: AuthedRequest, @Body() dto: GestionCopyExpensesDto) {
    return this.expenses.copyMonth(req.tenantId, dto.from, dto.to);
  }

  /**
   * Lee con IA el balance de explotación del gestor y devuelve cada cuenta
   * con su categoría propuesta. No guarda nada: se revisa y se importa aparte.
   */
  @Post("expenses/balance/extract")
  @Throttle(BALANCE_EXTRACT_THROTTLE)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_BALANCE_BYTES } }),
  )
  async extractBalance(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("No se ha subido ningún archivo");
    }
    if (!BALANCE_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        "Formato no admitido. Sube el balance en PDF (o una foto JPG/PNG).",
      );
    }
    try {
      return await this.balanceImport.extract(req.tenantId, [
        { mimeType: file.mimetype, dataBase64: file.buffer.toString("base64") },
      ]);
    } catch (error) {
      if (
        error instanceof BalanceExtractionError ||
        error instanceof AssistantCompletionError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** Importa un periodo revisado: gastos repartidos por meses según ventas. */
  @Post("expenses/balance/apply")
  applyBalance(@Req() req: AuthedRequest, @Body() dto: GestionBalanceApplyDto) {
    return this.balanceImport.apply(req.tenantId, {
      ...dto,
      accounts: dto.accounts.map((a) => ({
        ...a,
        target: a.target as BalanceTarget,
      })),
    });
  }

  @Patch("expenses/:id")
  updateExpense(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: GestionExpenseUpdateDto,
  ) {
    return this.expenses.update(req.tenantId, id, dto);
  }

  @Delete("expenses/:id")
  removeExpense(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.expenses.remove(req.tenantId, id);
  }

  /** Estacionalidad del año: calendario, mejores días, semanas y festivos. */
  @Get("seasonality")
  getSeasonality(@Req() req: AuthedRequest, @Query() q: GestionYearDto) {
    return this.seasonality.analysis(req.tenantId, q.year);
  }

  @Get("calendar-dates")
  listDates(@Req() req: AuthedRequest, @Query() q: GestionYearDto) {
    return this.seasonality.list(req.tenantId, q.year);
  }

  /** Precarga los festivos y fechas sugeridos del año (sin duplicar). */
  @Post("calendar-dates/seed")
  seedDates(@Req() req: AuthedRequest, @Body() dto: GestionSeedDatesDto) {
    return this.seasonality.seed(req.tenantId, dto.year, dto.region);
  }

  @Post("calendar-dates")
  createDate(@Req() req: AuthedRequest, @Body() dto: GestionCalendarDateDto) {
    return this.seasonality.create(req.tenantId, dto);
  }

  @Delete("calendar-dates/:id")
  removeDate(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.seasonality.remove(req.tenantId, id);
  }

  /** Rentabilidad: food cost teórico, compras, personal y prime cost. */
  @Get("profitability")
  getProfitability(@Req() req: AuthedRequest, @Query() q: GestionRangeDto) {
    return this.profitability.summary(req.tenantId, { from: q.from, to: q.to });
  }

  /** Menú engineering: matriz, 80/20, Omnes, zona gris y ratios de coste. */
  @Get("menu-engineering")
  getMenuEngineering(
    @Req() req: AuthedRequest,
    @Query() q: GestionMenuEngineeringQueryDto,
  ) {
    return this.menuEngineering.analysis(req.tenantId, q);
  }

  /** Informes de ventas o de rentabilidad, según la clave. */
  private table(tenantId: string, key: string, q: GestionReportQueryDto) {
    if ((TICKET_REPORT_KEYS as readonly string[]).includes(key)) {
      return this.ticketReports.build(tenantId, key, q);
    }
    if (key === "cuenta-explotacion" || key === "flujo-caja") {
      return this.results.table(
        tenantId,
        key,
        q.year ?? Number(madridToday().slice(0, 4)),
      );
    }
    return (PROFITABILITY_REPORT_KEYS as readonly string[]).includes(key)
      ? this.profitability.build(tenantId, key, q)
      : this.reports.build(tenantId, key, q);
  }

  @Get("tickets")
  listTickets(@Req() req: AuthedRequest, @Query() q: GestionTicketsQueryDto) {
    return this.tickets.list(
      req.tenantId,
      { from: q.from, to: q.to },
      q.page,
      q.search,
      q.pageSize,
    );
  }

  @Get("tickets/:id")
  getTicket(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.tickets.detail(req.tenantId, id);
  }
}
