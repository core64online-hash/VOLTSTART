import { describe, expect, it } from 'vitest';
import type { CatalogQuery } from '@voltstar/types';
import { buildFilterBy, buildSearchParams, toProductDocument } from './product-document';

const base: CatalogQuery = { page: 1, perPage: 24 };

describe('toProductDocument', () => {
  it('мапить товар у документ індексу; наявність — з залишку', () => {
    const doc = toProductDocument({
      id: 'p1',
      slug: 'generac-gp3300',
      name: 'Generac GP3300',
      description: null,
      brand: { name: 'Generac', slug: 'generac' },
      category: { slug: 'backup' },
      fuel: 'PETROL',
      phase: 'SINGLE',
      ratedPowerW: 3300,
      maxPowerW: 4000,
      inventory: { quantity: 0 },
    });
    expect(doc).toEqual({
      id: 'p1',
      slug: 'generac-gp3300',
      name: 'Generac GP3300',
      brand: 'Generac',
      brandSlug: 'generac',
      categorySlug: 'backup',
      fuel: 'PETROL',
      phase: 'SINGLE',
      ratedPowerW: 3300,
      maxPowerW: 4000,
      inStock: false,
    });
    expect(doc).not.toHaveProperty('description');
  });
});

describe('buildFilterBy', () => {
  it('без фільтрів — undefined', () => {
    expect(buildFilterBy(base)).toBeUndefined();
  });

  it('усі фільтри каталогу → синтаксис Typesense з екрануванням рядків', () => {
    expect(
      buildFilterBy({ ...base, brand: ['generac', 'könner & söhnen'], fuel: ['PETROL', 'DIESEL'], phase: 'THREE', minPowerW: 2000, maxPowerW: 8000.7, inStock: true }),
    ).toBe(
      'brandSlug:=[`generac`,`könner & söhnen`] && fuel:=[`PETROL`,`DIESEL`] && phase:=`THREE` && ratedPowerW:>=2000 && ratedPowerW:<=8000 && inStock:=true',
    );
  });

  it('зворотні лапки у значенні не ламають фільтр (ін’єкція в filter_by)', () => {
    expect(buildFilterBy({ ...base, brand: ['x` || inStock:=false'] })).toBe('brandSlug:=[`x || inStock:=false`]');
  });
});

describe('buildSearchParams', () => {
  it('без тексту — усі документи, сортування за потужністю (як у Postgres)', () => {
    expect(buildSearchParams({ ...base, page: 2, perPage: 12 })).toMatchObject({
      q: '*',
      sort_by: 'ratedPowerW:asc',
      page: 2,
      per_page: 12,
    });
  });

  it('з текстом — релевантність, потім потужність; пошук за назвою, брендом, описом', () => {
    expect(buildSearchParams({ ...base, q: '  генератр  ' })).toMatchObject({
      q: 'генератр',
      query_by: 'name,brand,description',
      sort_by: '_text_match:desc,ratedPowerW:asc',
    });
  });
});
