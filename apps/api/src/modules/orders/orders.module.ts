import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CrmModule } from '../crm/crm.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// Phase 4: замовлення — історія, машина станів, документи, сповіщення.
@Module({
  imports: [AccountsModule, DocumentsModule, NotificationsModule, SearchModule, CrmModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
