import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminProduct,
  AdminProductInput,
  AdminProductUpdate,
  CatalogRefs,
  Page,
  SetPriceInput,
} from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';

const productInclude = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  specs: { orderBy: { id: 'asc' } },
  inventory: true,
  prices: { include: { priceList: true }, orderBy: { priceList: { segment: 'asc' } } },
} satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Керування каталогом з адмін-панелі: товари, характеристики, ціни за прайс-листами, залишки.
 * Після кожної зміни товар синхронізується з пошуковим індексом (best effort).
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {}

  async refs(): Promise<CatalogRefs> {
    const [brands, categories, priceLists] = await Promise.all([
      this.prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.priceList.findMany({
        select: { id: true, name: true, segment: true, currency: true, active: true },
        orderBy: [{ segment: 'asc' }, { currency: 'asc' }],
      }),
    ]);
    return { brands, categories, priceLists };
  }

  async list(q: { q?: string; page: number; perPage: number }): Promise<Page<AdminProduct>> {
    const where: Prisma.ProductWhereInput = q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { slug: { contains: q.q, mode: 'insensitive' } },
            { brand: { name: { contains: q.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ brand: { name: 'asc' } }, { ratedPowerW: 'asc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: rows.map(toAdminProduct), total, page: q.page, perPage: q.perPage };
  }

  async get(id: string): Promise<AdminProduct> {
    return toAdminProduct(await this.load(id));
  }

  async create(input: AdminProductInput): Promise<AdminProduct> {
    await this.assertRefs(input.brandId, input.categoryId);
    const { specs, stock, ...fields } = input;
    const product = await this.unique(() =>
      this.prisma.product.create({
        data: {
          ...fields,
          description: fields.description || null,
          specs: { create: specs },
          inventory: { create: { quantity: stock } },
        },
      }),
    );
    return this.afterChange(product.id);
  }

  async update(id: string, input: AdminProductUpdate): Promise<AdminProduct> {
    const current = await this.load(id);
    const rated = input.ratedPowerW ?? current.ratedPowerW;
    const max = input.maxPowerW ?? current.maxPowerW;
    if (max < rated) throw new BadRequestException('Пікова потужність не може бути меншою за номінальну');
    await this.assertRefs(input.brandId, input.categoryId);
    const { specs, ...fields } = input;
    await this.unique(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: fields });
        if (specs) {
          await tx.productSpec.deleteMany({ where: { productId: id } });
          await tx.productSpec.createMany({ data: specs.map((s) => ({ ...s, productId: id })) });
        }
      }),
    );
    return this.afterChange(id);
  }

  async setPrice(productId: string, priceListId: string, input: SetPriceInput): Promise<AdminProduct> {
    await this.load(productId);
    const list = await this.prisma.priceList.findUnique({ where: { id: priceListId } });
    if (!list) throw new NotFoundException('Прайс-лист не знайдено');
    await this.prisma.price.upsert({
      where: { productId_priceListId: { productId, priceListId } },
      create: { productId, priceListId, amountMinor: input.amountMinor, vatRate: input.vatRate },
      update: { amountMinor: input.amountMinor, vatRate: input.vatRate },
    });
    return this.afterChange(productId);
  }

  /** Знімає ціну з прайс-листа — у цьому сегменті/валюті товар стає недоступним для купівлі. */
  async removePrice(productId: string, priceListId: string): Promise<AdminProduct> {
    await this.load(productId);
    await this.prisma.price.deleteMany({ where: { productId, priceListId } });
    return this.afterChange(productId);
  }

  async setStock(productId: string, quantity: number): Promise<AdminProduct> {
    await this.load(productId);
    await this.prisma.inventoryItem.upsert({
      where: { productId },
      create: { productId, quantity },
      update: { quantity },
    });
    return this.afterChange(productId);
  }

  private async afterChange(id: string): Promise<AdminProduct> {
    await this.search.syncProducts([id]);
    return this.get(id);
  }

  private async load(id: string): Promise<ProductRow> {
    const p = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!p) throw new NotFoundException('Товар не знайдено');
    return p;
  }

  private async assertRefs(brandId?: string, categoryId?: string): Promise<void> {
    const [brand, category] = await Promise.all([
      brandId ? this.prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }) : true,
      categoryId ? this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }) : true,
    ]);
    if (!brand) throw new BadRequestException('Бренд не знайдено');
    if (!category) throw new BadRequestException('Категорію не знайдено');
  }

  /** Унікальний slug: конфлікт Prisma P2002 → 409 зі зрозумілим повідомленням. */
  private async unique<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Товар із таким slug уже існує');
      }
      throw e;
    }
  }
}

export function toAdminProduct(p: ProductRow): AdminProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    fuel: p.fuel,
    phase: p.phase,
    ratedPowerW: p.ratedPowerW,
    maxPowerW: p.maxPowerW,
    images: p.images,
    specs: p.specs.map((s) => ({ key: s.key, value: s.value })),
    stock: p.inventory?.quantity ?? 0,
    prices: p.prices.map((pr) => ({
      priceListId: pr.priceListId,
      priceList: pr.priceList.name,
      segment: pr.priceList.segment,
      currency: pr.priceList.currency,
      amountMinor: pr.amountMinor,
      vatRate: pr.vatRate,
    })),
    updatedAt: p.updatedAt.toISOString(),
  };
}
