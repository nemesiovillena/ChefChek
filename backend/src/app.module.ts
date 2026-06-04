import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
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
import { JwtAuthMiddleware } from "./middleware/jwt-auth.middleware";
import { TenantsController } from "./modules/tenants/tenants.controller";
import { UsersController } from "./modules/users/users.controller";
import { AuthController } from "./modules/auth/auth.controller";
import { ProductsController } from "./modules/products/products.controller";
import { RecipesController } from "./modules/recipes/recipes.controller";
import { MenusController } from "./modules/menus/menus.controller";
import { TechnicalSheetsController } from "./modules/technical-sheets/technical-sheets.controller";
import { DigitalMenuController } from "./modules/digital-menu/digital-menu.controller";
import { DashboardController } from "./modules/dashboard/dashboard.controller";
import { IngestaController } from "./modules/ingesta/ingesta.controller";
import { SalaController } from "./modules/sala/sala.controller";

import { ProductionModule } from "./modules/production/production.module";
import { AppccModule } from "./modules/appcc/appcc.module";
import { AllergensModule } from "./modules/allergens/allergens.module";
import { AlmacenesModule } from "./modules/almacenes/almacenes.module";
import { ConocimientoModule } from "./modules/conocimiento/conocimiento.module";
import { DigitalMenuModule } from "./modules/digital-menu/digital-menu.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { IngestaModule } from "./modules/ingesta/ingesta.module";
import { SalaModule } from "./modules/sala/sala.module";

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
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === "production" ? undefined : "dev-only-secret"),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
      global: true,
    }),
    ProductsModule,
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
    IngestaModule,
    SalaModule,
    GuardsModule,
  ],
  controllers: [
    TenantsController,
    UsersController,
    AuthController,
    ProductsController,
    RecipesController,
    MenusController,
    TechnicalSheetsController,
    DigitalMenuController,
    DashboardController,
    IngestaController,
    SalaController,
  ],
  providers: [
    JwtAuthMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: "api/v1/auth/login", method: RequestMethod.POST },
        { path: "api/v1/tenants", method: RequestMethod.POST },
        { path: "api/v1/tenants", method: RequestMethod.GET },
      )
      .forRoutes("*");

    consumer
      .apply(JwtAuthMiddleware)
      .exclude(
        { path: "api/v1/auth/login", method: RequestMethod.POST },
        { path: "api/v1/auth/logout", method: RequestMethod.POST },
        { path: "api/v1/auth/refresh", method: RequestMethod.POST },
        { path: "api/v1/auth/validate", method: RequestMethod.GET },
        { path: "api/v1/tenants", method: RequestMethod.POST },
        { path: "api/v1/tenants", method: RequestMethod.GET },
      )
      .forRoutes("api/v1/auth/sessions");
  }
}
