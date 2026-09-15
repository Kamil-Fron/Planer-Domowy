import { DebtItem, MortgageLoan } from '../types';

export interface LoanSplitResult {
  hasInterest: boolean;
  isInGracePeriod: boolean;
  graceEndDate?: string;
  effectiveAnnualRate: number;
  monthlyInterestAmount: number;
  suggestedPrincipal: number;
  suggestedInterest: number;
  remainingPrincipal: number;
  explanation: string;
}

/**
 * Zwraca efektywne roczne oprocentowanie (w %) dla danego zobowiązania lub kredytu
 */
export function getLoanEffectiveInterestRate(debt?: DebtItem | MortgageLoan | null): number {
  if (!debt) return 0;

  if (typeof debt.interestRate === 'number' && debt.interestRate > 0) {
    return debt.interestRate;
  }

  const margin = (debt as any).marginRate || 0;
  const reference = (debt as any).referenceRate || 0;
  if (margin + reference > 0) {
    return margin + reference;
  }

  return 0;
}

/**
 * Sprawdza, czy dane zobowiązanie jest deklarowane z oprocentowaniem (np. kredyt bankowy, pożyczka z procentem)
 */
export function isInterestBearingDebt(debt?: DebtItem | MortgageLoan | null): boolean {
  if (!debt) return false;
  const rate = getLoanEffectiveInterestRate(debt);
  if (rate > 0) return true;

  if ((debt as DebtItem).isBankLoan) return true;
  if ((debt as DebtItem).category === 'kredyt_bankowy') return true;

  return false;
}

/**
 * Oblicza datę zakończenia okresu karencji na podstawie daty startu i liczby miesięcy
 */
