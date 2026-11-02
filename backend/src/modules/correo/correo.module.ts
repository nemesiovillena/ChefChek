import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/services/audit.module";
import { PrismaModule } from "../../common/services/prisma.module";
import { AlbaranesModule } from "../albaranes/albaranes.module";
import { AuthModule } from "../auth/auth.module";
import { ModulesModule } from "../modules/modules.module";
import { CorreoAccessGuard } from "./correo-access.guard";
import { CorreoAccessLogService } from "./correo-access-log.service";
import { CorreoAlbaranService } from "./correo-albaran.service";
import { CorreoConfigService } from "./correo-config.service";
import { CorreoController } from "./correo.controller";
import { CorreoMailboxService } from "./correo-mailbox.service";
import { CorreoSendService } from "./correo-send.service";
import { ImapClientService } from "./imap-client.service";

/**
 * Buzón del restaurante (IMAP en vivo para leer, SMTP para enviar). Sin tablas propias:
 * credenciales en Configuration (MAIL_INBOX) y accesos en audit_logs.
 * AlbaranesModule: para pasar un adjunto a albarán con la misma lectura IA.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ModulesModule,
    AuditModule,
    AlbaranesModule,
  ],
  controllers: [CorreoController],
  providers: [
    CorreoConfigService,
    ImapClientService,
    CorreoMailboxService,
    CorreoAccessLogService,
    CorreoSendService,
    CorreoAlbaranService,
    CorreoAccessGuard,
  ],
})
export class CorreoModule {}
