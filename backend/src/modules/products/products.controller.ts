import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";
import { Roles } from "../../decorators/roles.decorator";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import * as fs from "fs";
import * as path from "path";

@ApiTags("Products")
@Controller("api/v1/products")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
  async getSuppliers(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productsService.getSuppliers(tenantId);
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
}
