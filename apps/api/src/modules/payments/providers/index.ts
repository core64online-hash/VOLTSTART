import type { PaymentProvider } from '../payment-provider.interface';
import { BankInvoiceProvider } from './bank-invoice.provider';
import { LiqPayProvider } from './liqpay.provider';
import { StripeProvider } from './stripe.provider';
import { WayForPayProvider } from './wayforpay.provider';

/** DI-токен масиву налаштованих провайдерів. */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

type Env = (key: string) => string | undefined;

/**
 * Створює лише ті провайдери, для яких задані облікові дані.
 * Ненастроєний провайдер недоступний на checkout (503), а не падає під час оплати.
 */
export function buildProviders(env: Env): PaymentProvider[] {
  const apiUrl = (env('API_PUBLIC_URL') ?? 'http://localhost:4000').replace(/\/$/, '');
  const hook = (kind: string) => `${apiUrl}/api/payments/webhooks/${kind}`;
  const providers: PaymentProvider[] = [];

  const wfpAccount = env('WAYFORPAY_MERCHANT_ACCOUNT');
  const wfpSecret = env('WAYFORPAY_MERCHANT_SECRET');
  if (wfpAccount && wfpSecret) {
    providers.push(
      new WayForPayProvider({
        merchantAccount: wfpAccount,
        merchantSecret: wfpSecret,
        merchantDomain: env('WAYFORPAY_DOMAIN') || 'localhost',
        serviceUrl: hook('WAYFORPAY'),
      }),
    );
  }

  const lpPublic = env('LIQPAY_PUBLIC_KEY');
  const lpPrivate = env('LIQPAY_PRIVATE_KEY');
  if (lpPublic && lpPrivate) {
    providers.push(
      new LiqPayProvider({
        publicKey: lpPublic,
        privateKey: lpPrivate,
        serverUrl: hook('LIQPAY'),
        sandbox: env('LIQPAY_SANDBOX') === 'true',
      }),
    );
  }

  const stripeKey = env('STRIPE_SECRET_KEY');
  const stripeHook = env('STRIPE_WEBHOOK_SECRET');
  if (stripeKey && stripeHook) {
    providers.push(new StripeProvider({ secretKey: stripeKey, webhookSecret: stripeHook }));
  }

  const iban = env('INVOICE_IBAN');
  if (iban) {
    providers.push(
      new BankInvoiceProvider({
        iban,
        recipient: env('INVOICE_RECIPIENT') || 'ТОВ «ВОЛЬТСТАР»',
        recipientEdrpou: env('INVOICE_RECIPIENT_EDRPOU') || '',
      }),
    );
  }

  return providers;
}
