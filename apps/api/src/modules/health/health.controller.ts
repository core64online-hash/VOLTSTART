import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'voltstar-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
