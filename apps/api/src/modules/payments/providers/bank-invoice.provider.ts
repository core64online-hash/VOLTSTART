import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  WebhookVerification,
} from '../payment-provider.interface';

export interface BankInvoiceConfig {
  recipient: string;
  recipientEdrpou: string;
  iban: string;
}

/**
 * Оплата за рахунком (B2B/B2G): видаємо реквізити, надходження звіряє менеджер
 * вручну (POST /payments/orders/:number/mark-paid). Вебхуків немає.
 */
export class BankInvoiceProvider implements PaymentProvider {
  readonly kind = 'BANK_INVOICE' as const;

  constructor(private readonly cfg: BankInvoiceConfig) {}

  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    return {
      externalId: p.orderReference,
      instruction: {
        provider: this.kind,
        invoice: {
          recipient: this.cfg.recipient,
          recipientEdrpou: this.cfg.recipientEdrpou,
          iban: this.cfg.iban,
          purpose: `Оплата за рахунком № ${p.orderReference}, у т.ч. ПДВ`,
          amountMinor: p.amountMinor,
          currency: p.currency,
        },
      },
    };
  }

  async verifyWebhook(): Promise<WebhookVerification> {
    return { valid: false, status: 'PENDING' };
  }
}
