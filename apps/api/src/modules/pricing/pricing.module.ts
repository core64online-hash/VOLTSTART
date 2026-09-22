import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

// Phase 2: сегментні прайс-листи (B2C/B2B/B2G), знижки, валюти, ПДВ.
@Module({
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
