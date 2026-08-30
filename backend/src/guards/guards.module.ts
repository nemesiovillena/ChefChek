import { Module, Global } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { TenantGuard } from "./tenant.guard";
import { SuperadminGuard } from "./superadmin.guard";
import { ModuleGuard } from "./module.guard";
import { SectionAccessGuard } from "./section-access.guard";
import { AuthService } from "../modules/auth/auth.service";
import { UsersService } from "../modules/users/users.service";
import { AuthModule } from "../modules/auth/auth.module";
import { UsersModule } from "../modules/users/users.module";

@Global()
@Module({
  imports: [AuthModule, UsersModule],
  providers: [
    AuthGuard,
    RolesGuard,
    TenantGuard,
    SuperadminGuard,
    ModuleGuard,
    SectionAccessGuard,
  ],
  exports: [
    AuthGuard,
    RolesGuard,
    TenantGuard,
    SuperadminGuard,
    ModuleGuard,
    SectionAccessGuard,
  ],
})
export class GuardsModule {}
