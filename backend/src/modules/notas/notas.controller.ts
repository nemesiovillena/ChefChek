import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  RequireSection,
  SectionAccessGuard,
} from "../../guards/section-access.guard";
import { NotasService } from "./notas.service";
import { NoteTagsService } from "./note-tags.service";
import {
  CreateNoteDto,
  ListNotesQueryDto,
  MarkNoteDoneDto,
  NoteHighlightsQueryDto,
  UpdateNoteDto,
} from "./dto/note.dto";
import {
  CreateNoteTagDto,
  ReorderNoteTagsDto,
  UpdateNoteTagDto,
} from "./dto/note-tag.dto";
import { noteActorFromRequest } from "./note-actor";

@ApiTags("Notas")
@ApiBearerAuth()
@Controller("api/v1/notes")
@UseGuards(AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("notas")
@RequireSection("notas")
export class NotasController {
  constructor(
    private readonly notes: NotasService,
    private readonly tags: NoteTagsService,
  ) {}

  // Rutas fijas antes de las de `:id`.
  @Get("tags")
  listTags(@Req() req: any) {
    return this.tags.list(req.tenantId);
  }

  @Post("tags")
  createTag(@Req() req: any, @Body() dto: CreateNoteTagDto) {
    return this.tags.create(req.tenantId, noteActorFromRequest(req), dto);
  }

  @Patch("tags/reorder")
  reorderTags(@Req() req: any, @Body() dto: ReorderNoteTagsDto) {
    return this.tags.reorder(req.tenantId, noteActorFromRequest(req), dto);
  }

  @Patch("tags/:id")
  updateTag(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateNoteTagDto,
  ) {
    return this.tags.update(req.tenantId, noteActorFromRequest(req), id, dto);
  }

  @Delete("tags/:id")
  removeTag(@Req() req: any, @Param("id") id: string) {
    return this.tags.remove(req.tenantId, noteActorFromRequest(req), id);
  }

  @Get("highlights")
  highlights(@Req() req: any, @Query() query: NoteHighlightsQueryDto) {
    return this.notes.highlights(
      req.tenantId,
      noteActorFromRequest(req),
      query.shared === "1",
    );
  }

  @Get()
  list(@Req() req: any, @Query() query: ListNotesQueryDto) {
    return this.notes.list(req.tenantId, noteActorFromRequest(req), query);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateNoteDto) {
    return this.notes.create(req.tenantId, noteActorFromRequest(req), dto);
  }

  @Patch(":id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(req.tenantId, noteActorFromRequest(req), id, dto);
  }

  @Post(":id/done")
  markDone(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: MarkNoteDoneDto,
  ) {
    return this.notes.markDone(
      req.tenantId,
      noteActorFromRequest(req),
      id,
      dto,
    );
  }

  @Post(":id/undone")
  markUndone(@Req() req: any, @Param("id") id: string) {
    return this.notes.markUndone(req.tenantId, noteActorFromRequest(req), id);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.notes.remove(req.tenantId, noteActorFromRequest(req), id);
  }
}
