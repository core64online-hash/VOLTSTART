import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';

// Phase 5: ліди, контакти/компанії, угоди-pipeline, задачі, активності, історія.
@Module({
  controllers: [CrmController],
})
export class CrmModule {}
