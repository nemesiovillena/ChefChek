import { Module, Global } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RoleAccessController } from "./role-access.controller";
import { RoleAccessService } from "./role-access.service";

/**
 * Global so SectionAccessGuard (registered in GuardsModule) can inject
 * RoleAccessService, mirroring how ModuleGuard injects the global
 * ModulesService.
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [RoleAccessController],
  providers: [RoleAccessService],
  exports: [RoleAccessService],
})
export class RoleAccessModule {}
