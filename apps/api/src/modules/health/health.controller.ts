import { Controller, Get, Header, Headers, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { metrics } from '../../common/observability/metrics';
import { SkipRateLimit } from '../../common/security/rate-limit';
import { PrismaService } from '../../prisma/prisma.service';

const VERSION = process.env.APP_VERSION ?? 'dev';

const tokenMatches = (header: string | undefined, token: string) => {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

@ApiTags('health')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: процес живий (без звернень до залежностей). */
  @Get()
  check() {
    return { status: 'ok', service: 'voltstar-api', version: VERSION, timestamp: new Date().toISOString() };
  }

  /** Readiness: готовий приймати трафік — база даних відповідає. Для балансувальника й деплою. */
  @Get('ready')
  async ready() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      throw new ServiceUnavailableException({ status: 'unavailable', database: (e as Error).message.slice(0, 200) });
    }
    return { status: 'ready', version: VERSION, database: { ok: true, latencyMs: Date.now() - started } };
  }
}

/**
 * Метрики Prometheus. Зовні закриті на рівні reverse-proxy; якщо задано METRICS_TOKEN —
 * додатково потрібен заголовок `Authorization: Bearer <token>`.
 */
@SkipRateLimit()
@Controller('metrics')
export class MetricsController {
  @Get()
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  render(@Headers('authorization') auth?: string): string {
    const token = process.env.METRICS_TOKEN;
    // У production без токена метрики не віддаємо взагалі (на випадок, якщо proxy їх не закриває).
    if (!token && process.env.NODE_ENV === 'production') throw new NotFoundException();
    if (token && !tokenMatches(auth, token)) throw new NotFoundException();
    return metrics.render();
  }
}
