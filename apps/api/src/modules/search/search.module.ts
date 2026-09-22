import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// Пошук каталогу через Typesense (з резервним Postgres у CatalogService).
@Module({
  imports: [AccountsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
