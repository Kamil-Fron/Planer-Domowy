import { Transaction } from '../types';

export interface DuplicateCandidate {
  title: string;
  amount: number;
  date: string;
  category?: string;
  comment?: string;
  receiptItems?: { name: string; price?: number; quantity?: number; category?: string }[];
  receiptStoreName?: string;
}

/**
 * Szuka w istniejących transakcjach wydatków o identycznej dacie (YYYY-MM-DD) oraz kwocie.
 * Zgodnie z wytycznymi bierzemy pod uwagę datę z paragonu/wydatku i kwotę.
 */
export function findMatchingExpenses(
  candidateDate: string | undefined,
  candidateAmount: number | undefined,
  transactions: Transaction[] = [],
  excludeId?: string
): Transaction[] {
  if (!candidateDate || candidateAmount === undefined || isNaN(candidateAmount) || candidateAmount <= 0) {
    return [];
  }

  const cleanDate = candidateDate.slice(0, 10);
  const roundedAmount = Math.round(candidateAmount * 100);

  return transactions.filter((t) => {
    if (excludeId && t.id === excludeId) return false;
    // Sprawdzamy tylko wydatki (zgodnie z "Przy dodawaniu wydatków np paragonów")
    if (t.type !== 'expense') return false;

    const txDate = (t.date || '').slice(0, 10);
    const txAmount = Math.round((t.amount || 0) * 100);

    return txDate === cleanDate && txAmount === roundedAmount;
  });
}
