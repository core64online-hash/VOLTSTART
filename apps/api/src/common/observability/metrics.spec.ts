import { describe, expect, it } from 'vitest';
import { MetricsRegistry, metricsMiddleware } from './metrics';

describe('MetricsRegistry', () => {
  it('рахує запити за шаблоном маршруту і статусом, будує кумулятивну гістограму', () => {
    const m = new MetricsRegistry({ version: '1.2.3', commit: 'abc' });
    m.observe('GET', '/api/catalog/products/:slug', 200, 0.03);
    m.observe('GET', '/api/catalog/products/:slug', 200, 0.3);
    m.observe('GET', '/api/catalog/products/:slug', 404, 0.004);
    const text = m.render();
    expect(text).toContain('voltstar_build_info{commit="abc",version="1.2.3"} 1');
    expect(text).toContain('http_requests_total{method="GET",route="/api/catalog/products/:slug",status="200"} 2');
    expect(text).toContain('http_requests_total{method="GET",route="/api/catalog/products/:slug",status="404"} 1');
    const series = '{method="GET",route="/api/catalog/products/:slug"';
    expect(text).toContain(`http_request_duration_seconds_bucket${series},le="0.005"} 1`);
    expect(text).toContain(`http_request_duration_seconds_bucket${series},le="0.05"} 2`);
    expect(text).toContain(`http_request_duration_seconds_bucket${series},le="+Inf"} 3`);
    expect(text).toContain(`http_request_duration_seconds_count${series}} 3`);
    expect(text).toMatch(/# TYPE http_request_duration_seconds histogram/);
  });

  it('екранує лапки в мітках', () => {
    const m = new MetricsRegistry({ version: 'x"y', commit: 'c' });
    expect(m.render()).toContain('version="x\\"y"');
  });

  it('middleware бере шаблон маршруту; без збігу — «unmatched»', () => {
    const m = new MetricsRegistry({ version: 'v', commit: 'c' });
    const run = (req: Record<string, unknown>, status: number) => {
      let finish = () => {};
      metricsMiddleware(m)(req as never, { statusCode: status, on: (_e: 'finish', cb: () => void) => (finish = cb) }, () => {});
      finish();
    };
    run({ method: 'GET', baseUrl: '/api/catalog', route: { path: '/products/:slug' } }, 200);
    run({ method: 'GET', url: '/api/nope' }, 404);
    const text = m.render();
    expect(text).toContain('route="/api/catalog/products/:slug",status="200"} 1');
    expect(text).toContain('route="unmatched",status="404"} 1');
  });
});
