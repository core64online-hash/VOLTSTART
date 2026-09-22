/**
 * Валідація коду ЄДРПОУ (юридичні особи України, 8 цифр) за контрольною сумою.
 *
 * Алгоритм: зважена сума перших 7 цифр за набором ваг, що залежить від діапазону
 * номера; контроль = сума % 11. Якщо контроль = 10 — повторний прохід зі зсунутими
 * на +2 вагами; якщо знову 10 — контроль = 0. Валідно, коли контроль = 8-й цифрі.
 */
export function isValidEdrpou(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const numeric = Number(code);

  // Для номерів у діапазоні 30 000 000–60 000 000 використовується інший набір ваг.
  const inMidRange = numeric >= 30_000_000 && numeric <= 60_000_000;
  const weights = inMidRange ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];

  return controlDigit(digits, weights) === digits[7];
}

function controlDigit(digits: number[], weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  let control = sum % 11;
  if (control === 10) {
    const shifted = weights.map((w) => w + 2);
    const sum2 = shifted.reduce((acc, w, i) => acc + w * digits[i], 0);
    control = sum2 % 11;
    if (control === 10) control = 0;
  }
  return control;
}

/**
 * Спрощена перевірка ІПН/VAT: 10 цифр (юрособа/ФОП) або 12 цифр (фізособа).
 * Повноцінна перевірка контрольної суми ІПН — поза межами MVP.
 */
export function isValidVat(vat: string): boolean {
  return /^\d{10}$/.test(vat) || /^\d{12}$/.test(vat);
}
