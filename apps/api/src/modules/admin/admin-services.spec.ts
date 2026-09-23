import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SearchService } from '../search/search.service';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService.setRole', () => {
  const user = (role: string) => ({
    id: 'u2',
    email: 'u@x.ua',
    firstName: null,
    lastName: null,
    phone: null,
    role,
    organization: null,
    _count: { orders: 0 },
    createdAt: new Date(),
  });
  function setup(role: string, admins = 2) {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => (role ? { role } : null)),
        count: vi.fn(async () => admins),
        update: vi.fn(async ({ data }: { data: { role: string } }) => user(data.role)),
      },
    };
    return { svc: new AdminUsersService(prisma as unknown as PrismaService), prisma };
  }

  it('призначає роль', async () => {
    const { svc } = setup('CUSTOMER');
    await expect(svc.setRole('u2', 'MANAGER', 'admin')).resolves.toMatchObject({ role: 'MANAGER' });
  });

  it('власну роль змінити не можна; неіснуючий користувач — 404', async () => {
    await expect(setup('ADMIN').svc.setRole('me', 'CUSTOMER', 'me')).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup('').svc.setRole('u2', 'MANAGER', 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('останнього адміністратора не можна понизити', async () => {
    const { svc, prisma } = setup('ADMIN', 1);
    await expect(svc.setRole('u2', 'MANAGER', 'admin')).rejects.toThrow(/останнього/);
    expect(prisma.user.update).not.toHaveBeenCalled();
    await expect(setup('ADMIN', 2).svc.setRole('u2', 'MANAGER', 'admin')).resolves.toMatchObject({ role: 'MANAGER' });
  });
});

describe('AdminCatalogService', () => {
  const row = {
    id: 'p1',
    slug: 'gp3300',
    name: 'GP3300',
    description: null,
    brand: { id: 'b1', name: 'Generac' },
    category: { id: 'c1', name: 'Резервні' },
    fuel: 'PETROL',
    phase: 'SINGLE',
    ratedPowerW: 3000,
    maxPowerW: 3300,
    images: [],
    specs: [],
    inventory: { quantity: 4 },
    prices: [],
    updatedAt: new Date(),
  };
  function setup() {
    const prisma = {
      product: {
        findUnique: vi.fn(async () => row),
        create: vi.fn(async () => {
          throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
        }),
        update: vi.fn(async () => row),
      },
      brand: { findUnique: vi.fn(async () => ({ id: 'b1' })) },
      category: { findUnique: vi.fn(async () => ({ id: 'c1' })) },
      inventoryItem: { upsert: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const search = { syncProducts: vi.fn(async () => undefined) };
    const svc = new AdminCatalogService(prisma as unknown as PrismaService, search as unknown as SearchService);
    return { svc, prisma, search };
  }
  const input = {
    slug: 'gp3300',
    name: 'GP3300',
    brandId: 'b1',
    categoryId: 'c1',
    fuel: 'PETROL' as const,
    phase: 'SINGLE' as const,
    ratedPowerW: 3000,
    maxPowerW: 3300,
    images: [],
    specs: [],
    stock: 0,
  };

  it('зайнятий slug → 409 із поясненням', async () => {
    await expect(setup().svc.create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('редагування: пікова потужність не менша за номінальну з урахуванням поточних значень', async () => {
    const { svc, prisma } = setup();
    await expect(svc.update('p1', { maxPowerW: 2000 })).rejects.toThrow(/Пікова/);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('невідомий бренд → 400', async () => {
    const { svc, prisma } = setup();
    prisma.brand.findUnique.mockResolvedValueOnce(null as never);
    await expect(svc.update('p1', { brandId: 'nope' })).rejects.toThrow(/Бренд/);
  });

  it('зміна залишку синхронізує пошуковий індекс', async () => {
    const { svc, prisma, search } = setup();
    await svc.setStock('p1', 7);
    expect(prisma.inventoryItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { quantity: 7 } }));
    expect(search.syncProducts).toHaveBeenCalledWith(['p1']);
  });
});
