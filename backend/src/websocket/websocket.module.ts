import { Module } from "@nestjs/common";
import { WebSocketGateway } from "./websocket.gateway";
import { WebSocketService } from "./websocket.service";
import { AuthModule } from "../modules/auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [WebSocketGateway, WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
