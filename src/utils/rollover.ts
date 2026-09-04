import { Transaction } from '../types';

export const MONTH_NAMES_PL = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

export const MONTH_NAMES_GENITIVE_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

export function formatMonthName(monthStr: string): string {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_PL[idx] || month} ${year}`;
}

export function formatMonthGenitive(monthStr: string): string {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_GENITIVE_PL[idx] || month} ${year}`;
}

/**
 * Zwraca kolejny miesiąc w formacie YYYY-MM
 */
export function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + 1, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

/**
 * Zwraca poprzedni miesiąc w formacie YYYY-MM
 */
export function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 - 1, 1);
  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

/**
 * Pobiera bieżący miesiąc kalendarzowy (YYYY-MM)
 */
export function getCurrentCalendarMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Sprawdza czy dany miesiąc jest poprzednim (przeszłym) miesiącem względem aktualnego kalendarza
 */
export function isMonthInPast(monthStr: string): boolean {
  if (!monthStr) return false;
  return monthStr < getCurrentCalendarMonth();
}

/**
 * Oblicza dochody, wydatki i bilans netto danego miesiąca
 */
export function calculateMonthBalance(
  transactions: Transaction[],
  monthStr: string
): { totalIncome: number; totalExpense: number; balance: number } {
  const monthTransactions = transactions.filter((t) => t.date.startsWith(monthStr));

  const totalIncome = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;

  return { totalIncome, totalExpense, balance };
}

/**
 * Wyszukuje transakcję przesunięcia bilansu z podanego miesiąca
 */
export function findRolloverTransaction(
  transactions: Transaction[],
  fromMonth: string
): Transaction | undefined {
  const nextMonth = getNextMonth(fromMonth);

  return transactions.find((t) => {
    // 1. Precyzyjne dopasowanie po polach strukturalnych
    if (t.isBalanceRollover && t.rolloverFromMonth === fromMonth) {
      return true;
    }

    // 2. Dopasowanie po dacie kolejnego miesiąca i tytule/komentarzu
    if (
      t.date.startsWith(nextMonth) &&
      (t.title.includes('Bilans z poprzedniego miesiąca') ||
        t.title.includes('Przeniesienie bilansu')) &&
      (t.comment?.includes(fromMonth) ||
        t.comment?.includes(formatMonthGenitive(fromMonth)) ||
        t.comment?.includes(formatMonthName(fromMonth)))
    ) {
      return true;
    }

    return false;
  });
}

/**
 * Zwraca maksymalny dozwolony miesiąc kalendarzowy (YYYY-MM).
 * Zgodnie z zasadą: maksymalnym miesiącem jest bieżący miesiąc kalendarzowy,
 * CHYBA ŻE w transakcjach istnieje jakikolwiek wpis w przyszłym miesiącu.
 * Wtedy najdalszy miesiąc z transakcji jest dozwolony.
 */
export function getMaxAllowedMonth(transactions: Transaction[] = []): string {
  const currentCal = getCurrentCalendarMonth();
  let maxMonth = currentCal;

  for (const t of transactions) {
    if (t.date && t.date.length >= 7) {
      const txMonth = t.date.slice(0, 7);
      if (txMonth > maxMonth) {
        maxMonth = txMonth;
      }
    }
  }

  return maxMonth;
}

/**
 * Sprawdza czy można przejść do wskazanego miesiąca docelowego
 */
export function canNavigateToMonth(
  targetMonth: string,
  transactions: Transaction[] = []
): boolean {
  const maxMonth = getMaxAllowedMonth(transactions);
  return targetMonth <= maxMonth;
}

/**
 * Generuje listę dostępnych miesięcy do wyboru (od maksymalnego dozwolonego wstecz).
 */
export function getAvailableMonthOptions(
  transactions: Transaction[] = []
): { value: string; label: string }[] {
  const maxMonth = getMaxAllowedMonth(transactions);
  
  // Minimalny domyślny miesiąc: 6 miesięcy wstecz lub najwcześniejsza transakcja
  let minMonth = '2026-06';
  for (const t of transactions) {
    if (t.date && t.date.length >= 7) {
      const txMonth = t.date.slice(0, 7);
      if (txMonth < minMonth) {
        minMonth = txMonth;
      }
    }
  }

  const options: { value: string; label: string }[] = [];
  let curr = maxMonth;
  // Bezpiecznik: max 36 miesięcy wstecz
  let safetyCounter = 0;
  while (curr >= minMonth && safetyCounter < 36) {
    options.push({ value: curr, label: formatMonthName(curr) });
    curr = getPreviousMonth(curr);
    safetyCounter++;
  }

  return options;
}
