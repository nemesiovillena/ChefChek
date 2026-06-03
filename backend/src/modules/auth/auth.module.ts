import { Module, forwardRef } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LuciaAuthService } from "./lucia-auth.service";
import { SessionService } from "./session.service";
import { PermissionsService } from "./permissions.service";
import { UsersModule } from "../users/users.module";
import { TenantsModule } from "../tenants/tenants.module";
import { PrismaModule } from "../../common/services/prisma.module";

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => TenantsModule), PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    LuciaAuthService,
    SessionService,
    PermissionsService,
  ],
  exports: [AuthService, SessionService, LuciaAuthService, PermissionsService],
})
export class AuthModule {}
