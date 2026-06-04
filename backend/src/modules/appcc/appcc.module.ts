import { Module } from "@nestjs/common";
import { AppccController } from "./appcc.controller";
import { AppccService } from "./appcc.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppccController],
  providers: [AppccService],
  exports: [AppccService],
})
export class AppccModule {}
