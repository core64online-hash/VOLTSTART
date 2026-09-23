import { monitorEventLoopDelay } from 'node:perf_hooks';

/**
 * Мінімальний реєстр метрик у текстовому форматі Prometheus (0.0.4) без залежностей.
 * Мітки маршрутів — шаблони (`/api/catalog/products/:slug`), а не сирі шляхи, щоб
 * кількість часових рядів лишалась обмеженою.
 */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

type Labels = Record<string, string>;
const key = (l: Labels) =>
  Object.keys(l)
    .sort()
    .map((k) => `${k}="${String(l[k]).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
    .join(',');

export class MetricsRegistry {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, { buckets: number[]; sum: number; count: number }>();
  private readonly loop = monitorEventLoopDelay({ resolution: 20 });
  private readonly startedAt = Date.now();

  constructor(private readonly info: { version: string; commit: string }) {
    this.loop.enable();
  }

  /** Облік одного HTTP-запиту. */
  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    const k = key(labels);
    this.requests.set(k, (this.requests.get(k) ?? 0) + 1);
    const dk = key({ method, route });
    const d = this.durations.get(dk) ?? { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 };
    BUCKETS.forEach((b, i) => {
      if (seconds <= b) d.buckets[i] += 1;
    });
    d.sum += seconds;
    d.count += 1;
    this.durations.set(dk, d);
  }

  render(): string {
    const out: string[] = [];
    const mem = process.memoryUsage();
    out.push('# HELP voltstar_build_info Версія застосунку.', '# TYPE voltstar_build_info gauge');
    out.push(`voltstar_build_info{${key(this.info)}} 1`);
    out.push('# HELP process_uptime_seconds Час роботи процесу.', '# TYPE process_uptime_seconds gauge');
    out.push(`process_uptime_seconds ${((Date.now() - this.startedAt) / 1000).toFixed(0)}`);
    out.push('# HELP process_resident_memory_bytes Резидентна памʼять.', '# TYPE process_resident_memory_bytes gauge');
    out.push(`process_resident_memory_bytes ${mem.rss}`);
    out.push('# HELP nodejs_heap_used_bytes Використана купа V8.', '# TYPE nodejs_heap_used_bytes gauge');
    out.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
    out.push('# HELP nodejs_eventloop_lag_p99_seconds Затримка event loop (p99).', '# TYPE nodejs_eventloop_lag_p99_seconds gauge');
    out.push(`nodejs_eventloop_lag_p99_seconds ${(this.loop.percentile(99) / 1e9).toFixed(6)}`);

    out.push('# HELP http_requests_total Кількість HTTP-запитів.', '# TYPE http_requests_total counter');
    for (const [k, v] of this.requests) out.push(`http_requests_total{${k}} ${v}`);
    out.push('# HELP http_request_duration_seconds Тривалість HTTP-запитів.', '# TYPE http_request_duration_seconds histogram');
    for (const [k, d] of this.durations) {
      BUCKETS.forEach((b, i) => out.push(`http_request_duration_seconds_bucket{${k},le="${b}"} ${d.buckets[i]}`));
      out.push(`http_request_duration_seconds_bucket{${k},le="+Inf"} ${d.count}`);
      out.push(`http_request_duration_seconds_sum{${k}} ${d.sum.toFixed(6)}`);
      out.push(`http_request_duration_seconds_count{${k}} ${d.count}`);
    }
    return `${out.join('\n')}\n`;
  }
}

export const metrics = new MetricsRegistry({
  version: process.env.APP_VERSION ?? 'dev',
  commit: process.env.APP_COMMIT ?? 'unknown',
});

type Req = { method: string; baseUrl?: string; route?: { path?: string } };
type Res = { statusCode: number; on(event: 'finish', cb: () => void): void };

/** Express-middleware: вимірює кожен запит; маршрут беремо з шаблону після маршрутизації. */
export function metricsMiddleware(registry: MetricsRegistry = metrics) {
  return (req: Req, res: Res, next: () => void): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : 'unmatched';
      registry.observe(req.method, route, res.statusCode, Number(process.hrtime.bigint() - start) / 1e9);
    });
    next();
  };
}
