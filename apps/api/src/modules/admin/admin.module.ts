import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { SearchModule } from '../search/search.module';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminController } from './admin.controller';
import { AdminUsersService } from './admin-users.service';
import { AnalyticsService } from './analytics.service';

// Phase 6: back-office — каталог, ціни, залишки, користувачі, аналітика, аудит.
@Module({
  imports: [AccountsModule, SearchModule],
  controllers: [AdminController],
  providers: [AdminCatalogService, AdminUsersService, AnalyticsService],
})
export class AdminModule {}
