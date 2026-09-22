import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service';

const row = (id: string, ratedPowerW: number) => ({
  id,
  slug: id,
  name: `Gen ${id}`,
  brand: { name: 'B', slug: 'b' },
  category: { slug: 'c' },
  specs: [],
  inventory: { quantity: 1 },
  prices: [],
  fuel: 'PETROL',
  phase: 'SINGLE',
  ratedPowerW,
  maxPowerW: ratedPowerW + 500,
  images: [],
});

function setup(search: { enabled: boolean; searchProductIds?: () => Promise<{ ids: string[]; total: number }> }) {
  const prisma = {
    product: {
      findMany: vi.fn(async (args: { where?: { id?: { in: string[] } } }) =>
        args.where?.id ? [row('b', 2000), row('a', 1000)] : [row('db', 500)],
      ),
      count: vi.fn(async () => 1),
    },
  };
  const warn = vi.fn();
  const service = new CatalogService(prisma as never, { ...search, warn } as never);
  return { service, prisma, warn };
}

const query = { q: 'gen', page: 1, perPage: 24 };

describe('CatalogService.list', () => {
  it('з Typesense: порядок — як у пошуку, total — з пошуку', async () => {
    const { service } = setup({ enabled: true, searchProductIds: async () => ({ ids: ['a', 'b', 'gone'], total: 3 }) });
    const res = await service.list(query);
    expect(res.items.map((p) => p.id)).toEqual(['a', 'b']); // 'gone' видалено з БД — пропускаємо
    expect(res.total).toBe(3);
  });

  it('Typesense недоступний — прозорий перехід на Postgres із попередженням', async () => {
    const { service, warn } = setup({ enabled: true, searchProductIds: async () => Promise.reject(new Error('ECONNREFUSED')) });
    const res = await service.list(query);
    expect(res.items.map((p) => p.id)).toEqual(['db']);
    expect(warn).toHaveBeenCalledWith('ECONNREFUSED');
  });

  it('Typesense не налаштований — одразу Postgres', async () => {
    const { service, prisma } = setup({ enabled: false });
    const res = await service.list(query);
    expect(res.items.map((p) => p.id)).toEqual(['db']);
    expect(prisma.product.count).toHaveBeenCalled();
  });
});
