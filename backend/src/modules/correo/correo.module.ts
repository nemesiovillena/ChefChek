import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/services/audit.module";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ModulesModule } from "../modules/modules.module";
import { CorreoAccessGuard } from "./correo-access.guard";
import { CorreoAccessLogService } from "./correo-access-log.service";
import { CorreoConfigService } from "./correo-config.service";
import { CorreoController } from "./correo.controller";
import { CorreoMailboxService } from "./correo-mailbox.service";
import { CorreoSendService } from "./correo-send.service";
import { ImapClientService } from "./imap-client.service";

/**
 * Buzón del restaurante (IMAP en vivo para leer, SMTP para enviar). Sin tablas propias:
 * credenciales en Configuration (MAIL_INBOX) y accesos en audit_logs.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 */
@Module({
  imports: [PrismaModule, AuthModule, ModulesModule, AuditModule],
  controllers: [CorreoController],
  providers: [
    CorreoConfigService,
    ImapClientService,
    CorreoMailboxService,
    CorreoAccessLogService,
    CorreoSendService,
    CorreoAccessGuard,
  ],
})
export class CorreoModule {}
