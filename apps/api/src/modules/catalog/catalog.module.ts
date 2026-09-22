import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

// Phase 1: каталог (Prisma) + пошук через Typesense із резервним Postgres.
@Module({
  imports: [SearchModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
