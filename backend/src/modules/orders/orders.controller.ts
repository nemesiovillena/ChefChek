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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateOrderRequirementDto,
  CreateAutomatedOrderDto,
  UpdateOrderItemDto,
  ApproveOrderDto,
  SendOrderDto,
  ExportOrderDto,
} from './dto/orders.dto';

@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('calculate-requirements')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  async calculateRequirements(@Body() dto: CreateOrderRequirementDto) {
    return this.ordersService.calculateOrderRequirements(dto);
  }

  @Get('requirements')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async listRequirements(
    @Query('tenantId') tenantId: string,
    @Query('historicalPeriod') historicalPeriod?: number,
    @Query('lookaheadDays') lookaheadDays?: number,
  ) {
    return this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays,
    });
  }

  @Post('generate')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.CREATED)
  async generateOrder(@Body() dto: CreateAutomatedOrderDto) {
    return this.ordersService.createAutomatedOrder(dto);
  }

  @Get(':orderId')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getOrder(@Param('orderId') orderId: string) {
    return this.ordersService.getAutomatedOrder(orderId);
  }

  @Put(':orderId/items/:itemId')
  @Roles('ADMIN', 'USER')
  async updateOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateOrderItem(orderId, itemId, dto);
  }

  @Post(':orderId/approve')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  async approveOrder(
    @Param('orderId') orderId: string,
    @Body() dto: ApproveOrderDto,
  ) {
    return this.ordersService.approveOrder(orderId, dto);
  }

  @Post(':orderId/send')
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  async sendOrder(
    @Param('orderId') orderId: string,
    @Body() dto: SendOrderDto,
  ) {
    return this.ordersService.sendOrder(orderId, dto);
  }

  @Get('history')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getHistory(@Query('tenantId') tenantId: string) {
    return this.ordersService.getOrdersHistory(tenantId);
  }

  @Get('by-supplier/:supplierId')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getBySupplier(@Param('supplierId') supplierId: string) {
    return this.ordersService.getOrdersBySupplier(supplierId);
  }

  @Get('by-zone/:zone')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getByZone(@Param('zone') zone: string) {
    return this.ordersService.getOrdersByZone(zone);
  }

  @Get(':orderId/status')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getOrderStatus(@Param('orderId') orderId: string) {
    const order = await this.ordersService.getAutomatedOrder(orderId);
    return {
      orderId: order.id,
      status: order.status,
      urgency: order.urgency,
      scheduledDelivery: order.scheduledDelivery,
      sentAt: order.sentAt,
      receivedAt: order.receivedAt,
    };
  }

  @Get(':orderId/export/:format')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async exportOrder(
    @Param('orderId') orderId: string,
    @Param('format') format: 'PDF' | 'EXCEL',
    @Body() dto?: ExportOrderDto,
  ) {
    return this.ordersService.generatePurchaseTemplate(orderId, {
      format: format as any,
      recipientEmail: dto?.recipientEmail,
    });
  }

  @Get('classify/supplier')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async classifyBySupplier(
    @Query('tenantId') tenantId: string,
    @Query('historicalPeriod') historicalPeriod?: number,
  ) {
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyBySupplier(requirements);
  }

  @Get('classify/zone')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async classifyByZone(
    @Query('tenantId') tenantId: string,
    @Query('historicalPeriod') historicalPeriod?: number,
  ) {
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyByZone(requirements);
  }

  @Get('classify/category')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async classifyByCategory(
    @Query('tenantId') tenantId: string,
    @Query('historicalPeriod') historicalPeriod?: number,
  ) {
    const requirements = await this.ordersService.calculateOrderRequirements({
      tenantId,
      historicalPeriod,
      lookaheadDays: 7,
    });
    return this.ordersService.classifyByCategory(requirements);
  }

  @Get('suppliers/:supplierId/classification')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getSupplierClassification(@Param('supplierId') supplierId: string) {
    return this.ordersService.getSupplierClassification(supplierId);
  }

  @Get(':orderId/export/email')
  @Roles('ADMIN', 'USER')
  async exportOrderEmail(
    @Param('orderId') orderId: string,
    @Body() dto: ExportOrderDto,
  ) {
    const template = await this.ordersService.generatePurchaseTemplate(orderId, dto);
    return {
      template,
      message: 'Order template sent via email',
    };
  }
}