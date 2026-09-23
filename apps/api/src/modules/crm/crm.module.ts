import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

// Phase 5: ліди, контакти/компанії, угоди-pipeline, задачі, активності, звʼязок із замовленнями.
@Module({
  imports: [AccountsModule, NotificationsModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
