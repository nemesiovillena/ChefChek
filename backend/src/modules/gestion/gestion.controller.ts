import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
  GestionDashboardQueryDto,
  GestionReportExportQueryDto,
  GestionReportQueryDto,
  GestionTicketsQueryDto,
} from "./dto/gestion-query.dto";
import { GestionDashboardService } from "./gestion-dashboard.service";
import { GestionReportsService } from "./gestion-reports.service";
import { GestionTableExportService } from "./gestion-table-export.service";
import { GestionTicketsService } from "./gestion-tickets.service";
import { GESTION_CONTENT_TYPES } from "./gestion-table.types";

/** Gerencia y oficina (rol lateral GESTION). */
const GESTION_ROLES = ["ADMIN", "OWNER", "SUPERADMIN", "GESTION"] as const;

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
    private readonly tickets: GestionTicketsService,
    private readonly tableExport: GestionTableExportService,
    private readonly salesReport: CuinerSalesReportService,
    private readonly salesReportExport: CuinerSalesReportExportService,
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
    return this.reports.build(req.tenantId, key, q);
  }

  @Get("reports/:key/export")
  async exportReport(
    @Req() req: AuthedRequest,
    @Param("key") key: string,
    @Query() q: GestionReportExportQueryDto,
    @Res() res: Response,
  ) {
    const { format, ...query } = q;
    const table = await this.reports.build(req.tenantId, key, query);
    const buffer = await this.tableExport.export(table, format);
    sendFile(
      res,
      buffer,
      GESTION_CONTENT_TYPES[format],
      this.tableExport.fileName(table, format),
    );
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
