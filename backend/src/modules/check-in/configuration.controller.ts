import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CheckInLegalTextKind } from "@prisma/client";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { LocationsService } from "../compras/services/locations.service";
import {
  CreateLocationDto,
  UpdateLocationDto,
} from "../compras/dto/location.dto";
import { CHECK_IN_MANAGER_ROLE } from "./constants/check-in-permissions";
import {
  ApplyAgreementPresetDto,
  UpdateCheckInSettingsDto,
} from "./dto/check-in-settings.dto";
import { SaveLegalTextDto } from "./dto/legal-text.dto";
import { UpdateWorkCenterGeofenceDto } from "./dto/work-center.dto";
import { CheckInSettingsService } from "./services/check-in-settings.service";
import { LegalTextsService } from "./services/legal-texts.service";
import { WorkCentersService } from "./services/work-centers.service";

/**
 * Configuración de Check-In: convenio y jornada, centros de trabajo con su
 * geovalla y textos legales. Solo para quien gestiona el módulo, salvo
 * `readiness`, que cualquier usuario necesita para saber si puede fichar.
 */
@Controller("api/v1/check-in")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("check-in")
@RequireSection("check-in")
@Roles(CHECK_IN_MANAGER_ROLE)
export class CheckInConfigurationController {
  constructor(
    private readonly settings: CheckInSettingsService,
    private readonly legalTexts: LegalTextsService,
    private readonly workCenters: WorkCentersService,
    private readonly locations: LocationsService,
  ) {}

  // ─────────────────────────────────────────────────── Convenio y jornada

  @Get("settings")
  async getSettings(@Req() req: any) {
    return {
      settings: await this.settings.get(req.tenantId),
      presets: this.settings.listPresets(),
    };
  }

  @Patch("settings")
  async updateSettings(@Req() req: any, @Body() dto: UpdateCheckInSettingsDto) {
    return this.settings.update(req.tenantId, dto);
  }

  @Post("settings/agreement")
  async applyAgreement(@Req() req: any, @Body() dto: ApplyAgreementPresetDto) {
    return this.settings.applyPreset(req.tenantId, dto.agreementKey);
  }

  // ───────────────────────────────────────────────── Centros de trabajo

  @Get("work-centers")
  async listWorkCenters(@Req() req: any) {
    return this.locations.findAll(req.tenantId);
  }

  @Post("work-centers")
  async createWorkCenter(@Req() req: any, @Body() dto: CreateLocationDto) {
    return this.locations.create(req.tenantId, dto);
  }

  @Patch("work-centers/:id")
  async updateWorkCenter(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locations.update(req.tenantId, id, dto);
  }

  @Patch("work-centers/:id/geofence")
  async updateGeofence(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateWorkCenterGeofenceDto,
  ) {
    return this.workCenters.updateGeofence(req.tenantId, id, dto);
  }

  // ───────────────────────────────────────────────────── Textos legales

  @Get("legal-texts")
  async listLegalTexts(@Req() req: any) {
    return this.legalTexts.list(req.tenantId);
  }

  @Put("legal-texts/:kind")
  async saveLegalText(
    @Req() req: any,
    @Param("kind", new ParseEnumPipe(CheckInLegalTextKind))
    kind: CheckInLegalTextKind,
    @Body() dto: SaveLegalTextDto,
  ) {
    return this.legalTexts.save(req.tenantId, kind, dto.content, req.user.id);
  }

  @Post("legal-texts/:kind/validate")
  async validateLegalText(
    @Req() req: any,
    @Param("kind", new ParseEnumPipe(CheckInLegalTextKind))
    kind: CheckInLegalTextKind,
  ) {
    return this.legalTexts.validate(req.tenantId, kind, {
      id: req.user.id,
      name: req.user.name,
    });
  }

  /** ¿Están validados los textos legales? Sin eso no se puede fichar. */
  @Get("readiness")
  @Roles("VIEWER")
  async getReadiness(@Req() req: any) {
    return this.legalTexts.getReadiness(req.tenantId);
  }
}
