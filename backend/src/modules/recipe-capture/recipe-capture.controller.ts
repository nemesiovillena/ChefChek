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
import { RecipeCaptureService } from "./recipe-capture.service";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Cada alta es una llamada de pago a la IA: límite más estricto que el global.
const CREATE_THROTTLE = { default: { limit: 10, ttl: 60000 } };

/**
 * Sin SUPERADMIN: ese rol no pertenece a ningún tenant y las capturas son
 * siempre de un tenant concreto.
 */
@ApiTags("Captura de recetas")
@Controller("api/v1/recipe-captures")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)
@RequireModule("captura-recetas")
@RequireSection("captura-recetas")
@Roles("ADMIN", "OWNER", "USER")
export class RecipeCaptureController {
  constructor(private readonly captureService: RecipeCaptureService) {}

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
        filename: file.originalname,
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

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@Req() req: any, @Param("id") id: string) {
    await this.captureService.discard(req.tenantId, id);
  }
}
