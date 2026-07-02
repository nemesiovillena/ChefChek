import { Module } from "@nestjs/common";
import { SuperadminController } from "./superadmin.controller";
import { SuperadminService } from "./superadmin.service";
import { AuthModule } from "../auth/auth.module";
import { ModulesModule } from "../modules/modules.module";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [AuthModule, ModulesModule, TenantsModule],
  controllers: [SuperadminController],
  providers: [SuperadminService],
})
export class SuperadminModule {}
