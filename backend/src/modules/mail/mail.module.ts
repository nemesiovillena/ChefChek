import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { PrismaModule } from "../../common/services/prisma.module";

/** SMTP por tenant (Configuration category SMTP, password cifrado). */
@Module({
  imports: [PrismaModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
