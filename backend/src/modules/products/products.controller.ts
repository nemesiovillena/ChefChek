import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProductsService } from "./products.service";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";
import {
  CreateProductSupplierOfferDto,
  UpdateProductSupplierOfferDto,
} from "./dto/product-supplier-offer.dto";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";
import {
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from "./dto/unit-of-measure.dto";
import { Roles } from "../../decorators/roles.decorator";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import * as fs from "fs";
import * as path from "path";

@ApiTags("Products")
@Controller("api/v1/products")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("articulos")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
  ) {}

  @Post()
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear un nuevo producto" })
  @ApiResponse({ status: 201, description: "Producto creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  async create(@Body() createProductDto: CreateProductDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.create(createProductDto, tenantId);
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todos los productos del tenant" })
  @ApiResponse({ status: 200, description: "Lista de productos" })
  async findAll(@Query() query: ProductsQueryDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.findAll(query, tenantId);
  }

  // Debe ir ANTES de @Get(":id") para que NestJS no lo captura como id.
  // Advisory-only: devuelve artículos activos del tenant cuyo nombre coincide
  // ignorando mayúsculas/espacios/acentos. No bloquea la creación.
  @Get("check-name")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary: "Comprobar artículos con nombre similar (accent-insensitive)",
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
    const matches = await this.productsService.findNameMatches(
      req.tenantId,
      (name ?? "").trim(),
      excludeId,
    );
    return { success: true, data: matches };
  }

  @Get("categories")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener todas las categorías de productos" })
  @ApiResponse({ status: 200, description: "Lista de categorías" })
  async getCategories(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getCategories(tenantId);
  }

  @Get("suppliers")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener todos los proveedores" })
  @ApiResponse({ status: 200, description: "Lista de proveedores" })
  async getSuppliers(
    @Query("search") search: string,
    @Query("isActive") isActive: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const isActiveFilter =
      isActive === undefined ? undefined : isActive === "true";
    return this.productsService.getSuppliers(tenantId, search, isActiveFilter);
  }

  // ─── Units of Measure ─────────────────────────────────────────

  @Get("units")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar unidades de medida del tenant" })
  @ApiResponse({ status: 200, description: "Lista de unidades" })
  async getUnits(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getUnits(tenantId);
  }

  @Post("units")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear unidad de medida" })
  @ApiResponse({ status: 201, description: "Unidad creada" })
  async createUnit(@Body() dto: CreateUnitOfMeasureDto, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.createUnit(dto, tenantId);
  }

  @Patch("units/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar unidad de medida" })
  @ApiParam({ name: "id", description: "ID de la unidad" })
  async updateUnit(
    @Param("id") id: string,
    @Body() dto: UpdateUnitOfMeasureDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.updateUnit(id, dto, tenantId);
  }

  @Delete("units/:id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar (desactivar) unidad de medida" })
  @ApiParam({ name: "id", description: "ID de la unidad" })
  async deleteUnit(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.deleteUnit(id, tenantId);
  }

  @Post("suppliers")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear un nuevo proveedor" })
  @ApiResponse({ status: 201, description: "Proveedor creado" })
  async createSupplier(@Req() req: any, @Body() body: CreateSupplierDto) {
    const tenantId = req.tenantId;
    if (!body.name?.trim()) {
      throw new BadRequestException("El nombre del proveedor es obligatorio");
    }
    return this.productsService.createSupplier(tenantId, body);
  }

  @Post("upload-image")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Subir imagen de ficha técnica o etiqueta" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No se proporcionó archivo");
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        "Tipo de archivo no permitido. Use JPEG, PNG, WebP o GIF",
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads", "products");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const url = `/uploads/products/${fileName}`;
    return {
      success: true,
      data: { url },
      message: "Imagen subida correctamente",
    };
  }

  // ─── Product Price History ─────────────────────────────────────

  @Get("price-history")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Consultar historial de precios de un producto" })
  async getProductPriceHistory(
    @Query("productId") productId: string,
    @Query("supplierId") supplierId: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    if (!productId) {
      throw new BadRequestException("productId es obligatorio");
    }
    return this.productsService.getProductPriceHistory(
      productId,
      tenantId,
      supplierId,
    );
  }

  @Get(":id/calculate")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Calcular costo de producto (incluye mermas)" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Costo calculado exitosamente" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async calculateCost(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.calculateProductCost(id, tenantId);
  }

  // Advisory pre-borrado: recetas/escandallos vivos que usan este artículo.
  // No bloquea el borrado; el frontend lo muestra como aviso en el diálogo.
  @Get(":id/usage")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary: "Recetas/escandallos que usan este artículo (aviso pre-borrado)",
  })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({
    status: 200,
    description: "{ count, recipes: [{ id, name }] }",
  })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async getUsage(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const data = await this.productsService.getUsage(id, tenantId);
    return { success: true, data };
  }

  // ─── Ofertas de proveedor por artículo ──────────────────────────

  @Get(":id/supplier-offers")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar ofertas de proveedor de un artículo" })
  @ApiParam({ name: "id", description: "ID del producto" })
  async listSupplierOffers(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const data = await this.productSupplierOffersService.listOffers(
      id,
      tenantId,
    );
    return { success: true, data, message: "Ofertas obtenidas" };
  }

  @Post(":id/supplier-offers")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear/actualizar la oferta de un proveedor" })
  @ApiParam({ name: "id", description: "ID del producto" })
  async createSupplierOffer(
    @Param("id") id: string,
    @Body() body: CreateProductSupplierOfferDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const { supplierId, ...data } = body;
    const offer = await this.productSupplierOffersService.upsertOffer(
      id,
      supplierId,
      tenantId,
      data,
    );
    return { success: true, data: offer, message: "Oferta guardada" };
  }

  @Patch(":id/supplier-offers/:offerId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar precio/formato de una oferta" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiParam({ name: "offerId", description: "ID de la oferta" })
  async updateSupplierOffer(
    @Param("id") id: string,
    @Param("offerId") offerId: string,
    @Body() body: UpdateProductSupplierOfferDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const offers = await this.productSupplierOffersService.listOffers(
      id,
      tenantId,
    );
    const existing = offers.find((o) => o.id === offerId);
    if (!existing) {
      throw new BadRequestException("Oferta no encontrada");
    }
    const offer = await this.productSupplierOffersService.upsertOffer(
      id,
      existing.supplierId,
      tenantId,
      body,
    );
    return { success: true, data: offer, message: "Oferta actualizada" };
  }

  @Delete(":id/supplier-offers/:offerId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar una oferta de proveedor" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiParam({ name: "offerId", description: "ID de la oferta" })
  async deleteSupplierOffer(
    @Param("offerId") offerId: string,
    @Query("promoteOfferId") promoteOfferId: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    await this.productSupplierOffersService.removeOffer(
      offerId,
      tenantId,
      promoteOfferId,
    );
    return { success: true, data: null, message: "Oferta eliminada" };
  }

  @Post(":id/supplier-offers/:offerId/set-preferred")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Marcar una oferta como preferente" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiParam({ name: "offerId", description: "ID de la oferta" })
  async setPreferredSupplierOffer(
    @Param("id") id: string,
    @Param("offerId") offerId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const offer = await this.productSupplierOffersService.setPreferred(
      id,
      offerId,
      tenantId,
    );
    return {
      success: true,
      data: offer,
      message: "Oferta marcada como preferente",
    };
  }

  @Get(":id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener un producto por ID" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Producto encontrado" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async findOne(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.findOne(id, tenantId);
  }

  @Patch(":id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar un producto" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({
    status: 200,
    description: "Producto actualizado exitosamente",
  })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.update(id, updateProductDto, tenantId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar un producto" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 204, description: "Producto eliminado exitosamente" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async remove(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.remove(id, tenantId);
  }

  @Post(":id/merge/:targetId")
  @Roles("ADMIN", "USER")
  @ApiOperation({
    summary:
      "Fusionar un artículo duplicado (:id) en otro (:targetId); el origen queda dado de baja",
  })
  @ApiParam({ name: "id", description: "ID del artículo origen (desaparece)" })
  @ApiParam({
    name: "targetId",
    description: "ID del artículo destino (sobrevive)",
  })
  @ApiResponse({
    status: 201,
    description: "Artículos fusionados exitosamente",
  })
  @ApiResponse({ status: 400, description: "IDs iguales" })
  @ApiResponse({
    status: 404,
    description: "Artículo origen o destino no encontrado",
  })
  async merge(
    @Param("id") id: string,
    @Param("targetId") targetId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.merge(id, targetId, tenantId);
  }

  @Get("suppliers/stats/active-count")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Contador de proveedores activos" })
  @ApiResponse({ status: 200, description: "Contador de proveedores activos" })
  async getSuppliersStats(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getSuppliersStats(tenantId);
  }

  @Get("suppliers/:id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener proveedor por ID" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor encontrado" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  async getSupplierById(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getSupplierById(id, tenantId);
  }

  @Put("suppliers/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor actualizado" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  async updateSupplier(
    @Param("id") id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.updateSupplier(id, updateSupplierDto, tenantId);
  }

  @Delete("suppliers/:id")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor eliminado" })
  @ApiResponse({ status: 403, description: "Permiso denegado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  async deleteSupplier(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.deleteSupplier(id, tenantId);
  }

  @Get("suppliers/:id/products")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Productos del proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Lista de productos" })
  async getSupplierProducts(
    @Param("id") id: string,
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.tenantId;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    return this.productsService.getSupplierProducts(
      id,
      tenantId,
      pageNum,
      limitNum,
    );
  }

  @Get("suppliers/:id/price-trend")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Tendencia de precio del proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Tendencia de precio" })
  async getSupplierPriceTrend(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getSupplierPriceTrend(id, tenantId);
  }

  @Get("suppliers/:id/price-history")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Histórico de precios del proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Lista de registros de precio" })
  async getSupplierPriceHistory(
    @Param("id") id: string,
    @Req() req: any,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.tenantId;
    const limitNum = limit ? parseInt(limit) : 30;
    return this.productsService.getSupplierPriceHistory(id, tenantId, limitNum);
  }

  @Get("stock-status/count")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Resumen alertas de stock" })
  @ApiResponse({ status: 200, description: "Contadores de alertas" })
  async getStockAlertsCount(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getStockAlertsCount(tenantId);
  }

  // Categories extras endpoints
  @Get("categories/:id/product-count")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Contador de productos en categoría" })
  @ApiParam({ name: "id", description: "ID de la categoría" })
  @ApiResponse({ status: 200, description: "Contador de productos" })
  async getCategoryProductCount(
    @Param("id") categoryId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.getCategoryProductCount(categoryId, tenantId);
  }

  @Post("categories/reorder")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Reordenar categorías" })
  @ApiResponse({ status: 200, description: "Categorías reordenadas" })
  async reorderCategories(
    @Body()
    body: {
      updates: Array<{ id: string; sortOrder: number; parentId?: string }>;
    },
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.reorderCategories(body.updates, tenantId);
  }

  @Patch("categories/:id/toggle-active")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Toggle estado activo de categoría" })
  @ApiParam({ name: "id", description: "ID de la categoría" })
  @ApiResponse({ status: 200, description: "Categoría actualizada" })
  async toggleCategoryActive(@Param("id") categoryId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.toggleCategoryActive(categoryId, tenantId);
  }

  @Get("suppliers/:id/products/count")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Contar productos de un proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Número de productos" })
  async getSupplierProductCount(
    @Param("id") supplierId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.getSupplierProductCount(supplierId, tenantId);
  }

  @Put("suppliers/:id/products/reassign")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Reasignar productos de un proveedor a otro" })
  @ApiParam({ name: "id", description: "ID del proveedor origen" })
  @ApiResponse({ status: 200, description: "Productos reasignados" })
  async reassignSupplierProducts(
    @Param("id") supplierId: string,
    @Body() body: { targetSupplierId: string },
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.productsService.reassignSupplierProducts(
      supplierId,
      body.targetSupplierId,
      tenantId,
    );
  }

  @Post("bulk")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear múltiples productos en lote (importación)" })
  @ApiResponse({ status: 201, description: "Productos creados exitosamente" })
  async createBulk(@Body() body: { products: any[] }, @Req() req: any) {
    const tenantId = req.tenantId;
    if (!body.products || !Array.isArray(body.products)) {
      throw new BadRequestException(
        "El cuerpo debe contener un array 'products'",
      );
    }
    return this.productsService.createBulk(body.products, tenantId);
  }
}
