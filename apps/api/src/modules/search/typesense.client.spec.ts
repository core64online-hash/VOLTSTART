import { describe, expect, it, vi } from 'vitest';
import { TypesenseClient, TypesenseError } from './typesense.client';

function fakeFetch(status: number, body: string) {
  return vi.fn().mockResolvedValue({ ok: status < 400, status, text: async () => body });
}

describe('TypesenseClient', () => {
  it('додає API-ключ і коректний шлях; пошукові параметри — у query string', async () => {
    const fetchFn = fakeFetch(200, JSON.stringify({ found: 1, page: 1, hits: [{ document: { id: 'p1' } }] }));
    const client = new TypesenseClient({ baseUrl: 'http://ts:8108/', apiKey: 'KEY' }, fetchFn);
    const res = await client.search('products', { q: 'генератор', query_by: 'name', filter_by: 'inStock:=true', per_page: 5 });

    expect(res.hits[0].document).toEqual({ id: 'p1' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(init.headers['X-TYPESENSE-API-KEY']).toBe('KEY');
    const u = new URL(url);
    expect(u.pathname).toBe('/collections/products/documents/search');
    expect(u.searchParams.get('q')).toBe('генератор');
    expect(u.searchParams.get('filter_by')).toBe('inStock:=true');
    expect(u.searchParams.get('per_page')).toBe('5');
  });

  it('імпорт шле JSONL і збирає помилки окремих документів (Typesense відповідає 200)', async () => {
    const fetchFn = fakeFetch(200, '{"success":true}\n{"success":false,"error":"Bad field"}\n');
    const client = new TypesenseClient({ baseUrl: 'http://ts:8108', apiKey: 'K' }, fetchFn);
    const res = await client.importDocuments('products_1', [{ id: 'a' }, { id: 'b' }], 'create');

    expect(res).toEqual({ imported: 1, errors: ['Bad field'] });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://ts:8108/collections/products_1/documents/import?action=create');
    expect(init.headers['content-type']).toBe('text/plain');
    expect(init.body).toBe('{"id":"a"}\n{"id":"b"}');
  });

  it('порожній імпорт — без запиту', async () => {
    const fetchFn = fakeFetch(200, '');
    await new TypesenseClient({ baseUrl: 'http://ts', apiKey: 'K' }, fetchFn).importDocuments('c', []);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('відсутній аліас (404) — null, інші помилки — TypesenseError зі статусом', async () => {
    const missing = new TypesenseClient({ baseUrl: 'http://ts', apiKey: 'K' }, fakeFetch(404, '{"message":"Not found."}'));
    expect(await missing.getAlias('products')).toBeNull();

    const broken = new TypesenseClient({ baseUrl: 'http://ts', apiKey: 'K' }, fakeFetch(401, '{"message":"Forbidden - a valid `x-typesense-api-key` header must be sent."}'));
    await expect(broken.health()).rejects.toMatchObject({ status: 401, message: expect.stringContaining('Forbidden') });
    await expect(broken.health()).rejects.toBeInstanceOf(TypesenseError);
  });
});
