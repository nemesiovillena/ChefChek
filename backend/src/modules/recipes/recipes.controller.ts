import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { storeUploadedImage } from "../../common/utils/store-uploaded-image.util";
import { BunnyStorageService } from "../../common/bunny/bunny-storage.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { RecipesService } from "./recipes.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { RecipesQueryDto } from "./dto/recipes-query.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { RoleAccessService } from "../role-access/role-access.service";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Recipes")
@Controller("api/v1/recipes")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("recipes")
@RequireSection("recipes")
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly roleAccess: RoleAccessService,
    private readonly bunny: BunnyStorageService,
  ) {}

  /** Whether the request's role may receive cost/pricing figures in payloads. */
  private canViewCost(req: any): Promise<boolean> {
    return this.roleAccess.isSectionAllowed(
      req.tenantId,
      req.user?.role,
      "recipes.cost",
    );
  }

  @Post()
  @Roles("ADMIN", "USER")
  @RequireSection("recipes.edit")
  @ApiOperation({ summary: "Crear una nueva receta/escandallo" })
  @ApiResponse({ status: 201, description: "Receta creada exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  async create(@Req() req: any, @Body() createRecipeDto: CreateRecipeDto) {
    const tenantId = req.tenantId;
    const recipe = await this.recipesService.create(tenantId, createRecipeDto);
    return {
      success: true,
      data: recipe,
      message: "Recipe created successfully",
    };
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todas las recetas del tenant" })
  @ApiResponse({ status: 200, description: "Lista de recetas" })
  async findAll(@Req() req: any, @Query() query: RecipesQueryDto) {
    const tenantId = req.tenantId;
    const { data, meta } = await this.recipesService.findAll(
      tenantId,
      query,
      await this.canViewCost(req),
    );
    return {
      success: true,
      data,
      meta,
      message: "Recipes retrieved successfully",
    };
  }

  @Get("options")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary:
      "Listado ligero (id+nombre) de todas las recetas activas del tenant, sin paginar — para pickers (p.ej. sub-recetas)",
  })
  async findAllOptions(@Req() req: any) {
    const tenantId = req.tenantId;
    const data = await this.recipesService.findAllOptions(tenantId);
    return {
      success: true,
      data,
      message: "Recipe options retrieved successfully",
    };
  }

  // Debe ir ANTES de @Get(":id") para que NestJS no lo captura como id.
  // Advisory-only: devuelve recetas activas del tenant cuyo nombre coincide
  // ignorando mayúsculas/espacios/acentos. No bloquea la creación.
  @Get("check-name")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary: "Comprobar recetas con nombre similar (accent-insensitive)",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de coincidencias existentes",
  })
  async checkName(
    @Query("name") name: string,
    @Query("excludeId") excludeId: string | undefined,
    @Req() req: any,
  ) {
    const matches = await this.recipesService.findNameMatches(
      req.tenantId,
      (name ?? "").trim(),
      excludeId,
    );
    return { success: true, data: matches };
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener una receta por ID" })
  @ApiParam({ name: "id", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Receta encontrada" })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async findOne(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const recipe = await this.recipesService.findOne(
      tenantId,
      id,
      await this.canViewCost(req),
    );
    return {
      success: true,
      data: recipe,
      message: "Recipe retrieved successfully",
    };
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
  @RequireSection("recipes.edit")
  @ApiOperation({ summary: "Actualizar una receta" })
  @ApiParam({ name: "id", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Receta actualizada exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() updateRecipeDto: Partial<CreateRecipeDto>,
  ) {
    const tenantId = req.tenantId;
    const recipe = await this.recipesService.update(
      tenantId,
      id,
      updateRecipeDto,
    );
    return {
      success: true,
      data: recipe,
      message: "Recipe updated successfully",
    };
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar una receta (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Receta eliminada exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado (solo ADMIN)" })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async remove(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    await this.recipesService.remove(tenantId, id);
    return {
      success: true,
      message: "Recipe deleted successfully",
    };
  }

  @Post(":id/duplicate")
  @Roles("ADMIN", "USER")
  @RequireSection("recipes.edit")
  @ApiOperation({ summary: "Duplicar una receta" })
  @ApiParam({ name: "id", description: "ID de la receta a duplicar" })
  @ApiResponse({ status: 201, description: "Receta duplicada exitosamente" })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async duplicate(
    @Req() req: any,
    @Param("id") id: string,
    @Body("newName") newName?: string,
  ) {
    const tenantId = req.tenantId;
    const recipe = await this.recipesService.duplicate(tenantId, id, newName);
    return {
      success: true,
      data: recipe,
      message: "Recipe duplicated successfully",
    };
  }

  @Get(":id/calculate")
  @Roles("ADMIN", "USER", "VIEWER")
  @RequireSection("recipes.cost")
  @ApiOperation({
    summary: "Calcular costo de receta (escandallo completo con mermas)",
  })
  @ApiParam({ name: "id", description: "ID de la receta" })
  @ApiResponse({
    status: 200,
    description: "Costo calculado exitosamente con breakdown",
  })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async calculateCost(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const costBreakdown = await this.recipesService.calculateRecipeCost(
      tenantId,
      id,
    );
    return {
      success: true,
      data: costBreakdown,
      message: "Recipe cost calculated successfully",
    };
  }

  @Post("upload-image")
  @Roles("ADMIN", "USER")
  @RequireSection("recipes.edit")
  @ApiOperation({ summary: "Subir imagen de receta" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Only jpg, png, and webp images are allowed",
      );
    }

    const imageUrl = await storeUploadedImage(this.bunny, "recipes", file);
    return {
      success: true,
      data: { imageUrl },
      message: "Image uploaded successfully",
    };
  }

  @Post(":id/duplicate-dismissals/:dismissedRecipeId")
  @Roles("ADMIN", "USER")
  @RequireSection("recipes.edit")
  @ApiOperation({
    summary:
      "Descartar el aviso de posible duplicado entre dos recetas (no vuelve a avisar en ninguna de las dos)",
  })
  @ApiParam({ name: "id", description: "ID de la receta que se está editando" })
  @ApiParam({
    name: "dismissedRecipeId",
    description: "ID de la receta marcada como no-duplicada",
  })
  @ApiResponse({ status: 201, description: "Descarte guardado" })
  async dismissDuplicate(
    @Param("id") id: string,
    @Param("dismissedRecipeId") dismissedRecipeId: string,
    @Req() req: any,
  ) {
    await this.recipesService.dismissDuplicate(
      req.tenantId,
      id,
      dismissedRecipeId,
    );
    return { success: true };
  }
}
