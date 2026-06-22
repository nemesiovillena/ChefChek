import { Module, Global } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CacheService } from "./cache.service";
import { EmailService } from "./email.service";

@Global()
@Module({
  providers: [NotificationsService, CacheService, EmailService],
  exports: [NotificationsService, CacheService, EmailService],
})
export class CoreModule {}
