import {
  BadRequestException,
  Body,
  Controller,
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
import { SictedSupplierComplianceService } from "./services/sicted-supplier-compliance.service";
import { SictedSupplierIncidentService } from "./services/sicted-supplier-incident.service";
import { SictedInventorySnapshotService } from "./services/sicted-inventory-snapshot.service";
import { SictedProcurementEvidenceService } from "./services/sicted-procurement-evidence.service";
import { UpsertSupplierComplianceDto } from "./dto/sicted-supplier-compliance.dto";
import {
  CreateSupplierIncidentDto,
  ResolveSupplierIncidentDto,
} from "./dto/sicted-supplier-incident.dto";
import { CreateInventorySnapshotDto } from "./dto/sicted-inventory-snapshot.dto";

/**
 * Fachada SICTED de proveedores y aprovisionamiento (fase 6, módulo `PROV`):
 * perfil de cumplimiento, incidencias de recepción, sello de inventario
 * semestral y panel de evidencia. Cero escrituras en `albaranes`/`etiquetado`/
 * `almacenes`/`proveedores` — solo lectura vía los servicios inyectados.
 */
@Controller("api/v1/sicted/suppliers")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("sicted")
@RequireSection("sicted")
export class SictedSuppliersController {
  constructor(
    private readonly compliance: SictedSupplierComplianceService,
    private readonly incidents: SictedSupplierIncidentService,
    private readonly inventory: SictedInventorySnapshotService,
    private readonly evidence: SictedProcurementEvidenceService,
  ) {}

  // ────────────────────────────────────────── Perfil de cumplimiento (PROV.1)

  @Get("compliance")
  @Roles("USER")
  async listCompliance(@Req() req: any) {
    const data = await this.compliance.list(req.tenantId);
    return { success: true, data };
  }

  @Get("compliance/:supplierId")
  @Roles("USER")
  async getCompliance(
    @Req() req: any,
    @Param("supplierId") supplierId: string,
  ) {
    const data = await this.compliance.getOne(req.tenantId, supplierId);
    return { success: true, data };
  }

  @Post("compliance/:supplierId")
  @Roles("ADMIN", "OWNER")
  async upsertCompliance(
    @Req() req: any,
    @Param("supplierId") supplierId: string,
    @Body() dto: UpsertSupplierComplianceDto,
  ) {
    const data = await this.compliance.upsert(
      req.tenantId,
      supplierId,
      req.user.name,
      dto,
    );
    return { success: true, data };
  }

  // ─────────────────────────────────────────────── Incidencias de recepción (PROV.3)

  @Get("incidents")
  @Roles("USER")
  async listIncidents(
    @Req() req: any,
    @Query("supplierId") supplierId?: string,
  ) {
    const data = await this.incidents.list(req.tenantId, supplierId);
    return { success: true, data };
  }

  @Get("incidents/:id")
  @Roles("USER")
  async getIncident(@Req() req: any, @Param("id") id: string) {
    const data = await this.incidents.getOneVisible(req.tenantId, id);
    return { success: true, data };
  }

  @Post("incidents")
  @Roles("USER")
  async createIncident(
    @Req() req: any,
    @Body() dto: CreateSupplierIncidentDto,
  ) {
    const data = await this.incidents.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Post("incidents/:id/resolve")
  @Roles("USER")
  async resolveIncident(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ResolveSupplierIncidentDto,
  ) {
    const data = await this.incidents.resolve(req.tenantId, id, dto);
    return { success: true, data };
  }

  // ────────────────────────────────────────────────── Inventario semestral (PROV.7)

  @Get("inventory")
  @Roles("USER")
  async listInventory(@Req() req: any) {
    const data = await this.inventory.list(req.tenantId);
    return { success: true, data };
  }

  @Get("inventory/:id")
  @Roles("USER")
  async getInventory(@Req() req: any, @Param("id") id: string) {
    const data = await this.inventory.getOne(req.tenantId, id);
    return { success: true, data };
  }

  @Post("inventory")
  @Roles("ADMIN", "OWNER")
  async generateInventory(
    @Req() req: any,
    @Body() dto: CreateInventorySnapshotDto,
  ) {
    const data = await this.inventory.generate(req.tenantId, dto);
    return { success: true, data };
  }

  // ────────────────────────────────────────────────────── Evidencia de aprovisionamiento

  @Get("evidence")
  @Roles("USER")
  async getEvidence(
    @Req() req: any,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
  ) {
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
    const data = await this.evidence.evidence(req.tenantId, from, to);
    return { success: true, data };
  }
}
