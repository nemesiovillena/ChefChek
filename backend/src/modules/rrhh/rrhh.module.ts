import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CheckInModule } from "../check-in/check-in.module";
import { CheckInManagerGuard } from "../check-in/guards/check-in-manager.guard";
import { ModulesModule } from "../modules/modules.module";
import { TurnosModule } from "../turnos/turnos.module";
import { MeController } from "./me.controller";
import { RequestsController } from "./requests.controller";
import { EmployeeRequestsService } from "./services/employee-requests.service";
import { EmployeeSelfService } from "./services/employee-self.service";

/**
 * Portal del empleado ("Mi espacio"). Depende de Check-In (las personas son
 * sus fichas) y lista junto a sus solicitudes las de Turnos cuando ese
 * módulo está activo. Ver docs/pdr-modulo-check-in.md.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CheckInModule,
    TurnosModule,
    ModulesModule,
  ],
  controllers: [MeController, RequestsController],
  providers: [
    EmployeeSelfService,
    EmployeeRequestsService,
    CheckInManagerGuard,
  ],
})
export class RrhhModule {}
