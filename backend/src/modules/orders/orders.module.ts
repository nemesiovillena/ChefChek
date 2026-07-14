/**
 * @deprecated Prototipo retirado (no se registra en AppModule). Su servicio
 * referencia modelos Prisma inexistentes (automatedOrder, orderItem) y nunca
 * funcionó en runtime. La gestión real de pedidos de compra vive en el módulo
 * `compras` (docs/pdr-modulo-compras.md). Se conserva solo como referencia de
 * dominio; las tablas stub (orders, goods_receptions) siguen en la BD.
 */
import { Module, forwardRef } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { WebSocketModule } from "../../websocket/websocket.module";

@Module({
  imports: [PrismaModule, AuthModule, WebSocketModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
