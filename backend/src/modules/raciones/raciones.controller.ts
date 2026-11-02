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
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  RequireSection,
  SectionAccessGuard,
} from "../../guards/section-access.guard";
import {
  AdjustPortionsDto,
  CreatePortionCounterDto,
  LinkPortionDishDto,
  RecountPortionsDto,
  UpdatePortionCounterDto,
} from "./dto/portion-counter.dto";
import { PortionCounterService } from "./services/portion-counter.service";
import {
  PortionLedgerService,
  RACIONES_MODULE_ID,
} from "./services/portion-ledger.service";

/**
 * Contador de raciones. Ver y avisar: sección `raciones` (cocina y sala).
 * Dar de alta, ajustar y hacer recuento: `raciones.manage` (gerencia y cocina,
 * se quita por puesto o rol en Ajustes → Permisos).
 */
@ApiTags("Raciones")
@ApiBearerAuth()
@Controller("api/v1/raciones")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule(RACIONES_MODULE_ID)
@RequireSection("raciones")
export class RacionesController {
  constructor(
    private readonly counters: PortionCounterService,
    private readonly ledger: PortionLedgerService,
  ) {}

  @Get()
  overview(@Req() req: any) {
    return this.counters.overview(req.tenantId);
  }

  @Get("cuiner-dishes")
  searchDishes(@Req() req: any, @Query("q") q = "") {
    return this.counters.searchCuinerDishes(req.tenantId, q);
  }

  @Get(":id")
  detail(@Req() req: any, @Param("id") id: string) {
    return this.counters.detail(req.tenantId, id);
  }

  @Post()
  @RequireSection("raciones.manage")
  create(@Req() req: any, @Body() dto: CreatePortionCounterDto) {
    return this.counters.create(req.tenantId, dto);
  }

  @Patch(":id")
  @RequireSection("raciones.manage")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePortionCounterDto,
  ) {
    return this.counters.update(req.tenantId, id, dto);
  }

  @Post(":id/dishes")
  @RequireSection("raciones.manage")
  linkDish(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: LinkPortionDishDto,
  ) {
    return this.counters.linkDish(req.tenantId, id, dto);
  }

  @Delete(":id/dishes/:dishId")
  @RequireSection("raciones.manage")
  unlinkDish(
    @Req() req: any,
    @Param("id") id: string,
    @Param("dishId") dishId: string,
  ) {
    return this.counters.unlinkDish(req.tenantId, id, dishId);
  }

  @Post(":id/adjust")
  @RequireSection("raciones.manage")
  async adjust(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: AdjustPortionsDto,
  ) {
    await this.ledger.adjust(req.tenantId, id, dto.delta, dto.reason, req.user);
    return this.counters.detail(req.tenantId, id);
  }

  @Post(":id/recount")
  @RequireSection("raciones.manage")
  async recount(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: RecountPortionsDto,
  ) {
    await this.ledger.recount(
      req.tenantId,
      id,
      dto.actual,
      dto.reason,
      req.user,
    );
    return this.counters.detail(req.tenantId, id);
  }

  /** «Siguen disponibles» en una etiqueta caducada con raciones. */
  @Post("labels/:labelId/acknowledge-expired")
  acknowledgeExpired(@Req() req: any, @Param("labelId") labelId: string) {
    return this.counters.acknowledgeExpired(req.tenantId, labelId);
  }
}
