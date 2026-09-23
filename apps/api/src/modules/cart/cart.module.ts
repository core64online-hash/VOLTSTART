import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CrmModule } from '../crm/crm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { SearchModule } from '../search/search.module';
import { CartController, CheckoutController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';

// Phase 3: кошик, розрахунок вартості/ПДВ/доставки, checkout із гілкуванням за сегментом.
@Module({
  imports: [AccountsModule, PricingModule, PaymentsModule, NotificationsModule, SearchModule, CrmModule],
  controllers: [CartController, CheckoutController],
  providers: [CartService, CheckoutService],
})
export class CartModule {}
