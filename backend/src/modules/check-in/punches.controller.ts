import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
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
import { CheckInManagerGuard } from "./guards/check-in-manager.guard";
import { CHECK_IN_MANAGER_ROLE } from "./constants/check-in-permissions";
import { CreatePunchDto } from "./dto/punch.dto";
import { LegalTextsService } from "./services/legal-texts.service";
import { PunchActor, PunchService } from "./services/punch.service";

const MANAGER_ROLES = ["ADMIN", "OWNER", "SUPERADMIN"];

/**
 * Fichaje: desde la cuenta personal (sin PIN) o desde un kiosco compartido
 * (cuenta compartida + empleado + PIN). Abierto a cualquier rol del tenant.
 */
@Controller("api/v1/check-in")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("check-in")
@RequireSection("check-in")
@Roles("VIEWER")
export class PunchesController {
  constructor(
    private readonly punches: PunchService,
    private readonly legalTexts: LegalTextsService,
  ) {}

  /** ¿Están validados los textos legales? Sin eso no se puede fichar. */
  @Get("readiness")
  async getReadiness(@Req() req: any) {
    return this.legalTexts.getReadiness(req.tenantId);
  }

  /** Estado de la cuenta personal: situación, últimos fichajes, textos por leer. */
  @Get("me")
  async getOwnState(@Req() req: any) {
    return this.punches.getOwnState(req.tenantId, actorOf(req));
  }

  @Post("me/legal-acks")
  async ackLegalTexts(@Req() req: any) {
    return this.punches.ackOwnLegalTexts(req.tenantId, actorOf(req));
  }

  // Sin límite propio a propósito: en un cambio de turno todo el equipo
  // ficha desde la misma IP (el kiosco o la wifi del local) en un minuto. La
  // fuerza bruta del PIN la frena el bloqueo por empleado, y sigue aplicando
  // el límite global de peticiones.
  @Post("punches")
  async record(
    @Req() req: any,
    @Body() dto: CreatePunchDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.punches.record(req.tenantId, actorOf(req), dto, userAgent);
  }

  /** Pantalla de kiosco: solo cuentas compartidas o quien gestiona el módulo. */
  @Get("kiosk")
  async getKioskState(
    @Req() req: any,
    @Query("locationId") locationId?: string,
  ) {
    // El kiosco solo enseña nombres y si cada persona está dentro o fuera.
    if (!req.user.isSharedAccount && !MANAGER_ROLES.includes(req.user.role)) {
      throw new ForbiddenException(
        "El kiosco solo se abre desde una cuenta compartida.",
      );
    }
    return this.punches.getKioskState(req.tenantId, locationId);
  }

  @Get("presence")
  @Roles(CHECK_IN_MANAGER_ROLE)
  @UseGuards(CheckInManagerGuard)
  async getPresence(@Req() req: any) {
    return this.punches.getPresence(req.tenantId);
  }
}

function actorOf(req: any): PunchActor {
  return {
    id: req.user.id,
    isSharedAccount: req.user.isSharedAccount === true,
  };
}
