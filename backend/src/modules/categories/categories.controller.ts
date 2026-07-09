import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Query,
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/category.dto";
import { UpdateCategoryDto } from "./dto/category.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

@ApiTags("categories")
@ApiBearerAuth()
@Controller("api/v1/categories")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new category" })
  @ApiResponse({ status: 201, description: "Category created successfully" })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 403, description: "Permission denied" })
  @ApiResponse({ status: 409, description: "Conflict - slug already exists" })
  create(@Req() req: any, @Body() createCategoryDto: CreateCategoryDto) {
    const tenantId = req.tenantId;
    return this.categoriesService.create(tenantId, createCategoryDto);
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Get all categories for current tenant" })
  @ApiResponse({
    status: 200,
    description: "Categories retrieved successfully",
  })
  findAll(@Req() req: any, @Query("context") context?: string) {
    const tenantId = req.tenantId;
    const validContext =
      context === "articles" || context === "recipes" ? context : undefined;
    return this.categoriesService.findAll(tenantId, validContext);
  }

  @Get("tree")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Get category tree (hierarchical structure)" })
  @ApiResponse({
    status: 200,
    description: "Category tree retrieved successfully",
  })
  getTree(@Req() req: any, @Query("context") context?: string) {
    const tenantId = req.tenantId;
    const validContext =
      context === "articles" || context === "recipes" ? context : undefined;
    return this.categoriesService.getTree(tenantId, validContext);
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Get a specific category by ID" })
  @ApiResponse({ status: 200, description: "Category retrieved successfully" })
  @ApiResponse({ status: 404, description: "Category not found" })
  findOne(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    return this.categoriesService.findOne(tenantId, id);
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Update a category" })
  @ApiResponse({ status: 200, description: "Category updated successfully" })
  @ApiResponse({ status: 403, description: "Permission denied" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({ status: 409, description: "Conflict - slug already exists" })
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const tenantId = req.tenantId;
    return this.categoriesService.update(tenantId, id, updateCategoryDto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a category" })
  @ApiResponse({ status: 204, description: "Category deleted successfully" })
  @ApiResponse({ status: 403, description: "Permission denied" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({
    status: 409,
    description: "Conflict - category has products or recipes",
  })
  remove(@Req() req: any, @Param("id") id: string) {
    const tenantId = req.tenantId;
    return this.categoriesService.remove(tenantId, id);
  }
}
