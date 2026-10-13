import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  RequireSection,
} from "../../guards/section-access.guard";
import { Roles } from "../../decorators/roles.decorator";
import { CreateRecipeCaptureDto } from "./dto/create-recipe-capture.dto";
import { UpdateCaptureIngredientDto } from "./dto/update-capture-ingredient.dto";
import { RecipeCapturePromotionService } from "./recipe-capture-promotion.service";
import { RecipeCaptureService } from "./recipe-capture.service";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Cada alta es una llamada de pago a la IA: límite más estricto que el global.
const CREATE_THROTTLE = { default: { limit: 10, ttl: 60000 } };

/**
 * Las capturas son siempre de un tenant. Un SUPERADMIN supera los guards
 * aunque no esté en @Roles y llega sin tenant: el servicio lo rechaza
 * (`assertTenant`) antes de consultar nada.
 */
@ApiTags("Captura de recetas")
@Controller("api/v1/recipe-captures")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("captura-recetas")
@RequireSection("captura-recetas")
@Roles("ADMIN", "OWNER", "USER")
export class RecipeCaptureController {
  constructor(
    private readonly captureService: RecipeCaptureService,
    private readonly promotionService: RecipeCapturePromotionService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    const data = await this.captureService.findAll(req.tenantId);
    return { success: true, data };
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    const data = await this.captureService.findOne(req.tenantId, id);
    return { success: true, data };
  }

  @Post()
  @Throttle(CREATE_THROTTLE)
  async create(@Req() req: any, @Body() dto: CreateRecipeCaptureDto) {
    const data =
      dto.source === "URL"
        ? await this.captureService.createFromUrl(
            req.tenantId,
            req.user?.id,
            dto.url as string,
          )
        : await this.captureService.createFromText(
            req.tenantId,
            req.user?.id,
            dto.text as string,
          );
    return { success: true, data };
  }

  @Post("upload")
  @Throttle(CREATE_THROTTLE)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  async upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No se ha subido ningún archivo");
    }
    const data = await this.captureService.createFromFile(
      req.tenantId,
      req.user?.id,
      {
        buffer: file.buffer,
        // multer entrega el nombre en latin1; los navegadores lo envían en UTF-8.
        filename: Buffer.from(file.originalname, "latin1").toString("utf8"),
        mimetype: file.mimetype,
      },
    );
    return { success: true, data };
  }

  @Patch(":id/ingredients/:ingredientId")
  async updateIngredient(
    @Req() req: any,
    @Param("id") id: string,
    @Param("ingredientId") ingredientId: string,
    @Body() dto: UpdateCaptureIngredientDto,
  ) {
    const data = await this.captureService.updateIngredient(
      req.tenantId,
      id,
      ingredientId,
      dto.matchedProductId,
    );
    return { success: true, data };
  }

  /** Crea la receta real a partir de la captura. Repetir la llamada no la duplica. */
  @Post(":id/promote")
  @HttpCode(HttpStatus.OK)
  @RequireSection("recipes.edit")
  async promote(@Req() req: any, @Param("id") id: string) {
    const data = await this.promotionService.promote(
      req.tenantId,
      req.user?.role,
      id,
    );
    return { success: true, data };
  }

  /** Reintenta una captura que quedó en ERROR desde su fuente original. */
  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @Throttle(CREATE_THROTTLE)
  async retry(@Req() req: any, @Param("id") id: string) {
    const data = await this.captureService.retry(req.tenantId, id);
    return { success: true, data };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@Req() req: any, @Param("id") id: string) {
    await this.captureService.discard(req.tenantId, id);
  }
}
