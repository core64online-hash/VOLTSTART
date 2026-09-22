import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenService } from '../../common/auth/token.service';

// Phase 2: Auth (реєстрація/логін), ролі RBAC, організації, верифікація ЄДРПОУ/VAT.
@Module({
  controllers: [AccountsController],
  providers: [AccountsService, TokenService, JwtAuthGuard, RolesGuard],
  exports: [AccountsService, TokenService],
})
export class AccountsModule {}
