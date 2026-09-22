import { Injectable, NotFoundException } from '@nestjs/common';
import type { Currency, PriceQuery, PriceQuote, Segment } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { splitGross } from './pricing.math';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ціна товару для сегмента+валюти з розкладкою ПДВ.
   * Шукає активний прайс-лист сегмента у потрібній валюті та ціну товару в ньому.
   */
  async quote(query: PriceQuery): Promise<PriceQuote> {
    const price = await this.prisma.price.findFirst({
      where: {
        productId: query.productId,
        priceList: {
          segment: query.segment,
          currency: query.currency,
          active: true,
        },
      },
      include: { priceList: true },
    });

    if (!price) {
      throw new NotFoundException(
        `Ціну для товару "${query.productId}" (${query.segment}/${query.currency}) не знайдено`,
      );
    }

    const { netMinor, vatMinor, grossMinor } = splitGross({
      unitGrossMinor: price.amountMinor,
      vatRate: price.vatRate,
      quantity: query.quantity,
    });

    return {
      productId: query.productId,
      segment: query.segment,
      currency: query.currency,
      quantity: query.quantity,
      unitGrossMinor: price.amountMinor,
      vatRate: price.vatRate,
      netMinor,
      vatMinor,
      grossMinor,
    };
  }

  /**
   * Ціни за одиницю (з ПДВ) для набору товарів в активному прайс-листі сегмента/валюти.
   * Товари без ціни в цьому прайс-листі у результат не потрапляють.
   */
  async unitPrices(
    productIds: string[],
    segment: Segment,
    currency: Currency,
  ): Promise<Map<string, { amountMinor: number; vatRate: number }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.price.findMany({
      where: {
        productId: { in: productIds },
        priceList: { segment, currency, active: true },
      },
      select: { productId: true, amountMinor: true, vatRate: true },
    });
    return new Map(rows.map((r) => [r.productId, { amountMinor: r.amountMinor, vatRate: r.vatRate }]));
  }
}
