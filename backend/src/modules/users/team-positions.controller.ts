import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { Roles } from "../../decorators/roles.decorator";
import { TeamPositionsService } from "./team-positions.service";
import {
  CreateTeamPositionDto,
  SaveTeamPositionDto,
  SetUserPositionDto,
  UpdatePositionAccessDto,
} from "./dto/team-position.dto";

/** Puestos de trabajo y sus permisos, desde Equipo. Solo encargados. */
@ApiTags("Equipo · Puestos")
@ApiBearerAuth()
@Controller("api/v1/team/positions")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Roles("ADMIN")
export class TeamPositionsController {
  constructor(private readonly positions: TeamPositionsService) {}

  @Get()
  @ApiOperation({ summary: "Puestos con sus personas y lo que ve cada uno" })
  list(@Req() req: any) {
    return this.positions.list(req.tenantId);
  }

  @Post()
  @ApiOperation({
    summary:
      "Crear un puesto (opcional: igual que otro, copia lo que ve y sus áreas)",
  })
  create(@Req() req: any, @Body() dto: CreateTeamPositionDto) {
    return this.positions.create(
      req.tenantId,
      dto.title,
      dto.copyFromId,
      req.user.id,
    );
  }

  @Patch(":id")
  @ApiOperation({ summary: "Renombrar un puesto" })
  rename(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SaveTeamPositionDto,
  ) {
    return this.positions.rename(req.tenantId, id, dto.title);
  }

  @Post(":id/archive")
  @ApiOperation({
    summary: "Archivar un puesto (sus personas quedan sin puesto)",
  })
  archive(@Req() req: any, @Param("id") id: string) {
    return this.positions.archive(req.tenantId, id);
  }

  @Put(":id/access")
  @ApiOperation({ summary: "Guardar qué apartados ve el puesto" })
  updateAccess(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePositionAccessDto,
  ) {
    return this.positions.updateAccess(
      req.tenantId,
      id,
      req.user.id,
      dto.access,
    );
  }

  @Put("users/:userId")
  @ApiOperation({
    summary: "Cambiar el puesto de una persona (null = sin puesto)",
  })
  setUserPosition(
    @Req() req: any,
    @Param("userId") userId: string,
    @Body() dto: SetUserPositionDto,
  ) {
    return this.positions.setUserPosition(
      req.tenantId,
      userId,
      dto.positionId ?? null,
    );
  }
}
