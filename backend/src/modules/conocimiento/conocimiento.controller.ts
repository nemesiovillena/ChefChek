import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ConocimientoService } from "./conocimiento.service";
import {
  CreateKnowledgeCategoryDto,
  UpdateKnowledgeCategoryDto,
  CreateKnowledgeArticleDto,
  UpdateKnowledgeArticleDto,
  PublishArticleDto,
  CreateKnowledgeTagDto,
  UpdateKnowledgeTagDto,
  KnowledgeQueryDto,
  RestoreVersionDto,
} from "./dto/conocimiento.dto";

@Controller("conocimiento")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ConocimientoController {
  constructor(private readonly conocimientoService: ConocimientoService) {}

  // Categorías
  @Post("categorias")
  async createCategory(
    @Req() req: any,
    @Body() dto: CreateKnowledgeCategoryDto,
  ) {
    return await this.conocimientoService.createCategory(req.tenantId, dto);
  }

  @Get("categorias")
  async getCategories(@Req() req: any, @Query("parentId") parentId?: string) {
    return await this.conocimientoService.getCategories(req.tenantId, parentId);
  }

  @Get("categorias/arbol")
  async getCategoryTree(@Req() req: any) {
    return await this.conocimientoService.getCategoryTree(req.tenantId);
  }

  @Put("categorias/:id")
  async updateCategory(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeCategoryDto,
  ) {
    return await this.conocimientoService.updateCategory(id, req.tenantId, dto);
  }

  @Delete("categorias/:id")
  async deleteCategory(@Req() req: any, @Param("id") id: string) {
    return await this.conocimientoService.deleteCategory(id, req.tenantId);
  }

  // Artículos
  @Post("articulos")
  async createArticle(@Req() req: any, @Body() dto: CreateKnowledgeArticleDto) {
    return await this.conocimientoService.createArticle(
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  @Get("articulos")
  async getArticles(@Req() req: any, @Query() query: KnowledgeQueryDto) {
    return await this.conocimientoService.getArticles(req.tenantId, query);
  }

  @Get("articulos/:id")
  async getArticleById(@Req() req: any, @Param("id") id: string) {
    return await this.conocimientoService.getArticleById(id, req.tenantId);
  }

  @Put("articulos/:id")
  async updateArticle(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    return await this.conocimientoService.updateArticle(
      id,
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  @Post("articulos/:id/publicar")
  async publishArticle(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: PublishArticleDto,
  ) {
    return await this.conocimientoService.publishArticle(
      id,
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  @Delete("articulos/:id")
  async deleteArticle(@Req() req: any, @Param("id") id: string) {
    return await this.conocimientoService.deleteArticle(id, req.tenantId);
  }

  @Get("articulos/:id/versiones")
  async getArticleVersions(@Req() req: any, @Param("id") id: string) {
    return await this.conocimientoService.getArticleVersions(id, req.tenantId);
  }

  @Post("versiones/:versionId/restaurar")
  async restoreArticleVersion(
    @Req() req: any,
    @Param("versionId") versionId: string,
    @Body() dto: RestoreVersionDto,
  ) {
    return await this.conocimientoService.restoreArticleVersion(
      versionId,
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  // Tags
  @Post("tags")
  async createTag(@Req() req: any, @Body() dto: CreateKnowledgeTagDto) {
    return await this.conocimientoService.createTag(req.tenantId, dto);
  }

  @Get("tags")
  async getTags(@Req() req: any) {
    return await this.conocimientoService.getTags(req.tenantId);
  }

  @Put("tags/:id")
  async updateTag(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeTagDto,
  ) {
    return await this.conocimientoService.updateTag(id, req.tenantId, dto);
  }

  @Delete("tags/:id")
  async deleteTag(@Req() req: any, @Param("id") id: string) {
    return await this.conocimientoService.deleteTag(id, req.tenantId);
  }
}
