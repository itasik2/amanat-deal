import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.deals.create(dto);
  }

  @Get()
  list() {
    return this.deals.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.deals.get(id);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string) {
    return this.deals.accept(id);
  }

  @Post(':id/mock-payment')
  mockPayment(@Param('id') id: string) {
    return this.deals.mockPayment(id);
  }

  @Post(':id/shipment')
  shipment(@Param('id') id: string, @Body() body: { carrier?: string; trackingNumber?: string }) {
    return this.deals.markShipped(id, body);
  }

  @Post(':id/mark-delivered')
  markDelivered(@Param('id') id: string) {
    return this.deals.markDelivered(id);
  }

  @Post(':id/confirm-receipt')
  confirmReceipt(@Param('id') id: string) {
    return this.deals.complete(id, 'buyer_confirmed');
  }

  @Post(':id/report-problem')
  reportProblem(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.deals.reportProblem(id, body.reason);
  }

  @Get(':id/events')
  events(@Param('id') id: string) {
    return this.deals.events(id);
  }
}
