import { Module, Global } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './tenant.guard';
import { AuthService } from '../modules/auth/auth.service';
import { UsersService } from '../modules/users/users.service';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';

@Global()
@Module({
  imports: [AuthModule, UsersModule],
  providers: [AuthGuard, RolesGuard, TenantGuard],
  exports: [AuthGuard, RolesGuard, TenantGuard],
})
export class GuardsModule {}