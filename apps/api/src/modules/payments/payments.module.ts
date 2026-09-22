import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsModule } from '../accounts/accounts.module';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { buildProviders, PAYMENT_PROVIDERS } from './providers';

// Phase 3: WayForPay/LiqPay + Stripe + оплата за рахунком за PaymentProvider, вебхуки, звірка.
@Module({
  imports: [AccountsModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_PROVIDERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildProviders((key) => config.get<string>(key)),
    },
    PaymentProviderRegistry,
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
