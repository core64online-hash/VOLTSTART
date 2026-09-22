import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SelectorModule } from './modules/selector/selector.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CartModule } from './modules/cart/cart.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CrmModule } from './modules/crm/crm.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    // Bounded contexts (скелети — наповнюються по фазах ROADMAP.md)
    CatalogModule,
    SelectorModule,
    PricingModule,
    AccountsModule,
    CartModule,
    PaymentsModule,
    OrdersModule,
    CrmModule,
    NotificationsModule,
  ],
})
export class AppModule {}
