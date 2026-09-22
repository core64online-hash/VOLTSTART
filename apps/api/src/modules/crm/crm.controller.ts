import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('crm')
@Controller('crm')
export class CrmController {
  /** Заглушка. Phase 5: воронка угод (pipeline) та керування лідами. */
  @Get('deals')
  deals() {
    return { items: [], note: 'Phase 5: реалізація CRM' };
  }
}
