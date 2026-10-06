import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { PrismaService } from "../../common/services/prisma.service";
import { ReportQueryDto } from "./dto/report.dto";
import { InspectionLinksService } from "./services/inspection-links.service";
import { IntegrityService } from "./services/integrity.service";
import { ReportExportService } from "./services/report-export.service";
import { ReportService } from "./services/report.service";
import { sendWorkdayReport } from "./services/report-file.util";

/**
 * Acceso de la Inspección de Trabajo al registro de jornada — SIN
 * autenticación. El token del enlace (256 bits aleatorios, guardado solo como
 * huella) es la única credencial: caduca, se puede revocar y cada acceso
 * queda contado. Solo lectura y limitado a los meses que cubre el enlace.
 * Deliberadamente sin guards de auth/tenant/módulo; con límite de peticiones
 * propio, más estricto que el global.
 */
@Controller("api/v1/check-in/inspection")
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class InspectionPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: InspectionLinksService,
    private readonly reports: ReportService,
    private readonly exporter: ReportExportService,
    private readonly integrity: IntegrityService,
  ) {}

  /** Qué empresa y qué meses cubre el enlace. */
  @Get(":token")
  async summary(@Param("token") token: string) {
    const link = await this.links.resolve(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: link.tenantId },
      select: { name: true, cifNif: true },
    });
    const months: { year: number; month: number }[] = [];
    for (
      let index = link.fromYear * 12 + link.fromMonth - 1;
      index <= link.toYear * 12 + link.toMonth - 1;
      index++
    ) {
      months.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
    }
    return {
      company: { name: tenant?.name ?? "", taxId: tenant?.cifNif ?? null },
      months: months.reverse(),
      expiresAt: link.expiresAt,
    };
  }

  /** Registro de jornada de todo el equipo en uno de los meses cubiertos. */
  @Get(":token/report")
  async report(
    @Param("token") token: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const link = await this.links.resolve(token);
    if (!this.links.covers(link, query.year, query.month)) {
      throw new BadRequestException("Ese mes no está incluido en este enlace.");
    }
    await sendWorkdayReport(
      res,
      {
        reports: this.reports,
        exporter: this.exporter,
        integrity: this.integrity,
      },
      {
        tenantId: link.tenantId,
        year: query.year,
        month: query.month,
        format: query.format,
        // El enlace cubre a toda la plantilla; no se acepta filtrar por persona.
      },
    );
  }
}
