import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/services/prisma.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
// import { MenusModule } from './modules/menus/menus.module';
import { GuardsModule } from './guards/guards.module';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { TenantsController } from './modules/tenants/tenants.controller';
import { UsersController } from './modules/users/users.controller';
import { AuthController } from './modules/auth/auth.controller';
import { ProductsController } from './modules/products/products.controller';
// import { RecipesController } from './modules/recipes/recipes.controller';
// import { MenusController } from './modules/menus/menus.controller';

// Temporarily disabled modules with errors
import { ProductionModule } from './modules/production/production.module';
import { AppccModule } from './modules/appcc/appcc.module';
import { AllergensModule } from './modules/allergens/allergens.module';
// import { DigitalMenuModule } from './modules/digital-menu/digital-menu.module';
import { OrdersModule } from './modules/orders/orders.module';
// import { IngestionModule } from './modules/ingestion/ingestion.module';
// import { OcrAiModule } from './modules/ocr-ai/ocr-ai.module';
// import { DashboardModule } from './modules/dashboard/dashboard.module';
// TechnicalSheetsModule desactivado - requiere corrección de librerías PDF (pdfkit vs pdf-lib)
// import { TechnicalSheetsModule } from './modules/technical-sheets/technical-sheets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    ProductionModule,
    AppccModule,
    AllergensModule,
    OrdersModule,
    // RecipesModule,
    // MenusModule,
    GuardsModule,
  ],
  controllers: [
    TenantsController,
    UsersController,
    AuthController,
    ProductsController,
    // RecipesController,
    // MenusController,
  ],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/login', method: RequestMethod.POST },
        { path: 'api/v1/tenants', method: RequestMethod.POST },
        { path: 'api/v1/tenants', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}