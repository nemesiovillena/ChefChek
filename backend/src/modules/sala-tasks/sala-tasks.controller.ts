import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SalaTasksService } from "./sala-tasks.service";
import {
  CreateSalaTaskDto,
  UpdateSalaTaskDto,
  ReorderSalaTasksDto,
} from "./dto/sala-task.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";

@ApiTags("Notificaciones de Sala")
@ApiBearerAuth()
@Controller("api/v1/sala-tasks")
@UseGuards(AuthGuard, TenantGuard, ModuleGuard)
@RequireModule("sala-notificaciones")
export class SalaTasksController {
  constructor(private readonly salaTasksService: SalaTasksService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateSalaTaskDto) {
    return this.salaTasksService.create(req.tenantId, req.user?.id, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.salaTasksService.findAll(req.tenantId);
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    return this.salaTasksService.findOne(req.tenantId, id);
  }

  @Patch("reorder")
  async reorder(@Req() req: any, @Body() dto: ReorderSalaTasksDto) {
    return this.salaTasksService.reorder(req.tenantId, dto);
  }

  @Patch(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateSalaTaskDto,
  ) {
    return this.salaTasksService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    return this.salaTasksService.remove(req.tenantId, id);
  }
}
