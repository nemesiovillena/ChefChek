import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiConsumes } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
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
import { CheckInManagerGuard } from "./guards/check-in-manager.guard";
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
import { AssistantCompletionError } from "../ai-assistant/assistant-completion.service";
import {
  AGREEMENT_FILE_TYPES,
  AgreementExtractionError,
  AgreementExtractionService,
} from "./services/agreement-extraction.service";

/** Convenio + revisiones/tablas publicadas aparte. */
const MAX_AGREEMENT_FILES = 3;
/** Total de lo que se manda a la IA en una sola petición. */
const MAX_AGREEMENT_BYTES = 20 * 1024 * 1024;
// Cada lectura es una llamada de pago a la IA.
const EXTRACT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

/**
 * Configuración de Check-In: convenio y jornada, centros de trabajo con su
 * geovalla y textos legales. Solo para quien gestiona el módulo y nunca
 * desde una cuenta compartida.
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
export class CheckInConfigurationController {
  constructor(
    private readonly settings: CheckInSettingsService,
    private readonly legalTexts: LegalTextsService,
    private readonly workCenters: WorkCentersService,
    private readonly locations: LocationsService,
    private readonly agreementExtraction: AgreementExtractionService,
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

  /**
   * Lee el convenio subido con la IA del tenant y devuelve los parámetros
   * propuestos con su cita. No guarda nada (ni los parámetros ni el archivo):
   * quien gestiona revisa la propuesta en el formulario y la guarda él.
   */
  @Post("settings/agreement/extract")
  @Throttle(EXTRACT_THROTTLE)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FilesInterceptor("files", MAX_AGREEMENT_FILES, {
      limits: { fileSize: MAX_AGREEMENT_BYTES },
    }),
  )
  async extractAgreement(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    if (!files?.length) {
      throw new BadRequestException("No se ha subido ningún archivo");
    }
    if (files.some((f) => !AGREEMENT_FILE_TYPES.includes(f.mimetype))) {
      throw new BadRequestException(
        "Formato no admitido. Sube el convenio en PDF (o fotos JPG/PNG).",
      );
    }
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_AGREEMENT_BYTES) {
      throw new BadRequestException(
        "Los archivos superan 20 MB en total. Sube solo el convenio.",
      );
    }
    try {
      return await this.agreementExtraction.extract(
        req.tenantId,
        files.map((f) => ({
          mimeType: f.mimetype,
          dataBase64: f.buffer.toString("base64"),
        })),
      );
    } catch (error) {
      if (
        error instanceof AgreementExtractionError ||
        error instanceof AssistantCompletionError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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
}
