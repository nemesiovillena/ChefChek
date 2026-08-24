import { Module, Global, forwardRef } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CacheService } from "./cache.service";
import { EmailService } from "./email.service";
import { AlertsController } from "./alerts.controller";
import { WebSocketModule } from "../../websocket/websocket.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Global()
@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [AlertsController],
  providers: [NotificationsService, CacheService, EmailService],
  exports: [NotificationsService, CacheService, EmailService],
})
export class CoreModule {}
