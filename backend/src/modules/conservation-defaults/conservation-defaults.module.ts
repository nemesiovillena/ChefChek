import { Module } from "@nestjs/common";
import { ConservationDefaultsController } from "./conservation-defaults.controller";
import { ConservationDefaultsService } from "./conservation-defaults.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConservationDefaultsController],
  providers: [ConservationDefaultsService],
  exports: [ConservationDefaultsService],
})
export class ConservationDefaultsModule {}
