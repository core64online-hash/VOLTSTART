import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PriceQuerySchema } from '@voltstar/types';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Ціна з розкладкою ПДВ для товару в сегменті/валюті. */
  @Get('quote')
  quote(@Query() q: Record<string, unknown>) {
    const query = PriceQuerySchema.parse({
      productId: q.productId ? String(q.productId) : '',
      segment: q.segment ? String(q.segment) : undefined,
      currency: q.currency ? String(q.currency) : undefined,
      quantity: q.quantity != null && q.quantity !== '' ? Number(q.quantity) : undefined,
    });
    return this.pricing.quote(query);
  }
}
