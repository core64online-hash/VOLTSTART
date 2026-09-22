/**
 * Сума прописом українською (для рахунків-фактур): «Одна тисяча двісті гривень 50 копійок».
 * Враховує рід (гривня й тисяча — жіночого, мільйон — чоловічого) та форми множини.
 */

const UNITS_M = ['', 'один', 'два', 'три', 'чотири', 'пʼять', 'шість', 'сім', 'вісім', 'девʼять'];
const UNITS_F = ['', 'одна', 'дві', 'три', 'чотири', 'пʼять', 'шість', 'сім', 'вісім', 'девʼять'];
const TEENS = [
  'десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять',
  'пʼятнадцять', 'шістнадцять', 'сімнадцять', 'вісімнадцять', 'девʼятнадцять',
];
const TENS = ['', '', 'двадцять', 'тридцять', 'сорок', 'пʼятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'девʼяносто'];
const HUNDREDS = ['', 'сто', 'двісті', 'триста', 'чотириста', 'пʼятсот', 'шістсот', 'сімсот', 'вісімсот', 'девʼятсот'];

type Forms = [one: string, few: string, many: string];

/** Форма слова для числа: 1 гривня, 2 гривні, 5 гривень (11–14 — завжди «багато»). */
export function pluralUk(n: number, [one, few, many]: Forms): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function triad(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    words.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) words.push(TENS[t]);
    if (u) words.push((feminine ? UNITS_F : UNITS_M)[u]);
  }
  return words;
}

const SCALES: Array<{ forms: Forms; feminine: boolean }> = [
  { forms: ['мільярд', 'мільярди', 'мільярдів'], feminine: false },
  { forms: ['мільйон', 'мільйони', 'мільйонів'], feminine: false },
  { forms: ['тисяча', 'тисячі', 'тисяч'], feminine: true },
];

const HRYVNIA: Forms = ['гривня', 'гривні', 'гривень'];
const KOPIYKA: Forms = ['копійка', 'копійки', 'копійок'];

/** Ціле число прописом (рід одиниць — як у валюти, для гривні — жіночий). */
export function integerInWords(n: number, feminine = true): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) throw new RangeError(`Непідтримуване число: ${n}`);
  if (n === 0) return 'нуль';

  const words: string[] = [];
  let rest = n;
  const divisors = [1e9, 1e6, 1e3];
  SCALES.forEach((scale, i) => {
    const group = Math.floor(rest / divisors[i]);
    rest %= divisors[i];
    if (group) words.push(...triad(group, scale.feminine), pluralUk(group, scale.forms));
  });
  words.push(...triad(rest, feminine));
  return words.join(' ');
}

/** Сума в гривнях прописом із копійками цифрами (так заведено в первинних документах). */
export function uahAmountInWords(amountMinor: number): string {
  const hryvnias = Math.floor(amountMinor / 100);
  const kop = amountMinor % 100;
  const text = `${integerInWords(hryvnias)} ${pluralUk(hryvnias % 1000, HRYVNIA)} ${String(kop).padStart(2, '0')} ${pluralUk(kop, KOPIYKA)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