export function calculateGraceEndDate(startDateStr?: string, months?: number): string {
  if (!startDateStr || !months || months <= 0) return '';
  try {
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Sprawdza, czy dana data (domyślnie dzisiaj) mieści się w okresie karencji w spłacie kapitału
 */
export function isDebtInGracePeriod(
  debt?: DebtItem | MortgageLoan | null,
  targetDate?: string
): { inGrace: boolean; graceEndDate?: string } {
  if (!debt) return { inGrace: false };

  const checkDate = targetDate || new Date().toISOString().split('T')[0];
  let graceEnd = debt.gracePeriodEndDate;

  if (!graceEnd && debt.gracePeriodMonths && debt.gracePeriodMonths > 0 && debt.startDate) {
    graceEnd = calculateGraceEndDate(debt.startDate, debt.gracePeriodMonths);
  }

  if (graceEnd && checkDate <= graceEnd) {
    return { inGrace: true, graceEndDate: graceEnd };
  }

  return { inGrace: false, graceEndDate: graceEnd };
}

/**
 * Główna funkcja wyliczająca inteligentną sugestię podziału raty na kapitał i odsetki
 * zgodnie z deklaracją oprocentowania, saldem kapitału i okresem karencji.
 */
export function calculateSuggestedLoanSplit({
  debt,
  paymentAmount,
  paymentDate,
  paymentType = 'regular',
}: {
  debt?: DebtItem | MortgageLoan | null;
  paymentAmount: number;
  paymentDate?: string;
  paymentType?: 'regular' | 'overpayment';
}): LoanSplitResult {
  const checkDate = paymentDate || new Date().toISOString().split('T')[0];
  const remainingPrincipal = debt
    ? (typeof (debt as DebtItem).currentRemaining === 'number'
        ? (debt as DebtItem).currentRemaining
        : (debt as MortgageLoan).remainingPrincipal || 0)
    : 0;

  if (!debt) {
    return {
      hasInterest: false,
      isInGracePeriod: false,
      effectiveAnnualRate: 0,
      monthlyInterestAmount: 0,
      suggestedPrincipal: paymentAmount,
      suggestedInterest: 0,
      remainingPrincipal: 0,
      explanation: 'Brak powiązanego zobowiązania (100% kwoty).',
    };
  }

  const effectiveRate = getLoanEffectiveInterestRate(debt);
  const hasInterest = effectiveRate > 0 || (debt as DebtItem).isBankLoan === true;
  const { inGrace, graceEndDate } = isDebtInGracePeriod(debt, checkDate);

  // Nadpłata kredytu -> 100% idzie na kapitał
  if (paymentType === 'overpayment') {
    const princ = Math.min(paymentAmount, Math.max(0, remainingPrincipal));
    return {
      hasInterest,
      isInGracePeriod: inGrace,
      graceEndDate,
      effectiveAnnualRate: effectiveRate,
      monthlyInterestAmount: 0,
      suggestedPrincipal: princ,
      suggestedInterest: 0,
      remainingPrincipal,
      explanation: 'Nadpłata kredytu: 100% kwoty przeznaczone na spłatę kapitału (pomniejsza saldo).',
    };
  }

  // Aktywny okres karencji -> rata składa się w 100% z odsetek
  if (inGrace) {
    return {
      hasInterest: true,
      isInGracePeriod: true,
      graceEndDate,
      effectiveAnnualRate: effectiveRate,
      monthlyInterestAmount: paymentAmount,
      suggestedPrincipal: 0,
      suggestedInterest: paymentAmount,
      remainingPrincipal,
      explanation: `🟡 Aktywny okres karencji (do ${graceEndDate || 'końca karencji'}) – 100% raty stanowią odsetki bankowe (kapitał nie ulega zmniejszeniu).`,
    };
  }

  // Normalna spłata zobowiązania z oprocentowaniem
  if (hasInterest && effectiveRate > 0) {
    const monthlyRate = effectiveRate / 100 / 12;
    const rawInterest = Math.max(0, remainingPrincipal * monthlyRate);
    const monthlyInterest = Math.round(rawInterest * 100) / 100;

    let suggestedInterest = 0;
    let suggestedPrincipal = 0;

    if (paymentAmount <= monthlyInterest) {
      suggestedInterest = paymentAmount;
      suggestedPrincipal = 0;
    } else {
      suggestedInterest = monthlyInterest;
      suggestedPrincipal = Math.max(0, Math.round((paymentAmount - monthlyInterest) * 100) / 100);

      // Jeśli spłata kapitału przewyższa pozostały kapitał
      if (suggestedPrincipal > remainingPrincipal && remainingPrincipal > 0) {
        suggestedPrincipal = remainingPrincipal;
        suggestedInterest = Math.max(0, Math.round((paymentAmount - remainingPrincipal) * 100) / 100);
      }
    }

    return {
      hasInterest: true,
      isInGracePeriod: false,
      graceEndDate,
      effectiveAnnualRate: effectiveRate,
      monthlyInterestAmount: monthlyInterest,
      suggestedPrincipal,
      suggestedInterest,
      remainingPrincipal,
      explanation: `📐 Sugestia bankowa: Kapitał: ${suggestedPrincipal.toFixed(2)} zł • Odsetki: ${suggestedInterest.toFixed(2)} zł (${effectiveRate}% rocznie od salda ${remainingPrincipal.toFixed(2)} zł).`,
    };
  }

  // Zobowiązanie bez oprocentowania (np. pożyczka prywatna 0%)
  const nonInterestPrincipal = Math.min(paymentAmount, Math.max(0, remainingPrincipal > 0 ? remainingPrincipal : paymentAmount));
  return {
    hasInterest: false,
    isInGracePeriod: false,
    graceEndDate,
    effectiveAnnualRate: 0,
    monthlyInterestAmount: 0,
    suggestedPrincipal: nonInterestPrincipal,
    suggestedInterest: 0,
    remainingPrincipal,
    explanation: 'Zobowiązanie bez oprocentowania (0%): 100% wpłaty zmniejsza saldo długu.',
  };
}
