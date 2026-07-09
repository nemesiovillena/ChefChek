import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import {
  CreateOrderRequirementDto,
  CreateAutomatedOrderDto,
  UpdateOrderItemDto,
  ApproveOrderDto,
  SendOrderDto,
  ExportOrderDto,
} from "./dto/orders.dto";

@Controller("api/v1/orders")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("calculate-requirements")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  async calculateRequirements(
    @Req() req: any,
    @Body() dto: CreateOrderRequirementDto,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.calculateOrderRequirements({ ...dto, tenantId });
  }

  @Get("requirements")
  @Roles("ADMIN", "USER", "VIEWER")
  async listRequirements(
    @Req() req: any,
    @Query("historicalPeriod") historicalPeriod?: number,
    @Query("lookaheadDays") lookaheadDays?: number,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays,
    });
  }

  @Post("generate")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.CREATED)
  async generateOrder(@Req() req: any, @Body() dto: CreateAutomatedOrderDto) {
    const tenantId = req.tenantId;
    return this.ordersService.createAutomatedOrder({ ...dto, tenantId });
  }

  @Get(":orderId")
  @Roles("ADMIN", "USER", "VIEWER")
  async getOrder(@Req() req: any, @Param("orderId") orderId: string) {
    const tenantId = req.tenantId;
    return this.ordersService.getAutomatedOrder(tenantId, orderId);
  }

  @Put(":orderId/items/:itemId")
  @Roles("ADMIN", "USER")
  async updateOrderItem(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.updateOrderItem(tenantId, orderId, itemId, dto);
  }

  @Post(":orderId/approve")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  async approveOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() dto: ApproveOrderDto,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.approveOrder(tenantId, orderId, dto);
  }

  @Post(":orderId/send")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  async sendOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() dto: SendOrderDto,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.sendOrder(tenantId, orderId, dto);
  }

  @Get("history")
  @Roles("ADMIN", "USER", "VIEWER")
  async getHistory(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.ordersService.getOrdersHistory(tenantId);
  }

  @Get("by-supplier/:supplierId")
  @Roles("ADMIN", "USER", "VIEWER")
  async getBySupplier(
    @Req() req: any,
    @Param("supplierId") supplierId: string,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.getOrdersBySupplier(tenantId, supplierId);
  }

  @Get("by-zone/:zone")
  @Roles("ADMIN", "USER", "VIEWER")
  async getByZone(@Req() req: any, @Param("zone") zone: string) {
    const tenantId = req.tenantId;
    return this.ordersService.getOrdersByZone(tenantId, zone);
  }

  @Get(":orderId/status")
  @Roles("ADMIN", "USER", "VIEWER")
  async getOrderStatus(@Req() req: any, @Param("orderId") orderId: string) {
    const tenantId = req.tenantId;
    const order = await this.ordersService.getAutomatedOrder(tenantId, orderId);
    return {
      orderId: order.id,
      status: order.status,
      urgency: order.urgency,
      scheduledDelivery: order.scheduledDelivery,
      sentAt: order.sentAt,
      receivedAt: order.receivedAt,
    };
  }

  @Get(":orderId/export/:format")
  @Roles("ADMIN", "USER", "VIEWER")
  async exportOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Param("format") format: "PDF" | "EXCEL",
    @Body() dto?: ExportOrderDto,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.generatePurchaseTemplate(tenantId, orderId, {
      format: format as any,
      recipientEmail: dto?.recipientEmail,
    });
  }

  @Get("classify/supplier")
  @Roles("ADMIN", "USER", "VIEWER")
  async classifyBySupplier(
    @Req() req: any,
    @Query("historicalPeriod") historicalPeriod?: number,
  ) {
    const tenantId = req.tenantId;
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyBySupplier(requirements);
  }

  @Get("classify/zone")
  @Roles("ADMIN", "USER", "VIEWER")
  async classifyByZone(
    @Req() req: any,
    @Query("historicalPeriod") historicalPeriod?: number,
  ) {
    const tenantId = req.tenantId;
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyByZone(requirements);
  }

  @Get("classify/category")
  @Roles("ADMIN", "USER", "VIEWER")
  async classifyByCategory(
    @Req() req: any,
    @Query("historicalPeriod") historicalPeriod?: number,
  ) {
    const tenantId = req.tenantId;
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyByCategory(requirements);
  }

  @Get("suppliers/:supplierId/classification")
  @Roles("ADMIN", "USER", "VIEWER")
  async getSupplierClassification(
    @Req() req: any,
    @Param("supplierId") supplierId: string,
  ) {
    const tenantId = req.tenantId;
    return this.ordersService.getSupplierClassification(tenantId, supplierId);
  }

  @Get(":orderId/export/email")
  @Roles("ADMIN", "USER")
  async exportOrderEmail(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() dto: ExportOrderDto,
  ) {
    const tenantId = req.tenantId;
    const template = await this.ordersService.generatePurchaseTemplate(
      tenantId,
      orderId,
      dto,
    );
    return {
      template,
      message: "Order template sent via email",
    };
  }
}
