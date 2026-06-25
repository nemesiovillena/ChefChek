import { Module } from "@nestjs/common";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
