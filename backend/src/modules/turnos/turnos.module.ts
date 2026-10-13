import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CheckInModule } from "../check-in/check-in.module";
import { CheckInManagerGuard } from "../check-in/guards/check-in-manager.guard";
import { TurnosController } from "./turnos.controller";
import { ScheduleController } from "./schedule.controller";
import { ShiftsService } from "./services/shifts.service";
import { AbsenceTypesService } from "./services/absence-types.service";
import { AbsencesService } from "./services/absences.service";
import { HolidaysService } from "./services/holidays.service";
import { LeaveBalanceService } from "./services/leave-balance.service";

/**
 * Módulo Turnos y ausencias. Depende de Check-In: las personas son sus fichas
 * de empleado y las reglas (días de vacaciones, naturales o laborables) salen
 * de sus ajustes de convenio. Ver docs/pdr-modulo-check-in.md.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 */
@Module({
  imports: [PrismaModule, AuthModule, CheckInModule],
  controllers: [TurnosController, ScheduleController],
  providers: [
    AbsenceTypesService,
    AbsencesService,
    HolidaysService,
    LeaveBalanceService,
    ShiftsService,
    CheckInManagerGuard,
  ],
  exports: [AbsencesService, HolidaysService],
})
export class TurnosModule {}
