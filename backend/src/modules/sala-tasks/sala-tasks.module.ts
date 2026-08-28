import { Module } from "@nestjs/common";
import { SalaTasksController } from "./sala-tasks.controller";
import { SalaTasksService } from "./sala-tasks.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CoreModule } from "../core/core.module";

@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [SalaTasksController],
  providers: [SalaTasksService],
  exports: [SalaTasksService],
})
export class SalaTasksModule {}
