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
import * as fs from "fs";
import * as path from "path";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { RecipesService } from "./recipes.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Recipes")
@Controller("api/v1/recipes")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @Roles("ADMIN", "USER")
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
  async findAll(
    @Req() req: any,
    @Query() query: { search?: string; category?: string },
  ) {
    const tenantId = req.tenantId;
    const recipes = await this.recipesService.findAll(tenantId, query);
    return {
      success: true,
      data: recipes,
      message: "Recipes retrieved successfully",
    };
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener una receta por ID" })
  @ApiParam({ name: "id", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Receta encontrada" })
  @ApiResponse({ status: 404, description: "Receta no encontrada" })
  async findOne(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    const recipe = await this.recipesService.findOne(tenantId, id);
    return {
      success: true,
      data: recipe,
      message: "Recipe retrieved successfully",
    };
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
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

    const uploadsDir = path.join(process.cwd(), "uploads", "recipes");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const imageUrl = `/uploads/recipes/${fileName}`;
    return {
      success: true,
      data: { imageUrl },
      message: "Image uploaded successfully",
    };
  }
}
