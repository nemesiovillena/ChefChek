import { Module } from "@nestjs/common";
import { ConocimientoController } from "./conocimiento.controller";
import { ConocimientoService } from "./conocimiento.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ConocimientoController],
  providers: [ConocimientoService, PrismaService],
  exports: [ConocimientoService],
})
export class ConocimientoModule {}
