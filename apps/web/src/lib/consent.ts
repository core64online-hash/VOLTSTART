/**
 * Згода на необовʼязкові cookie/сховище (аналітика, маркетинг). Строго необхідні дані
 * (сесія входу, кошик) згоди не потребують. Будь-яку аналітику вмикати лише через hasConsent('analytics').
 */
export type ConsentCategory = 'analytics';
export interface Consent {
  version: 1;
  analytics: boolean;
  decidedAt: string;
}

const KEY = 'voltstar_consent';
export const CONSENT_EVENT = 'voltstar:consent';

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Consent;
    return v.version === 1 ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean): Consent {
  const consent: Consent = { version: 1, analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    /* приватний режим — рішення діятиме до закриття вкладки */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export const hasConsent = (category: ConsentCategory): boolean => getConsent()?.[category] === true;

/** Повторно показати банер (посилання «Налаштування cookie» у футері). */
export const OPEN_CONSENT_EVENT = 'voltstar:consent-open';
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
