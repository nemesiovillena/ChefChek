import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CoreModule } from "../core/core.module";
import { NotasController } from "./notas.controller";
import { NotasService } from "./notas.service";
import { NoteTagsService } from "./note-tags.service";

@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [NotasController],
  providers: [NotasService, NoteTagsService],
  exports: [NotasService],
})
export class NotasModule {}
