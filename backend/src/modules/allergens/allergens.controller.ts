import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AllergensService } from "./allergens.service";
import {
  UpdateProductAllergensDto,
  AllergenComplianceReportDto,
  CreateAllergenDto,
  UpdateAllergenDto,
} from "./dto/allergens.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

@Controller("api/v1/allergens")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AllergensController {
  constructor(private readonly allergensService: AllergensService) {}

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  async listAllergens(@Req() req: any) {
    const tenantId = req.tenantId;
    const data = await this.allergensService.findAll(tenantId);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @Roles("ADMIN", "USER")
  async createAllergen(@Body() dto: CreateAllergenDto) {
    const data = await this.allergensService.create(dto);
    return {
      success: true,
      data,
    };
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
  async updateAllergen(
    @Param("id") id: string,
    @Body() dto: UpdateAllergenDto,
  ) {
    const data = await this.allergensService.update(Number(id), dto);
    return {
      success: true,
      data,
    };
  }

  @Get("info")
  async getAllergensInfo() {
    const allergensInfo = await this.allergensService.getAllergensInfo();
    return {
      success: true,
      data: allergensInfo,
    };
  }

  @Put("products/:productId")
  @Roles("ADMIN", "USER")
  async updateProductAllergens(
    @Req() req: any,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductAllergensDto,
  ) {
    const tenantId = req.tenantId;
    const result = await this.allergensService.updateProductAllergens(
      tenantId,
      productId,
      dto,
    );
    return result;
  }

  @Post("recipes/:recipeId/calculate")
  @Roles("ADMIN", "USER")
  async calculateRecipeAllergens(
    @Req() req: any,
    @Param("recipeId") recipeId: string,
  ) {
    const tenantId = req.tenantId;
    const allergens = await this.allergensService.calculateRecipeAllergens(
      tenantId,
      recipeId,
    );
    return {
      success: true,
      data: {
        recipeId,
        allergens,
      },
    };
  }

  @Post("menus/:menuId/calculate")
  @Roles("ADMIN", "USER")
  async calculateMenuAllergens(
    @Req() req: any,
    @Param("menuId") menuId: string,
  ) {
    const tenantId = req.tenantId;
    const allergens = await this.allergensService.calculateMenuAllergens(
      tenantId,
      menuId,
    );
    return {
      success: true,
      data: {
        menuId,
        allergens,
      },
    };
  }

  @Post("menus/:menuId/conflicts")
  @Roles("ADMIN", "USER", "VIEWER")
  async detectAllergenConflicts(
    @Req() req: any,
    @Param("menuId") menuId: string,
    @Body() body: { filteredAllergens: number[] },
  ) {
    const tenantId = req.tenantId;
    const conflicts = await this.allergensService.detectAllergenConflicts(
      tenantId,
      menuId,
      body.filteredAllergens,
    );
    return {
      success: true,
      data: {
        menuId,
        filteredAllergens: body.filteredAllergens,
        conflicts,
      },
    };
  }

  @Get("menus/:menuId/compliance")
  @Roles("ADMIN", "USER", "VIEWER")
  async getComplianceReport(
    @Req() req: any,
    @Param("menuId") menuId: string,
    @Body() body?: { reportType?: "FULL" | "SUMMARY" },
  ) {
    const tenantId = req.tenantId;
    const reportType = body?.reportType || "FULL";
    const report = await this.allergensService.generateComplianceReport(
      tenantId,
      menuId,
      reportType,
    );
    return {
      success: true,
      data: report,
    };
  }

  @Get("products")
  @Roles("ADMIN", "USER", "VIEWER")
  async getProductsWithAllergens(@Req() req: any) {
    const tenantId = req.tenantId;
    const allProducts = await this.allergensService.getProductsWithAllergens(
      tenantId,
      [],
    );
    return {
      success: true,
      data: allProducts,
    };
  }

  @Get("products/by-allergens/:allergenIds")
  @Roles("ADMIN", "USER", "VIEWER")
  async getProductsWithSpecificAllergens(
    @Req() req: any,
    @Param("allergenIds") allergenIds: string,
  ) {
    const tenantId = req.tenantId;
    const ids = allergenIds.split(",").map((id) => parseInt(id));
    const products = await this.allergensService.getProductsWithAllergens(
      tenantId,
      ids,
    );
    return {
      success: true,
      data: {
        allergenIds: ids,
        products,
      },
    };
  }

  @Get("recipes")
  @Roles("ADMIN", "USER", "VIEWER")
  async getRecipesWithAllergens(@Req() req: any) {
    const tenantId = req.tenantId;
    const allRecipes = await this.allergensService.getRecipesWithAllergens(
      tenantId,
      [],
    );
    return {
      success: true,
      data: allRecipes,
    };
  }

  @Get("recipes/by-allergens/:allergenIds")
  @Roles("ADMIN", "USER", "VIEWER")
  async getRecipesWithSpecificAllergens(
    @Req() req: any,
    @Param("allergenIds") allergenIds: string,
  ) {
    const tenantId = req.tenantId;
    const ids = allergenIds.split(",").map((id) => parseInt(id));
    const recipes = await this.allergensService.getRecipesWithAllergens(
      tenantId,
      ids,
    );
    return {
      success: true,
      data: {
        allergenIds: ids,
        recipes,
      },
    };
  }

  @Get("menus")
  @Roles("ADMIN", "USER", "VIEWER")
  async getMenusWithAllergens(@Req() req: any) {
    const tenantId = req.tenantId;
    const allMenus = await this.allergensService.getMenusWithAllergens(
      tenantId,
      [],
    );
    return {
      success: true,
      data: allMenus,
    };
  }

  @Get("menus/by-allergens/:allergenIds")
  @Roles("ADMIN", "USER", "VIEWER")
  async getMenusWithSpecificAllergens(
    @Req() req: any,
    @Param("allergenIds") allergenIds: string,
  ) {
    const tenantId = req.tenantId;
    const ids = allergenIds.split(",").map((id) => parseInt(id));
    const menus = await this.allergensService.getMenusWithAllergens(
      tenantId,
      ids,
    );
    return {
      success: true,
      data: {
        allergenIds: ids,
        menus,
      },
    };
  }

  @Post("recalculate-all")
  @Roles("ADMIN")
  async recalculateAllAllergensForTenant(@Req() req: any) {
    const tenantId = req.tenantId;
    const result =
      await this.allergensService.recalculateAllAllergensForTenant(tenantId);
    return result;
  }
}
