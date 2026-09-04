import { Bill } from '../types';

/**
 * Oblicza kolejny termin płatności dla rachunku cyklicznego z uwzględnieniem liczby cykli (np. opłacenie za 2 cykle z góry lub kumulacja)
 */
export function calculateNextDueDate(
  currentDueDate: string,
  cycle: Bill['billingCycle'],
  cyclesCount: number = 1
): string {
  if (cycle === 'jednorazowo') {
    return currentDueDate;
  }

  let resultDate = currentDueDate;
  const count = Math.max(1, cyclesCount);

  for (let i = 0; i < count; i++) {
    const parts = resultDate.split('-').map(Number);
    let [year, month, day] = parts;

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      resultDate = d.toISOString().split('T')[0];
      continue;
    }

    let addMonths = 1;
    let addYears = 0;

    switch (cycle) {
      case 'miesięcznie':
        addMonths = 1;
        break;
      case 'co 2 miesiące':
        addMonths = 2;
        break;
      case 'kwartalnie':
        addMonths = 3;
        break;
      case 'rocznie':
        addMonths = 0;
        addYears = 1;
        break;
      default:
        addMonths = 1;
    }

    month += addMonths;
    year += addYears;

    while (month > 12) {
      month -= 12;
      year += 1;
    }

    // Zabezpieczenie przed dniami poza zakresem danego miesiąca (np. 31 lutego)
    const maxDays = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, maxDays);

    const pad = (n: number) => n.toString().padStart(2, '0');
    resultDate = `${year}-${pad(month)}-${pad(safeDay)}`;
  }

  return resultDate;
}

/**
 * Zwraca listę nazw kolejnych okresów rozliczeniowych
 */
export function getMultipleBillingPeriods(
  startDate: string,
  cycle: Bill['billingCycle'],
  count: number = 1
): string[] {
  const periods: string[] = [getBillingPeriodName(startDate)];
  let currentDate = startDate;

  for (let i = 1; i < count; i++) {
    currentDate = calculateNextDueDate(currentDate, cycle, 1);
    periods.push(getBillingPeriodName(currentDate));
  }

  return periods;
}

/**
 * Oblicza poprzedni termin płatności dla rachunku cyklicznego (np. przy cofnięciu opłaty)
 */
export function calculatePreviousDueDate(
  currentDueDate: string,
  cycle: Bill['billingCycle'],
  cyclesCount = 1
): string {
  if (cycle === 'jednorazowo' || cyclesCount < 1) {
    return currentDueDate;
  }

  const parts = currentDueDate.split('-').map(Number);
  let [year, month, day] = parts;

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const d = new Date();
    d.setMonth(d.getMonth() - cyclesCount);
    return d.toISOString().split('T')[0];
  }

  let subMonths = 1;
  let subYears = 0;

  switch (cycle) {
    case 'miesięcznie':
      subMonths = 1 * cyclesCount;
      break;
    case 'co 2 miesiące':
      subMonths = 2 * cyclesCount;
      break;
    case 'kwartalnie':
      subMonths = 3 * cyclesCount;
      break;
    case 'rocznie':
      subMonths = 0;
      subYears = 1 * cyclesCount;
      break;
    default:
      subMonths = 1 * cyclesCount;
  }

  month -= subMonths;
  year -= subYears;

  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const maxDays = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, maxDays);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(safeDay)}`;
}

/**
 * Zwraca czytelną nazwę okresu rozliczeniowego (np. "Wrzesień 2026")
 */
export function getBillingPeriodName(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
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
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
