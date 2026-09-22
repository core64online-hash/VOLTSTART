import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';

// Phase 4: PDF-документи замовлення (рахунок-фактура, видаткова накладна).
@Module({
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
