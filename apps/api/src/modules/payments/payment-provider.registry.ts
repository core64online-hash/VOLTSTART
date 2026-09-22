import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PaymentProviderKind } from '@voltstar/types';
import type { PaymentProvider } from './payment-provider.interface';
import { PAYMENT_PROVIDERS } from './providers';

/** Доступ до налаштованих провайдерів за типом. */
@Injectable()
export class PaymentProviderRegistry {
  private readonly byKind: Map<PaymentProviderKind, PaymentProvider>;

  constructor(@Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[]) {
    this.byKind = new Map(providers.map((p) => [p.kind, p]));
  }

  has(kind: PaymentProviderKind): boolean {
    return this.byKind.has(kind);
  }

  get(kind: PaymentProviderKind): PaymentProvider {
    const provider = this.byKind.get(kind);
    if (!provider) throw new ServiceUnavailableException(`Платіжний провайдер ${kind} не налаштований`);
    return provider;
  }
}
