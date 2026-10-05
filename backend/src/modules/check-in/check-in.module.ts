import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { LocationsService } from "../compras/services/locations.service";
import { EmployeesController } from "./employees.controller";
import { CheckInConfigurationController } from "./configuration.controller";
import { EmployeesService } from "./services/employees.service";
import { EmployeePinService } from "./services/employee-pin.service";
import { CheckInSettingsService } from "./services/check-in-settings.service";
import { LegalTextsService } from "./services/legal-texts.service";
import { WorkCentersService } from "./services/work-centers.service";
import { LegalAcksService } from "./services/legal-acks.service";
import { PunchService } from "./services/punch.service";
import { KioskKeyService } from "./services/kiosk-key.service";
import { PunchesController } from "./punches.controller";
import { CheckInManagerGuard } from "./guards/check-in-manager.guard";

/**
 * Módulo Check-In (control horario): fichas de empleado, PIN de kiosco,
 * configuración (convenio, centros con geovalla, textos legales) y fichaje
 * desde cuenta personal o kiosco.
 * Ver docs/pdr-modulo-check-in.md.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 * LocationsService se provee aquí directamente (solo depende de Prisma) para
 * gestionar centros sin arrastrar todo ComprasModule ni exigir que el tenant
 * tenga Compras activo.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    EmployeesController,
    CheckInConfigurationController,
    PunchesController,
  ],
  providers: [
    EmployeesService,
    EmployeePinService,
    CheckInSettingsService,
    LegalTextsService,
    WorkCentersService,
    LocationsService,
    LegalAcksService,
    PunchService,
    KioskKeyService,
    CheckInManagerGuard,
  ],
  exports: [
    EmployeesService,
    EmployeePinService,
    CheckInSettingsService,
    LegalTextsService,
  ],
})
export class CheckInModule {}
