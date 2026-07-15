import { Module, forwardRef } from "@nestjs/common";
import { ComprasController } from "./compras.controller";
import { LocationsService } from "./services/locations.service";
import { PurchaseListService } from "./services/purchase-list.service";
import { PurchaseOrderService } from "./services/purchase-order.service";
import { PurchaseOrderNumberService } from "./services/purchase-order-number.service";
import { PurchaseOrderStatusService } from "./services/purchase-order-status.service";
import { PurchaseOrderPdfService } from "./services/purchase-order-pdf.service";
import { OrderSendingService } from "./services/order-sending.service";
import { OrderReconciliationService } from "./services/order-reconciliation.service";
import { InvoiceService } from "./services/invoice.service";
import { PriceAgreementService } from "./services/price-agreement.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";

/**
 * Módulo Compras: pedidos a proveedores, listas de compra, envío multicanal,
 * precios pactados, catálogos IA, programación y analítica (ver
 * docs/pdr-modulo-compras.md). Sprint 0: locales. Sprint 1: listas + pedidos.
 *
 * AuthModule es imprescindible: sin él, AuthGuard rompe el arranque.
 */
@Module({
  imports: [
    PrismaModule,
    MailModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ComprasController],
  providers: [
    LocationsService,
    PurchaseListService,
    PurchaseOrderService,
    PurchaseOrderNumberService,
    PurchaseOrderStatusService,
    PurchaseOrderPdfService,
    OrderSendingService,
    OrderReconciliationService,
    InvoiceService,
    PriceAgreementService,
  ],
  exports: [
    LocationsService,
    PurchaseListService,
    PurchaseOrderService,
    OrderReconciliationService,
    PriceAgreementService,
  ],
})
export class ComprasModule {}
