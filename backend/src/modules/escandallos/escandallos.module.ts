import { Module } from "@nestjs/common";
import { EscandallosController } from "./escandallos.controller";
import { EscandallosService } from "./escandallos.service";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EscandallosController],
  providers: [EscandallosService],
  exports: [EscandallosService],
})
export class EscandallosModule {}
