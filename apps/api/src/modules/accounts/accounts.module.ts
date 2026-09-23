import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PrivacyService } from './privacy.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenService } from '../../common/auth/token.service';

// Phase 2: Auth (реєстрація/логін), ролі RBAC, організації, верифікація ЄДРПОУ/VAT.
// Phase 4: скидання паролю через email.
// Phase 7: права субʼєкта даних — вивантаження й видалення акаунта.
@Module({
  imports: [NotificationsModule],
  controllers: [AccountsController],
  providers: [AccountsService, PrivacyService, TokenService, JwtAuthGuard, RolesGuard],
  exports: [AccountsService, TokenService],
})
export class AccountsModule {}
