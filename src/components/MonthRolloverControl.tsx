import React, { useState } from 'react';
import {
  ArrowRightCircle,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import { Transaction } from '../types';
import {
  formatMonthName,
  getNextMonth,
  isMonthInPast,
  calculateMonthBalance,
  findRolloverTransaction,
} from '../utils/rollover';

interface MonthRolloverControlProps {
  selectedMonth: string;
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  onDeleteTransaction: (id: string, skipBillRevert?: boolean) => void;
  variant?: 'icon' | 'compact' | 'banner';
  theme?: 'dark' | 'light';
  onNavigateToMonth?: (month: string) => void;
}

export const MonthRolloverControl: React.FC<MonthRolloverControlProps> = ({
  selectedMonth,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  variant = 'icon',
  theme = 'light',
  onNavigateToMonth,
}) => {
  const [toast, setToast] = useState<string | null>(null);

  // Funkcja dostępna wyłącznie dla zakończonych (przeszłych) miesięcy
  if (!isMonthInPast(selectedMonth)) {
    return null;
  }

  const { balance } = calculateMonthBalance(transactions, selectedMonth);
  const nextMonth = getNextMonth(selectedMonth);
  const existingRolloverTx = findRolloverTransaction(transactions, selectedMonth);
  const isRolledOver = Boolean(existingRolloverTx);

  const fromMonthLabel = formatMonthName(selectedMonth);
  const toMonthLabel = formatMonthName(nextMonth);
  const isSurplus = balance > 0;
  const absAmount = Math.round(Math.abs(balance) * 100) / 100;

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // 1. Akcja: Przesunięcie bilansu na kolejny miesiąc (1 transakcja)
  const handleRollover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (balance === 0) {
      showNotification('Bilans wynosi 0,00 PLN – brak kwoty do przesunięcia.');
      return;
    }

    const nextMonthFirstDay = `${nextMonth}-01`;
    const txId = `tx-rollover-${Date.now()}-${selectedMonth}`;

    onAddTransaction({
      id: txId,
      type: isSurplus ? 'income' : 'expense',
      amount: absAmount,
      category: isSurplus ? 'Inne dochody' : 'Inne wydatki',
      date: nextMonthFirstDay,
      title: `Bilans z poprzedniego miesiąca (${fromMonthLabel})`,
      comment: isSurplus
        ? `Przesunięcie nadwyżki finansowej (+${absAmount.toFixed(2)} PLN) z miesiąca ${fromMonthLabel} jako przychód początkowy.`
        : `Przesunięcie deficytu (-${absAmount.toFixed(2)} PLN) z miesiąca ${fromMonthLabel} jako obciążenie początkowe.`,
      isBalanceRollover: true,
      rolloverFromMonth: selectedMonth,
      rolloverToMonth: nextMonth,
    });

    showNotification(
      `Przesunięto ${isSurplus ? '+' : '-'}${absAmount.toFixed(2)} PLN na ${toMonthLabel}.`
    );
  };

  // 2. Akcja: Cofnięcie przesunięcia (usunięcie wpisu)
  const handleRevert = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!existingRolloverTx) return;

    onDeleteTransaction(existingRolloverTx.id, true);
    showNotification(`Cofnięto przesunięcie na ${toMonthLabel}.`);
  };

  // Domyślny, dyskretny widok w postaci małej ikonki w kafelku
  if (variant === 'icon') {
    return (
      <div className="relative inline-flex items-center">
        {/* Pływające mikro-powiadomienie toast */}
        {toast && (
          <div className="absolute -top-9 right-0 z-40 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900/90 text-white shadow-lg backdrop-blur-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-1 pointer-events-none">
            {toast}
          </div>
        )}

        {isRolledOver ? (
          <button
            type="button"
            onClick={handleRevert}
            className={`p-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer group ${
              theme === 'dark'
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300 border border-emerald-500/40 hover:border-rose-500/40'
                : 'bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-700 border border-emerald-200 hover:border-rose-200 shadow-2xs'
            }`}
            title={`Bilans (${existingRolloverTx.type === 'income' ? '+' : '-'}${existingRolloverTx.amount.toFixed(2)} PLN) został przeniesiony na ${toMonthLabel}. Kliknij, aby cofnąć.`}
            aria-label="Cofnij przesunięcie bilansu"
          >
            <span className="flex items-center space-x-1 group-hover:hidden">
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
              <span className="text-[10px] hidden sm:inline font-bold">Przeniesiono</span>
            </span>
            <span className="hidden group-hover:flex items-center space-x-1">
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[10px] hidden sm:inline font-bold">Cofnij</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRollover}
            disabled={balance === 0}
            className={`p-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
              balance === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : theme === 'dark'
                ? 'bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 shadow-2xs'
                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 shadow-2xs'
            }`}
            title={
              balance === 0
                ? 'Bilans za ten miesiąc wynosi 0,00 zł.'
                : `Przesuń bilans (${isSurplus ? '+' : ''}${balance.toFixed(2)} zł) na kolejny miesiąc (${toMonthLabel})`
            }
            aria-label={`Przesuń bilans na ${toMonthLabel}`}
          >
            <ArrowRightCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold hidden sm:inline">Przesuń bilans</span>
          </button>
        )}
      </div>
    );
  }

  // Wersja kompaktowa
  return (
    <div className="relative inline-flex items-center">
      {isRolledOver ? (
        <button
          type="button"
          onClick={handleRevert}
          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-700 border border-emerald-200 rounded-lg flex items-center space-x-1 transition-colors"
          title={`Cofnij przesunięcie bilansu (${toMonthLabel})`}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Cofnij przesunięcie ({existingRolloverTx.amount.toFixed(2)} zł)</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRollover}
          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center space-x-1 transition-colors"
          title={`Przesuń bilans na ${toMonthLabel}`}
        >
          <Sparkles className="w-3 h-3 text-indigo-600" />
          <span>Przesuń bilans ({balance >= 0 ? '+' : ''}{balance.toFixed(2)} zł)</span>
        </button>
      )}
    </div>
  );
};
