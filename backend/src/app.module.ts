import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/services/prisma.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProductsModule } from "./modules/products/products.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { MenusModule } from "./modules/menus/menus.module";
import { TechnicalSheetsModule } from "./modules/technical-sheets/technical-sheets.module";
import { GuardsModule } from "./guards/guards.module";
import { CoreModule } from "./modules/core/core.module";
import { TenantMiddleware } from "./middleware/tenant.middleware";
import { AppLogger } from "./common/logger/logger.service";
import { TenantsController } from "./modules/tenants/tenants.controller";
import { UsersController } from "./modules/users/users.controller";
import { AuthController } from "./modules/auth/auth.controller";
import { CategoriesController } from "./modules/categories/categories.controller";
import { ProductsController } from "./modules/products/products.controller";
import { RecipesController } from "./modules/recipes/recipes.controller";
import { MenusController } from "./modules/menus/menus.controller";
import { TechnicalSheetsController } from "./modules/technical-sheets/technical-sheets.controller";
import { DigitalMenuController } from "./modules/digital-menu/digital-menu.controller";
import { DashboardController } from "./modules/dashboard/dashboard.controller";
import { SalaController } from "./modules/sala/sala.controller";
import { EscandallosController } from "./modules/escandallos/escandallos.controller";
import { SprintController } from "./modules/sprint/sprint.controller";
import { QRController } from "./modules/qr/qr.controller";

import { ProductionModule } from "./modules/production/production.module";
import { AppccModule } from "./modules/appcc/appcc.module";
import { AllergensModule } from "./modules/allergens/allergens.module";
import { AlmacenesModule } from "./modules/almacenes/almacenes.module";
import { ConocimientoModule } from "./modules/conocimiento/conocimiento.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { DigitalMenuModule } from "./modules/digital-menu/digital-menu.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { SalaModule } from "./modules/sala/sala.module";
import { EscandallosModule } from "./modules/escandallos/escandallos.module";
import { SprintModule } from "./modules/sprint/sprint.module";
import { QRModule } from "./modules/qr/qr.module";
import { AlbaranesModule } from "./modules/albaranes/albaranes.module";
import { TrashModule } from "./modules/trash/trash.module";
import { WebSocketModule } from "./websocket/websocket.module";
import { ModulesModule } from "./modules/modules/modules.module";
import { SuperadminModule } from "./modules/superadmin/superadmin.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TenantsModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    RecipesModule,
    MenusModule,
    TechnicalSheetsModule,
    ProductionModule,
    AppccModule,
    AllergensModule,
    OrdersModule,
    AlmacenesModule,
    ConocimientoModule,
    DigitalMenuModule,
    DashboardModule,
    SalaModule,
    EscandallosModule,
    SprintModule,
    QRModule,
    AlbaranesModule,
    TrashModule,
    GuardsModule,
    WebSocketModule,
    ModulesModule,
    SuperadminModule,
  ],
  controllers: [
    TenantsController,
    UsersController,
    AuthController,
    CategoriesController,
    ProductsController,
    RecipesController,
    MenusController,
    TechnicalSheetsController,
    DigitalMenuController,
    DashboardController,
    SalaController,
    EscandallosController,
    SprintController,
    QRController,
  ],
  providers: [
    AppLogger,
    TenantMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: "/", method: RequestMethod.GET },
        { path: "health", method: RequestMethod.GET },
        { path: "api/docs", method: RequestMethod.GET },
      )
      .forRoutes("api/v1/*");
  }
}
