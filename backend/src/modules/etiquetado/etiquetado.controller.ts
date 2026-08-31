import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  RequireSection,
  SectionAccessGuard,
} from "../../guards/section-access.guard";
import { FoodLabelService } from "./services/food-label.service";
import { FoodLabelContextService } from "./services/food-label-context.service";
import { FoodLabelPdfService } from "./services/food-label-pdf.service";
import { CreateFoodLabelDto } from "./dto/create-food-label.dto";
import { ListFoodLabelsDto } from "./dto/list-food-labels.dto";
import { VoidFoodLabelDto } from "./dto/void-food-label.dto";
import { UpdateEtiquetadoConfigDto } from "./dto/update-etiquetado-config.dto";
import { EtiquetadoConfigService } from "./services/etiquetado-config.service";

@ApiTags("Etiquetado")
@ApiBearerAuth()
@Controller("api/v1/etiquetado")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("etiquetado")
@RequireSection("etiquetado")
export class EtiquetadoController {
  constructor(
    private readonly foodLabels: FoodLabelService,
    private readonly context: FoodLabelContextService,
    private readonly pdf: FoodLabelPdfService,
    private readonly config: EtiquetadoConfigService,
  ) {}

  @Get("config")
  async getConfig(@Req() req: any) {
    return this.config.getConfig(req.tenantId);
  }

  @Put("config")
  @Roles("ADMIN")
  async updateConfig(@Req() req: any, @Body() dto: UpdateEtiquetadoConfigDto) {
    const thermalProfiles = await this.config.setThermalProfiles(
      req.tenantId,
      dto.thermalProfiles,
      req.user.id,
    );
    return { thermalProfiles };
  }

  @Post("labels")
  @Roles("ADMIN", "USER")
  @RequireSection("etiquetado.emit")
  async create(@Req() req: any, @Body() dto: CreateFoodLabelDto) {
    return this.foodLabels.create(req.tenantId, req.user, dto);
  }

  @Get("labels")
  async list(@Req() req: any, @Query() query: ListFoodLabelsDto) {
    return this.foodLabels.list(req.tenantId, query);
  }

  @Get("labels/:id")
  async getOne(@Req() req: any, @Param("id") id: string) {
    return this.foodLabels.getById(req.tenantId, id);
  }

  @Get("labels/:id/pdf")
  @RequireSection("etiquetado.emit")
  async pdfLabel(
    @Req() req: any,
    @Res() res: Response,
    @Param("id") id: string,
    @Query("format") format?: string,
    @Query("copies") copies?: string,
    @Query("reprint") reprint?: string,
  ) {
    const label = await this.foodLabels.getById(req.tenantId, id);
    const spec = await this.config.resolveSpec(req.tenantId, format);
    const buffer = await this.pdf.generate(label, spec, Number(copies) || 1);
    if (reprint === "1") {
      await this.foodLabels.markReprinted(req.tenantId, id);
    }
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiqueta-${label.lotNumber}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  @Post("labels/:id/void")
  @Roles("ADMIN", "USER")
  @RequireSection("etiquetado.emit")
  async void(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: VoidFoodLabelDto,
  ) {
    return this.foodLabels.void(req.tenantId, id, dto.reason);
  }

  @Get("prep-context")
  @RequireSection("etiquetado.emit")
  async prepContext(
    @Req() req: any,
    @Query("recipeId") recipeId?: string,
    @Query("productId") productId?: string,
  ) {
    if (recipeId) {
      return this.context.forRecipe(req.tenantId, recipeId);
    }
    if (productId) {
      return this.context.forProduct(req.tenantId, productId);
    }
    throw new BadRequestException("Indica recipeId o productId");
  }
}
