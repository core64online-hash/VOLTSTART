import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipRateLimit } from '../../common/security/rate-limit';

@ApiTags('health')
@SkipRateLimit()
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
