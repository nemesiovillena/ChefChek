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
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { WarehousesService } from "./almacenes.service";
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateStockMovementDto,
  StockDto,
  CreateInventoryDto,
  InventoryItemDto,
  StockQueryDto,
} from "./dto/almacenes.dto";

@ApiTags("Almacenes")
@Controller("almacenes")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("almacenes")
export class AlmacenesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  // Gestión de Almacenes
  @Post()
  @ApiOperation({ summary: "Crear un nuevo almacén" })
  @ApiResponse({ status: 201, description: "Almacén creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  async createWarehouse(@Req() req: any, @Body() dto: CreateWarehouseDto) {
    return await this.warehousesService.createWarehouse(req.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar todos los almacenes del tenant" })
  @ApiResponse({ status: 200, description: "Lista de almacenes" })
  async getWarehouses(@Req() req: any) {
    return await this.warehousesService.getWarehouses(req.tenantId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener un almacén por ID" })
  @ApiParam({ name: "id", description: "ID del almacén" })
  @ApiResponse({ status: 200, description: "Almacén encontrado" })
  @ApiResponse({ status: 404, description: "Almacén no encontrado" })
  async getWarehouseById(@Req() req: any, @Param("id") id: string) {
    return await this.warehousesService.getWarehouseById(id, req.tenantId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Actualizar un almacén" })
  @ApiParam({ name: "id", description: "ID del almacén" })
  @ApiResponse({ status: 200, description: "Almacén actualizado exitosamente" })
  @ApiResponse({ status: 404, description: "Almacén no encontrado" })
  async updateWarehouse(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return await this.warehousesService.updateWarehouse(id, req.tenantId, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un almacén" })
  @ApiParam({ name: "id", description: "ID del almacén" })
  @ApiResponse({ status: 204, description: "Almacén eliminado exitosamente" })
  async deleteWarehouse(@Req() req: any, @Param("id") id: string) {
    return await this.warehousesService.deleteWarehouse(id, req.tenantId);
  }

  // Control de Stock
  @Get("stock/consulta")
  @ApiOperation({ summary: "Consultar stock con filtros" })
  @ApiResponse({ status: 200, description: "Stock consultado exitosamente" })
  async getStock(@Req() req: any, @Query() query: StockQueryDto) {
    return await this.warehousesService.getStock(req.tenantId, query);
  }

  @Put("stock/actualizar")
  @ApiOperation({ summary: "Actualizar stock manualmente" })
  @ApiResponse({ status: 200, description: "Stock actualizado exitosamente" })
  async updateStock(@Req() req: any, @Body() dto: StockDto) {
    return await this.warehousesService.updateStock(req.tenantId, dto);
  }

  @Post("stock/reservar")
  @ApiOperation({ summary: "Reservar stock para pedido" })
  @ApiResponse({ status: 200, description: "Stock reservado exitosamente" })
  async reserveStock(
    @Req() req: any,
    @Body() body: { productId: string; quantity: number; warehouseId?: string },
  ) {
    return await this.warehousesService.reserveStock(
      req.tenantId,
      body.productId,
      body.quantity,
      body.warehouseId,
    );
  }

  @Post("stock/liberar")
  @ApiOperation({ summary: "Liberar stock reservado" })
  @ApiResponse({ status: 200, description: "Stock liberado exitosamente" })
  async releaseStock(
    @Req() req: any,
    @Body() body: { stockId: string; quantity: number },
  ) {
    return await this.warehousesService.releaseStock(
      req.tenantId,
      body.stockId,
      body.quantity,
    );
  }

  // Movimientos de Stock
  @Post("movimientos")
  @ApiOperation({
    summary: "Crear movimiento de stock (entrada/salida/ajuste)",
  })
  @ApiResponse({ status: 201, description: "Movimiento creado exitosamente" })
  async createStockMovement(
    @Req() req: any,
    @Body() dto: CreateStockMovementDto,
  ) {
    return await this.warehousesService.createStockMovement(req.tenantId, dto);
  }

  @Get("movimientos/historial")
  @ApiOperation({ summary: "Consultar historial de movimientos" })
  @ApiResponse({ status: 200, description: "Historial de movimientos" })
  async getStockMovements(
    @Req() req: any,
    @Query("productId") productId?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("type") type?: string,
    @Query("startDate") startDate?: Date,
    @Query("endDate") endDate?: Date,
  ) {
    return await this.warehousesService.getStockMovements(req.tenantId, {
      productId,
      warehouseId,
      type,
      startDate,
      endDate,
    });
  }

  @Get("movimientos/rango-fechas")
  @ApiOperation({ summary: "Consultar movimientos por rango de fechas" })
  @ApiResponse({ status: 200, description: "Movimientos en rango de fechas" })
  async getStockMovementsByDateRange(
    @Req() req: any,
    @Query("startDate") startDate: Date,
    @Query("endDate") endDate: Date,
  ) {
    return await this.warehousesService.getStockMovementsByDateRange(
      req.tenantId,
      startDate,
      endDate,
    );
  }

  // Inventarios
  @Post("inventarios")
  @ApiOperation({ summary: "Crear inventario físico" })
  @ApiResponse({ status: 201, description: "Inventario creado exitosamente" })
  async createInventory(@Req() req: any, @Body() dto: CreateInventoryDto) {
    return await this.warehousesService.createInventory(req.tenantId, dto);
  }

  @Get("inventarios")
  @ApiOperation({ summary: "Listar todos los inventarios" })
  @ApiResponse({ status: 200, description: "Lista de inventarios" })
  async getInventories(@Req() req: any) {
    return await this.warehousesService.getInventories(req.tenantId);
  }

  @Post("inventarios/:id/items")
  @ApiOperation({ summary: "Agregar item a inventario físico" })
  @ApiParam({ name: "id", description: "ID del inventario" })
  @ApiResponse({ status: 201, description: "Item agregado exitosamente" })
  async addInventoryItem(
    @Req() req: any,
    @Param("id") inventoryId: string,
    @Body() dto: InventoryItemDto,
  ) {
    return await this.warehousesService.addInventoryItem(
      inventoryId,
      req.tenantId,
      dto,
    );
  }

  @Put("inventarios/items/:itemId")
  @ApiOperation({ summary: "Actualizar item de inventario físico" })
  @ApiParam({ name: "itemId", description: "ID del item de inventario" })
  @ApiResponse({ status: 200, description: "Item actualizado exitosamente" })
  async updateInventoryItem(
    @Req() req: any,
    @Param("itemId") itemId: string,
    @Body() body: { quantity: number; notes?: string; condition?: string },
  ) {
    return await this.warehousesService.updateInventoryItem(
      itemId,
      req.tenantId,
      body.quantity,
      body.notes,
      body.condition,
    );
  }

  @Post("inventarios/:id/completar")
  @ApiOperation({
    summary: "Completar inventario físico y generar diferencias",
  })
  @ApiParam({ name: "id", description: "ID del inventario" })
  @ApiResponse({
    status: 200,
    description: "Inventario completado exitosamente",
  })
  async completeInventory(@Req() req: any, @Param("id") inventoryId: string) {
    return await this.warehousesService.completeInventory(
      inventoryId,
      req.tenantId,
    );
  }
}
