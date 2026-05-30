import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/services/prisma.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { GuardsModule } from './guards/guards.module';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { TenantsController } from './modules/tenants/tenants.controller';
import { UsersController } from './modules/users/users.controller';
import { AuthController } from './modules/auth/auth.controller';

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
    GuardsModule,
  ],
  controllers: [
    TenantsController,
    UsersController,
    AuthController,
  ],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('/api/v1/auth/login', '/api/v1/tenants')
      .forRoutes('*');
  }
}