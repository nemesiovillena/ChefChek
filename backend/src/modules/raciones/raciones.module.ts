import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CoreModule } from "../core/core.module";
import { RacionesController } from "./raciones.controller";
import { PortionCounterService } from "./services/portion-counter.service";
import { PortionCuinerSyncService } from "./services/portion-cuiner-sync.service";
import { PortionLedgerService } from "./services/portion-ledger.service";

/**
 * Contador de raciones disponibles. Etiquetado y Cuiner lo importan para
 * mover raciones (PortionLedgerService); este módulo no depende de ellos.
 */
@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [RacionesController],
  providers: [
    PortionLedgerService,
    PortionCounterService,
    PortionCuinerSyncService,
  ],
  exports: [PortionLedgerService, PortionCuinerSyncService],
})
export class RacionesModule {}
