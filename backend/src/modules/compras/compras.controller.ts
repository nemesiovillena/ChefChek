import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { LocationsService } from "./services/locations.service";
import { PurchaseListService } from "./services/purchase-list.service";
import { PurchaseOrderService } from "./services/purchase-order.service";
import { PurchaseOrderStatusService } from "./services/purchase-order-status.service";
import { PurchaseOrderPdfService } from "./services/purchase-order-pdf.service";
import { OrderSendingService } from "./services/order-sending.service";
import { OrderReconciliationService } from "./services/order-reconciliation.service";
import { InvoiceService } from "./services/invoice.service";
import { MailService } from "../mail/mail.service";
import { CreateLocationDto, UpdateLocationDto } from "./dto/location.dto";
import { SendOrderDto } from "./dto/send-order.dto";
import { SmtpConfigDto, SmtpTestDto } from "../mail/dto/smtp-config.dto";
import { CreateInvoiceDto, InvoicesQueryDto } from "./dto/invoice.dto";
import {
  CreatePurchaseListDto,
  GenerateOrderDto,
  UpdatePurchaseListDto,
} from "./dto/purchase-list.dto";
import {
  CreatePurchaseOrderDto,
  PurchaseOrdersQueryDto,
  TransitionPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "./dto/purchase-order.dto";
import { Roles } from "../../decorators/roles.decorator";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";

@ApiTags("Compras")
@ApiBearerAuth()
@Controller("api/v1/compras")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("compras")
export class ComprasController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly purchaseListService: PurchaseListService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly purchaseOrderStatusService: PurchaseOrderStatusService,
    private readonly purchaseOrderPdfService: PurchaseOrderPdfService,
    private readonly orderSendingService: OrderSendingService,
    private readonly orderReconciliationService: OrderReconciliationService,
    private readonly invoiceService: InvoiceService,
    private readonly mailService: MailService,
  ) {}

  // ── Configuración SMTP del tenant (envío de pedidos por email) ──

  @Get("smtp")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Configuración SMTP (nunca devuelve el password)" })
  async getSmtpConfig(@Req() req: any) {
    const data = await this.mailService.getPublicConfig(req.tenantId);
    return { success: true, data };
  }

  @Put("smtp")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Guardar configuración SMTP (password cifrado)" })
  async saveSmtpConfig(@Req() req: any, @Body() dto: SmtpConfigDto) {
    const data = await this.mailService.saveConfig(
      req.tenantId,
      dto,
      req.user?.id,
    );
    return { success: true, data };
  }

  @Post("smtp/test")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Enviar email de prueba con la config guardada" })
  async testSmtp(@Req() req: any, @Body() dto: SmtpTestDto) {
    const data = await this.mailService.sendTest(req.tenantId, dto.to);
    return { success: true, data };
  }

  // ── Listas de compra (checklist por proveedor) ──

  @Get("listas")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar listas de compra" })
  async findAllLists(@Req() req: any) {
    const data = await this.purchaseListService.findAll(req.tenantId);
    return { success: true, data };
  }

  @Post("listas")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear lista de compra" })
  async createList(@Req() req: any, @Body() dto: CreatePurchaseListDto) {
    const data = await this.purchaseListService.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Get("listas/:id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Detalle de una lista de compra" })
  async findOneList(@Req() req: any, @Param("id") id: string) {
    const data = await this.purchaseListService.findOne(req.tenantId, id);
    return { success: true, data };
  }

  @Patch("listas/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar lista (items reemplaza el checklist)" })
  async updateList(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseListDto,
  ) {
    const data = await this.purchaseListService.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Delete("listas/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar (soft) una lista de compra" })
  async removeList(@Req() req: any, @Param("id") id: string) {
    const data = await this.purchaseListService.remove(req.tenantId, id);
    return { success: true, data };
  }

  @Post("listas/:id/generar-pedido")
  @Roles("ADMIN", "USER")
  @ApiOperation({
    summary:
      "Generar pedido BORRADOR desde la lista (cantidades sugeridas por stock mín/máx si no se envía selección)",
  })
  async generateOrderFromList(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: GenerateOrderDto,
  ) {
    const data = await this.purchaseListService.generateOrder(
      req.tenantId,
      id,
      req.user?.id,
      dto,
    );
    return { success: true, data };
  }

  // ── Pedidos de compra ──

  @Get("pedidos")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar pedidos (paginado y filtrable)" })
  async findAllOrders(@Req() req: any, @Query() query: PurchaseOrdersQueryDto) {
    return this.purchaseOrderService.findAll(req.tenantId, query);
  }

  @Post("pedidos")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear pedido manual (BORRADOR)" })
  async createOrder(@Req() req: any, @Body() dto: CreatePurchaseOrderDto) {
    const data = await this.purchaseOrderService.create(
      req.tenantId,
      req.user?.id,
      dto,
    );
    return { success: true, data };
  }

  @Get("pedidos/pendientes-recepcion")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary:
      "Pedidos enviados/parciales de un proveedor cercanos a una fecha, para vincular un albarán",
  })
  async findPendingReception(
    @Req() req: any,
    @Query("supplierId") supplierId: string,
    @Query("date") date?: string,
  ) {
    const data = await this.orderReconciliationService.suggestOrders(
      req.tenantId,
      supplierId,
      date ? new Date(date) : undefined,
    );
    return { success: true, data };
  }

  @Get("pedidos/:id")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Detalle de pedido con líneas y eventos" })
  async findOneOrder(@Req() req: any, @Param("id") id: string) {
    const data = await this.purchaseOrderService.findOne(req.tenantId, id);
    return { success: true, data };
  }

  @Get("pedidos/:id/envio")
  @Roles("ADMIN", "USER")
  @ApiOperation({
    summary: "Vista previa de envío: texto, canales del proveedor y wa.me",
  })
  async getSendPreview(@Req() req: any, @Param("id") id: string) {
    const data = await this.orderSendingService.getSendPreview(
      req.tenantId,
      id,
    );
    return { success: true, data };
  }

  @Post("pedidos/:id/enviar")
  @Roles("ADMIN", "USER")
  @ApiOperation({
    summary:
      "Enviar pedido: EMAIL envía vía SMTP con PDF adjunto; WHATSAPP/PHONE/WEB registran el envío manual",
  })
  @ApiResponse({ status: 400, description: "Canal no admitido o SMTP fallido" })
  async sendOrder(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: SendOrderDto,
  ) {
    const data = await this.orderSendingService.send(
      req.tenantId,
      id,
      req.user?.id,
      dto.channel,
    );
    return { success: true, data };
  }

  @Get("pedidos/:id/pdf")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "PDF del pedido" })
  async getOrderPdf(@Req() req: any, @Param("id") id: string, @Res() res: any) {
    const order = await this.purchaseOrderService.findOne(req.tenantId, id);
    const pdf = await this.purchaseOrderPdfService.generate(req.tenantId, id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.orderNumber}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.send(pdf);
  }

  @Patch("pedidos/:id/estado")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Transicionar estado del pedido" })
  @ApiResponse({ status: 400, description: "Transición no válida" })
  async transitionOrder(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: TransitionPurchaseOrderDto,
  ) {
    const data = await this.purchaseOrderStatusService.transition(
      req.tenantId,
      id,
      dto.status,
      req.user?.id,
    );
    return { success: true, data };
  }

  @Patch("pedidos/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Editar pedido (solo BORRADOR)" })
  @ApiResponse({ status: 400, description: "Solo BORRADOR es editable" })
  async updateOrder(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    const data = await this.purchaseOrderService.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Delete("pedidos/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar (soft) pedido BORRADOR o CANCELADO" })
  @ApiResponse({ status: 400, description: "Estado no eliminable" })
  async removeOrder(@Req() req: any, @Param("id") id: string) {
    const data = await this.purchaseOrderService.remove(req.tenantId, id);
    return { success: true, data };
  }

  // ── Facturas (registro mínimo, enlazado a albarán/pedido) ──

  @Get("facturas")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar facturas (filtrable por albarán o pedido)" })
  async findAllInvoices(@Req() req: any, @Query() query: InvoicesQueryDto) {
    const data = await this.invoiceService.findAll(req.tenantId, query);
    return { success: true, data };
  }

  @Post("facturas")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Registrar factura mínima" })
  async createInvoice(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    const data = await this.invoiceService.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Delete("facturas/:id")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Eliminar (soft) una factura" })
  async removeInvoice(@Req() req: any, @Param("id") id: string) {
    const data = await this.invoiceService.remove(req.tenantId, id);
    return { success: true, data };
  }

  // ── Locales (multi-local) ──

  @Get("locales")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar locales del tenant" })
  @ApiResponse({ status: 200, description: "Listado de locales" })
  async findAllLocations(@Req() req: any) {
    const data = await this.locationsService.findAll(req.tenantId);
    return { success: true, data };
  }

  @Post("locales")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Crear un local" })
  @ApiResponse({ status: 201, description: "Local creado" })
  async createLocation(@Req() req: any, @Body() dto: CreateLocationDto) {
    const data = await this.locationsService.create(req.tenantId, dto);
    return { success: true, data };
  }

  @Patch("locales/:id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Actualizar un local" })
  @ApiResponse({ status: 200, description: "Local actualizado" })
  @ApiResponse({ status: 404, description: "Local no encontrado" })
  async updateLocation(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const data = await this.locationsService.update(req.tenantId, id, dto);
    return { success: true, data };
  }

  @Delete("locales/:id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar (soft) un local no predeterminado" })
  @ApiResponse({ status: 200, description: "Local eliminado" })
  @ApiResponse({
    status: 400,
    description: "El local por defecto no puede eliminarse",
  })
  async removeLocation(@Req() req: any, @Param("id") id: string) {
    const data = await this.locationsService.remove(req.tenantId, id);
    return { success: true, data };
  }
}
