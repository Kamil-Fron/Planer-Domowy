import React, { useState } from 'react';
import {
  ArrowRightCircle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowRight,
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
  variant?: 'banner' | 'compact';
  onNavigateToMonth?: (month: string) => void;
}

export const MonthRolloverControl: React.FC<MonthRolloverControlProps> = ({
  selectedMonth,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  variant = 'banner',
  onNavigateToMonth,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Funkcja działa wyłącznie w poprzednich miesiącach!
  if (!isMonthInPast(selectedMonth)) {
    return null;
  }

  const { balance } = calculateMonthBalance(transactions, selectedMonth);
  const nextMonth = getNextMonth(selectedMonth);
  const existingRolloverTx = findRolloverTransaction(transactions, selectedMonth);
  const isRolledOver = !!existingRolloverTx;

  const fromMonthLabel = formatMonthName(selectedMonth);
  const toMonthLabel = formatMonthName(nextMonth);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // 1. Akcja: Przesunięcie bilansu na kolejny miesiąc
  const handleRollover = () => {
    if (balance === 0) {
      showToast('Bilans za ten miesiąc wynosi 0,00 PLN – brak kwoty do przesunięcia.');
      return;
    }

    const isSurplus = balance > 0;
    const absAmount = Math.round(Math.abs(balance) * 100) / 100;
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

    showToast(
      `Pomyślnie przesunięto bilans (${isSurplus ? '+' : '-'}${absAmount.toFixed(2)} PLN) na ${toMonthLabel}.`
    );
  };

  // 2. Akcja: Cofnięcie przesunięcia (usunięcie wpisu w transakcji)
  const handleRevert = () => {
    if (!existingRolloverTx) return;

    onDeleteTransaction(existingRolloverTx.id, true);
    showToast(
      `Cofnięto przesunięcie bilansu na ${toMonthLabel}. Wpis transakcji został usunięty.`
    );
  };

  if (variant === 'compact') {
    return (
      <div className="w-full">
        {toastMessage && (
          <div className="mb-2 px-3 py-1.5 bg-emerald-900 text-emerald-100 text-xs rounded-xl flex items-center justify-between border border-emerald-700 animate-in fade-in">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-300 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {isRolledOver ? (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
            <div className="flex items-center space-x-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-emerald-900">
                  Bilans przesunięty na {toMonthLabel}
                </span>
                <span className="text-emerald-700 ml-1.5 font-medium">
                  ({existingRolloverTx.type === 'income' ? '+' : '-'}
                  {existingRolloverTx.amount.toFixed(2)} PLN)
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-auto">
              {onNavigateToMonth && (
                <button
                  type="button"
                  onClick={() => onNavigateToMonth(nextMonth)}
                  className="px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors flex items-center space-x-1"
                  title={`Przejdź do ${toMonthLabel}`}
                >
                  <span>Zobacz {toMonthLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={handleRevert}
                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg shadow-2xs transition-colors flex items-center space-x-1"
                title="Usuń wpis w kolejnym miesiącu i cofnij przesunięcie bilansu"
              >
                <RotateCcw className="w-3 h-3 text-rose-600" />
                <span>Cofnij przesunięcie</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl">
            <div className="flex items-center space-x-2 min-w-0">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-indigo-950">
                  Przesunięcie bilansu na {toMonthLabel}:
                </span>
                <span
                  className={`ml-1.5 font-bold ${
                    balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {balance >= 0 ? '+' : ''}
                  {balance.toFixed(2)} PLN
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRollover}
              disabled={balance === 0}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center space-x-1.5 shrink-0 ml-auto ${
                balance === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
              }`}
            >
              <ArrowRightCircle className="w-3.5 h-3.5" />
              <span>Przesuń na kolejny miesiąc</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Wariant główny - "banner"
  return (
    <div className="w-full">
      {toastMessage && (
        <div className="mb-3 px-3.5 py-2 bg-emerald-900/90 text-emerald-100 text-xs rounded-xl flex items-center justify-between border border-emerald-700 shadow-xs animate-in fade-in">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-300 hover:text-white font-bold ml-2 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {isRolledOver ? (
        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 border border-emerald-200/90 rounded-2xl shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h4 className="text-sm font-bold text-emerald-950">
                    Bilans został przesunięty na kolejny miesiąc
                  </h4>
                  <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-900 rounded-full text-[11px] font-bold">
                    {toMonthLabel}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  Wpis w transakcjach na dzień {existingRolloverTx.date}:{' '}
                  <span className="font-bold">
                    {existingRolloverTx.type === 'income' ? '+' : '-'}
                    {existingRolloverTx.amount.toFixed(2)} PLN
                  </span>{' '}
                  ({existingRolloverTx.title}).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {onNavigateToMonth && (
                <button
                  type="button"
                  onClick={() => onNavigateToMonth(nextMonth)}
                  className="px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 rounded-xl transition-colors flex items-center space-x-1.5"
                  title={`Otwórz widok dla ${toMonthLabel}`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Zobacz {toMonthLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={handleRevert}
                className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center space-x-1.5 active:scale-95"
                title="Cofnij przesunięcie i usuń wygenerowany wpis transakcji"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Cofnij przesunięcie</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/70 border border-indigo-200/80 rounded-2xl shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-900">
                    Rozliczenie miesiąca {fromMonthLabel}
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    (zakończony okres)
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Bilans netto za ten miesiąc wynosi{' '}
                  <span
                    className={`font-black ${
                      balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {balance >= 0 ? '+' : ''}
                    {balance.toFixed(2)} PLN
                  </span>
                  . Możesz przesunąć go w ramach jednej transakcji do budżetu na{' '}
                  <span className="font-semibold text-slate-800">{toMonthLabel}</span>.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {balance === 0 ? (
                <div className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bilans wynosi 0,00 zł</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRollover}
                  className="px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center space-x-2 active:scale-95 cursor-pointer"
                  title={`Przesuń bilans na ${toMonthLabel}`}
                >
                  <ArrowRightCircle className="w-4 h-4" />
                  <span>Przesuń bilans na {toMonthLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
