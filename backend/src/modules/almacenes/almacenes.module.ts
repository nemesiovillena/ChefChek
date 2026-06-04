import { Module } from "@nestjs/common";
import { AlmacenesController } from "./almacenes.controller";
import { WarehousesService } from "./almacenes.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AlmacenesController],
  providers: [WarehousesService, PrismaService],
  exports: [WarehousesService],
})
export class AlmacenesModule {}
