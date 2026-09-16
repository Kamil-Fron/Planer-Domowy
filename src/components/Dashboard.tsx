import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Receipt,
  ShoppingCart,
  Zap,
  Target,
  FileText,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Flame,
  Droplets,
  Calendar,
  ChevronRight,
  MessageSquare,
  DollarSign,
  Layers,
  ArrowLeftRight,
  Landmark,
  CreditCard,
  HandCoins,
  CalendarClock,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
  TabType,
  MortgageLoan,
  DebtItem,
} from '../types';
import { INITIAL_CATEGORIES } from '../mockData';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { getFinancialAdviceWithAI } from '../services/aiService';
import { MonthRolloverControl } from './MonthRolloverControl';
import { useMonthSwipe } from '../hooks/useMonthSwipe';

export interface DashboardNavigationOptions {
  transactionFilter?: 'all' | 'income' | 'expense';
  transactionSearch?: string;
  selectedTxId?: string;
  payBillId?: string;
  shoppingCategory?: string;
  shoppingTab?: 'active' | 'completed';
  limitCategory?: string;
}

interface DashboardProps {
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  mortgages?: MortgageLoan[];
  debts?: DebtItem[];
  selectedMonth: string;
  onNavigate: (tab: TabType, options?: DashboardNavigationOptions) => void;
  onQuickAddTransaction: (type: 'income' | 'expense') => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  onDeleteTransaction?: (id: string, skipBillRevert?: boolean) => void;
  onMonthChange?: (month: string) => void;
}

interface AiAdviceData {
  financialHealth: string;
  savingsRatePercent: number;
  alerts: string[];
  actionableTips: string[];
  summary: string;
  fullText?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  bills,
  budgetLimits,
  shoppingLists,
  shoppingItems,
  mortgages = [],
  debts = [],
  selectedMonth,
  onNavigate,
  onQuickAddTransaction,
  onAddTransaction,
  onDeleteTransaction,
  onMonthChange,
}) => {
  const [aiAdvice, setAiAdvice] = useState<AiAdviceData | string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isDebtsExpanded, setIsDebtsExpanded] = useState<boolean>(false);

  // Mobile swipe gesture between months on budget tile
  const { touchHandlers, swipeFeedback } = useMonthSwipe({
    selectedMonth,
    onMonthChange,
    transactions,
  });

  const now = new Date();
  const currentCalendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = `${currentCalendarMonth}-${String(now.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = !selectedMonth || selectedMonth === currentCalendarMonth;

  // Month transactions
  const monthTransactions = transactions.filter(
    (t) => !selectedMonth || t.date.startsWith(selectedMonth)
  );

  // Transakcje rozliczone na dany dzień:
  // W bieżącym miesiącu do salda bieżącego wliczamy transakcje z datą <= dzisiaj.
  // Transakcje opłacone z datą przyszłą (np. opłacone 10-go z terminem 15-go) zostaną zaksięgowane 15-go.
  const settledMonthTransactions = isCurrentMonth
    ? monthTransactions.filter((t) => t.date <= todayStr)
    : monthTransactions;

  const futureMonthTransactions = isCurrentMonth
    ? monthTransactions.filter((t) => t.date > todayStr)
    : [];

  const totalIncome = settledMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = settledMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(0) : '0';

  const futureExpense = futureMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const futureIncome = futureMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const projectedBalance = balance + futureIncome - futureExpense;

  // Urgent / Upcoming bills - rachunki oczekujące na opłacenie ORAZ opłacone z datą przyszłą
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  interface UpcomingBillItem {
    id: string;
    billId: string;
    name: string;
    amount: number;
    targetDate: string;
    diffDays: number;
    isPaidFuture: boolean;
    provider?: string;
  }

  const upcomingBillsList: UpcomingBillItem[] = [];

  bills.forEach((b) => {
    // 1. Sprawdź czy rachunek został opłacony z datą przyszłą (do przodu)
    const latestHistory = b.paymentHistory?.[0];
    const isFuturePaid =
      (b.paymentDate && b.paymentDate > todayStr) ||
      (latestHistory && !latestHistory.isRollover && latestHistory.paidDate > todayStr);

    if (isFuturePaid) {
      const futureDate = (b.paymentDate && b.paymentDate > todayStr)
        ? b.paymentDate!
        : latestHistory!.paidDate;
      const targetTime = new Date(futureDate).getTime();
      const diffDays = Math.ceil((targetTime - today.getTime()) / (1000 * 60 * 60 * 24));
      const paidAmt = b.lastPaidAmount || latestHistory?.amount || b.amount;

      if (diffDays >= 0 && diffDays <= 14) {
        upcomingBillsList.push({
          id: `future-${b.id}`,
          billId: b.id,
          name: b.name,
          amount: paidAmt,
          targetDate: futureDate,
          diffDays,
          isPaidFuture: true,
          provider: b.provider,
        });
        return;
      }
    }

    // 2. Rachunki oczekujące na opłacenie (status !== 'paid')
    if (b.status !== 'paid') {
      const dueTime = new Date(b.dueDate).getTime();
      const diffDays = Math.ceil((dueTime - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 14) {
        upcomingBillsList.push({
          id: `pending-${b.id}`,
          billId: b.id,
          name: b.name,
          amount: b.amount,
          targetDate: b.dueDate,
          diffDays,
          isPaidFuture: false,
          provider: b.provider,
        });
      }
    }
  });

  upcomingBillsList.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  const upcomingBills = upcomingBillsList.slice(0, 6);
  const pendingUpcomingCount = upcomingBills.filter((b) => !b.isPaidFuture).length;
  const futurePaidUpcomingCount = upcomingBills.filter((b) => b.isPaidFuture).length;

  // Mini Sparkline Data for Income/Expense
  const daysInMonth = Array.from({ length: 15 }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, '0');
    const dayDate = `${selectedMonth}-${dayStr}`;
    const exp = monthTransactions
      .filter((t) => t.type === 'expense' && t.date === dayDate)
      .reduce((s, t) => s + t.amount, 0);
    return { day: `${i + 1}`, wydatek: exp };
  });

  // Fetch AI Financial Advice
  const fetchAdvice = async () => {
    try {
      setLoadingAdvice(true);
      setAdviceError(null);
      const advice = await getFinancialAdviceWithAI({
        transactions: settledMonthTransactions,
        limits: budgetLimits,
        bills: bills.filter((b) => b.status !== 'paid'),
      });
      if (advice) {
        setAiAdvice(advice);
      } else {
        setAdviceError('Nie udało się pobrać analizy finansowej.');
      }
    } catch (err: any) {
      console.error(err);
      setAdviceError(err?.message || 'Błąd połączenia z usługą analizy AI. Upewnij się, że klucz GEMINI_API_KEY jest skonfigurowany.');
    } finally {
      setLoadingAdvice(false);
    }
  };

  // Podsumowanie Zobowiązań & Pożyczek (wyłącznie wpisy z debts, bez sztucznego fallbacku do primaryLoan)
  const borrowedDebts = debts.filter((d) => d.type === 'borrowed');
  const lentDebts = debts.filter((d) => d.type === 'lent');

  // Kwoty do oddania (moje długi i kredyty)
  const totalBorrowedInitial = borrowedDebts.reduce((s, d) => s + (d.initialAmount || d.totalAmount || 0), 0);
  const totalBorrowedRemaining = borrowedDebts.reduce((s, d) => s + (d.currentRemaining ?? 0), 0);
  const totalBorrowedPaid = borrowedDebts.reduce((s, d) => s + (d.paidAmount || 0), 0);
  const borrowedPaidPercent = totalBorrowedInitial > 0 ? (totalBorrowedPaid / totalBorrowedInitial) * 100 : 0;

  // Kwoty do odzyskania (pożyczone komuś)
  const totalLentInitial = lentDebts.reduce((s, d) => s + (d.initialAmount || d.totalAmount || 0), 0);
  const totalLentRemaining = lentDebts.reduce((s, d) => s + (d.currentRemaining ?? 0), 0);
  const totalLentRecovered = lentDebts.reduce((s, d) => s + (d.paidAmount || 0), 0);
  const lentRecoveredPercent = totalLentInitial > 0 ? (totalLentRecovered / totalLentInitial) * 100 : 0;

  // Miesięczne raty stałe (kredyty bankowe i pożyczki) - TYLKO dla aktywnych, niespłaconych zobowiązań
  const activeBorrowedDebts = borrowedDebts.filter((d) => (d.currentRemaining ?? 0) > 0 && d.status !== 'paid' && d.status !== 'settled');
  const activeLentDebts = lentDebts.filter((d) => (d.currentRemaining ?? 0) > 0 && d.status !== 'paid' && d.status !== 'settled');
  
  const totalMonthlyInstallments = activeBorrowedDebts.reduce((s, d) => {
    const remaining = d.currentRemaining ?? 0;
    const payment = d.monthlyPayment || 0;
    if (payment <= 0) return s;
    const effectivePayment = payment <= remaining ? payment : remaining;
    return s + effectivePayment;
  }, 0);

  const activeBankDebt = debts.find((d) => (d.isBankLoan || d.category === 'kredyt_bankowy') && (d.currentRemaining ?? 0) > 0);
  const primaryBankDebt = activeBankDebt || debts.find((d) => d.isBankLoan || d.category === 'kredyt_bankowy');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Top Balance Banner & Quick Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Balance Card with Touch Swipe for Mobile Month Switching */}
        <div
          {...touchHandlers}
          className={`lg:col-span-2 bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between border transition-all duration-200 select-none touch-pan-y ${
            swipeFeedback === 'next'
              ? '-translate-x-1.5 opacity-90 border-indigo-500/50'
              : swipeFeedback === 'prev'
              ? 'translate-x-1.5 opacity-90 border-indigo-500/50'
              : swipeFeedback === 'blocked'
              ? 'border-amber-500/80 -translate-x-0.5 shadow-amber-500/20'
              : 'border-slate-800'
          }`}
        >
          {swipeFeedback === 'blocked' && (
            <div className="absolute top-2 inset-x-0 mx-auto w-max z-30 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full shadow-lg animate-in fade-in zoom-in-95">
              Przyszły miesiąc jest zablokowany (brak transakcji)
            </div>
          )}
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                  Stan Budżetu • {selectedMonth}
                </span>

                {/* Dyskretna ikonka przesunięcia bilansu poprzedniego miesiąca */}
                {onAddTransaction && onDeleteTransaction && (
                  <MonthRolloverControl
                    selectedMonth={selectedMonth}
                    transactions={transactions}
                    onAddTransaction={onAddTransaction}
                    onDeleteTransaction={onDeleteTransaction}
                    onNavigateToMonth={onMonthChange}
                    variant="icon"
                    theme="dark"
                  />
                )}
              </div>

              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30 shrink-0">
                Stopa oszczędności: {savingsRate}%
              </span>
            </div>

            <div
              id="dashboard-net-balance-card"
              onClick={() => onNavigate('transactions', { transactionFilter: 'all' })}
              className="mt-4 p-2.5 -m-2.5 rounded-2xl hover:bg-slate-800/80 cursor-pointer transition-all group/balance"
              title="Kliknij, aby przejść do wszystkich transakcji"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium flex items-center space-x-1">
                  <span>Bieżący bilans netto</span>
                  <span className="text-[10px] text-indigo-300 opacity-0 group-hover/balance:opacity-100 transition-opacity">
                    (pokaż transakcje →)
                  </span>
                </span>
              </div>
              <p
                className={`text-3xl sm:text-4xl font-black tracking-tight mt-0.5 ${
                  balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {balance >= 0 ? '+' : ''}
                {balance.toFixed(2)} <span className="text-lg font-bold text-slate-300">PLN</span>
              </p>
              {futureExpense > 0 && (
                <div className="mt-2 inline-flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg">
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    <strong className={projectedBalance >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {projectedBalance >= 0 ? '+' : ''}{projectedBalance.toFixed(2)} zł
                    </strong>
                    <span className="text-slate-400 ml-1.5">po opłaceniu zleconego rachunku</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div
                id="dashboard-income-card"
                onClick={() => onNavigate('transactions', { transactionFilter: 'income' })}
                className="p-2 -m-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-all group/inc active:scale-98"
                title="Kliknij, aby przejść do transakcji z filtrem: tylko wpłaty i dochody"
              >
                <span className="text-xs text-slate-400 flex items-center space-x-1 group-hover/inc:text-emerald-300 transition-colors">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Wpłaty & Dochody</span>
                </span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5 flex items-center justify-between">
                  <span>+{totalIncome.toFixed(2)} zł</span>
                  <span className="text-[11px] text-slate-500 group-hover/inc:text-slate-300 transition-colors">→</span>
                </p>
              </div>

              <div
                id="dashboard-expense-card"
                onClick={() => onNavigate('transactions', { transactionFilter: 'expense' })}
                className="p-2 -m-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-all group/exp active:scale-98"
                title="Kliknij, aby przejść do transakcji z filtrem: tylko wydatki"
              >
                <span className="text-xs text-slate-400 flex items-center space-x-1 group-hover/exp:text-rose-300 transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                  <span>Wydatki łączne</span>
                </span>
                <p className="text-lg font-bold text-rose-400 mt-0.5 flex items-center justify-between">
                  <span>-{totalExpense.toFixed(2)} zł</span>
                  <span className="text-[11px] text-slate-500 group-hover/exp:text-slate-300 transition-colors">→</span>
                </p>
                {futureExpense > 0 && (
                  <span className="text-[10px] text-amber-300 font-medium block mt-0.5">
                    +{futureExpense.toFixed(2)} zł zlecone
                  </span>
                )}
              </div>
            </div>

            {/* Mobile swipe gesture guide */}
            <div className="sm:hidden flex items-center justify-center space-x-1.5 mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
              <span>‹ Przesuń palcem w lewo / prawo, aby zmienić miesiąc ›</span>
            </div>
          </div>
        </div>

        {/* Action Hub */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Szybkie Akcje</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => onNavigate('scanner')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-indigo-600 text-white w-fit group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Skanuj Paragon</span>
            </button>

            <button
              onClick={() => onNavigate('transactions')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-emerald-600 text-white w-fit group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Transakcje</span>
            </button>

            <button
              onClick={() => onNavigate('shopping')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-amber-600 text-white w-fit group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Listy Zakupów</span>
            </button>

            <button
              onClick={() => onNavigate('bills')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-white w-fit group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Rachunki i Media</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Upcoming Bills Alert Strip */}
      {upcomingBills.length > 0 && (
        <div
          className={`rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs border ${
            pendingUpcomingCount === 0 && futurePaidUpcomingCount > 0
              ? 'bg-emerald-50/90 border-emerald-200'
              : 'bg-amber-50/80 border-amber-200'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div
              className={`p-2 rounded-xl flex-shrink-0 mt-0.5 border ${
                pendingUpcomingCount === 0 && futurePaidUpcomingCount > 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              {pendingUpcomingCount === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-amber-800" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Zbliżające się terminy płatności rachunków ({upcomingBills.length})
                </h4>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    pendingUpcomingCount === 0
                      ? 'text-emerald-800 bg-emerald-100/90'
                      : 'text-amber-800 bg-amber-100/90'
                  }`}
                >
                  {pendingUpcomingCount > 0 ? `${pendingUpcomingCount} do opłacenia` : 'Bieżące rachunki uregulowane'}
                  {futurePaidUpcomingCount > 0 && ` • ${futurePaidUpcomingCount} opłacone z góry`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {upcomingBills.map((b) => {
                  if (b.isPaidFuture) {
                    return (
                      <div
                        key={b.id}
                        onClick={() => onNavigate('bills')}
                        className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 bg-white hover:bg-emerald-50/70 rounded-xl border border-emerald-300 text-slate-800 shadow-2xs transition-all cursor-pointer group text-left"
                        title={`Rachunek "${b.name}" został już opłacony z datą przyszłą: ${b.targetDate}. Zostanie uwzględniony w saldzie w tym dniu. Kliknij, aby otworzyć rachunki.`}
                      >
                        <div>
                          <strong className="text-slate-900 font-bold group-hover:text-emerald-950">{b.name}</strong>
                          <span className="text-slate-700 ml-1 font-semibold">{b.amount.toFixed(2)} zł</span>
                          <span className="text-[10px] text-emerald-700 block sm:inline sm:ml-1 font-medium">
                            Termin: {b.targetDate}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold shrink-0 flex items-center space-x-1 shadow-2xs ml-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Opłacone</span>
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={b.id}
                      onClick={() => onNavigate('bills', { payBillId: b.billId })}
                      className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 bg-white hover:bg-amber-100/80 rounded-xl border border-amber-300 text-slate-800 shadow-2xs transition-all cursor-pointer group active:scale-95 text-left"
                      title={`Kliknij, aby natychmiast przejść do opłacenia rachunku: ${b.name}`}
                    >
                      <div>
                        <strong className="text-slate-900 font-bold group-hover:text-amber-950">{b.name}</strong>
                        <span className="text-slate-700 ml-1 font-semibold">{b.amount.toFixed(2)} zł</span>
                        <span className="text-[10px] text-slate-400 block sm:inline sm:ml-1">Termin: {b.targetDate}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shrink-0 flex items-center space-x-1 shadow-2xs transition-colors ml-1">
                        <CreditCard className="w-3 h-3" />
                        <span>Opłać</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('bills')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shadow-xs"
          >
            Wszystkie rachunki →
          </button>
        </div>
      )}

      {/* 3. Grid: Shopping Overview + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Col 1: Shopping Lists Quick View */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Listy Zakupów</h3>
            </div>
            <button
              onClick={() => onNavigate('shopping')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Otwórz koszyk →
            </button>
          </div>

          <div className="space-y-2.5">
            {(() => {
              // Deduplicate by name and filter out hidden lists
              const seenNames = new Set<string>();
              const visibleLists = shoppingLists
                .filter((l) => {
                  if (l.isHidden) return false;
                  const key = (l.name || l.category || '').trim().toLowerCase();
                  if (!key || seenNames.has(key)) return false;
                  seenNames.add(key);
                  return true;
                })
                .sort((a, b) => (b.priority || 0) - (a.priority || 0));

              if (visibleLists.length === 0) {
                return (
                  <p className="text-xs text-slate-400 text-center py-4">Brak aktywnych list zakupów</p>
                );
              }

              return visibleLists.map((list) => {
                const listItems = shoppingItems.filter(
                  (i) => i.listId === list.id || i.category?.toLowerCase() === list.name?.toLowerCase() || i.category?.toLowerCase() === list.category?.toLowerCase()
                );
                const pending = listItems.filter((i) => !i.isCompleted).length;
                if (listItems.length === 0) return null;
                return (
                  <div
                    key={list.id}
                    onClick={() =>
                      onNavigate('shopping', {
                        shoppingCategory: list.name || list.category,
                        shoppingTab: pending === 0 ? 'completed' : 'active',
                      })
                    }
                    className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 transition-all border border-slate-100 hover:border-indigo-200 cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                    title={`Kliknij, aby otworzyć listę "${list.name}" (${pending === 0 ? 'zakładka: Kupione' : 'zakładka: Do kupienia'})`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: list.color || '#4f46e5' }}
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                          {list.name}
                        </h4>
                        <p className="text-[10px] text-slate-400">{list.category}</p>
                      </div>
                    </div>

                    <span className={`text-xs font-semibold ${pending === 0 ? 'text-emerald-700 font-bold' : 'text-slate-600 group-hover:text-indigo-700'}`}>
                      {pending === 0 ? 'Wszystko kupione' : `${pending} do kupienia →`}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Col 2: Recent Transactions Stream */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Ostatnie Transakcje</h3>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Wszystkie ({transactions.length}) →
            </button>
          </div>

          <div className="space-y-2.5">
            {monthTransactions.slice(0, 4).map((item) => {
              const isIncome = item.type === 'income';
              const isFuture = item.date > todayStr;
              return (
                <div
                  key={item.id}
                  onClick={() =>
                    onNavigate('transactions', {
                      selectedTxId: item.id,
                      transactionSearch: item.title,
                      transactionFilter: item.type,
                    })
                  }
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-300 text-xs cursor-pointer transition-all active:scale-[0.99] group"
                  title="Kliknij, aby przejść do tej transakcji"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5 truncate">
                      <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {item.title}
                      </p>
                      {isFuture && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                          Zaplanowane
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">{item.date} • {item.category}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-black whitespace-nowrap block ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {item.amount.toFixed(2)} zł
                    </span>
                    <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">szczegóły →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Sekcja Podsumowania Zobowiązań (Poniżej ostatnich transakcji, a przed limitami wydatków) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs transition-all">
        <div
          onClick={() => setIsDebtsExpanded((prev) => !prev)}
          className={`flex items-center justify-between gap-3 cursor-pointer select-none group ${
            isDebtsExpanded ? 'pb-3 border-b border-slate-100 mb-4' : ''
          }`}
          title={isDebtsExpanded ? 'Kliknij, aby zwinąć podsumowanie zobowiązań' : 'Kliknij, aby odkryć podsumowanie zobowiązań'}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 group-hover:bg-indigo-100 transition-colors shrink-0">
              <HandCoins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                  <span>Podsumowanie Zobowiązań</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform duration-200 ${
                      isDebtsExpanded ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </h3>
                {primaryBankDebt?.bankName && (
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md">
                    {primaryBankDebt.bankName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate sm:whitespace-normal">
                {borrowedDebts.length > 0 || lentDebts.length > 0
                  ? `${activeBorrowedDebts.length} aktywnych do spłaty (${borrowedDebts.length} ogółem) • ${activeLentDebts.length} do odzyskania`
                  : 'Brak aktywnych zobowiązań i pożyczek'}
                {activeBankDebt?.paymentDayOfMonth && (
                  <> • Rata bankowa: każdego <strong className="text-slate-700">{activeBankDebt.paymentDayOfMonth}.</strong> dnia miesiąca</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors hidden sm:inline">
              {isDebtsExpanded ? 'Zwiń' : 'Rozwiń'}
            </span>
            <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isDebtsExpanded ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* 3 Metric Cards: Ile muszę oddać | Ile ktoś musi mi oddać | Miesięczne raty */}
        {isDebtsExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 animate-in fade-in duration-150">
            {/* Card 1: Ile muszę oddać */}
            <div
              onClick={() => onNavigate('debts')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-rose-50/40 border border-slate-100 hover:border-rose-200 transition-all cursor-pointer space-y-2 group"
              title="Kliknij, aby otworzyć listę zobowiązań do spłaty"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center justify-between">
                <span className="group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  <span>Ile muszę oddać</span>
                  <span className="text-slate-400">→</span>
                </span>
                <span className="text-slate-500 font-medium">({borrowedDebts.length} poz.)</span>
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-black text-rose-600">
                  {totalBorrowedRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                </span>
                <span className="text-[11px] text-slate-400">
                  / {totalBorrowedInitial.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Spłacono: {totalBorrowedPaid.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</span>
                  <span className="font-bold text-rose-600">{borrowedPaidPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(totalBorrowedPaid > 0 ? 1 : 0, borrowedPaidPercent))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Ile ktoś musi mi oddać */}
            <div
              onClick={() => onNavigate('debts')}
              className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer space-y-2 group"
              title="Kliknij, aby otworzyć listę pożyczek udzielonych innym"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                <span className="group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  <span>Ile ktoś musi mi oddać</span>
                  <span className="text-slate-400">→</span>
                </span>
                <span className="text-slate-500 font-medium">({lentDebts.length} poz.)</span>
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-black text-emerald-600">
                  {totalLentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                </span>
                <span className="text-[11px] text-slate-400">
                  / {totalLentInitial.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Odzyskano: {totalLentRecovered.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</span>
                  <span className="font-bold text-emerald-600">{lentRecoveredPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(totalLentRecovered > 0 ? 1 : 0, lentRecoveredPercent))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Miesięczne raty / Oprocentowanie */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Miesięczne raty kredytów
                </span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className={`text-xl font-black ${totalMonthlyInstallments > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                    {totalMonthlyInstallments.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                  </span>
                  <span className="text-[11px] text-slate-500">/ mies.</span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                  {totalMonthlyInstallments <= 0 && totalBorrowedRemaining <= 0 && totalBorrowedInitial > 0 ? (
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <span>Wszystkie raty spłacone</span>
                    </p>
                  ) : activeBankDebt?.interestRate ? (
                    <p className="text-[11px] text-slate-500">
                      Oprocentowanie: <strong className="text-amber-600">{activeBankDebt.interestRate}%</strong>
                      {activeBankDebt?.loanTermYears && (
                        <span> ({activeBankDebt.loanTermYears} lat)</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      {totalMonthlyInstallments > 0 ? 'Stałe raty z harmonogramów' : 'Brak aktywnych rat'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onNavigate('debts')}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center space-x-1 mt-2 group cursor-pointer"
              >
                <span>Szczegóły, kalkulator & historia</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Sekcja Limitów Wydatków (Pomiędzy kredytem a asystentem AI) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">Limity Wydatków</h3>
              <p className="text-xs text-slate-500">Miesięczna kontrola budżetu w kluczowych kategoriach.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('limits')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <span>Wszystkie limity ({budgetLimits.length})</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {budgetLimits.slice(0, 4).map((limit) => {
            const spent = settledMonthTransactions
              .filter((t) => t.category === limit.category && t.type === 'expense')
              .reduce((s, t) => s + t.amount, 0);
            const futureSpent = futureMonthTransactions
              .filter((t) => t.category === limit.category && t.type === 'expense')
              .reduce((s, t) => s + t.amount, 0);
            const percent = limit.monthlyLimit > 0 ? (spent / limit.monthlyLimit) * 100 : 0;

            return (
              <div
                key={limit.id}
                onClick={() => onNavigate('limits', { limitCategory: limit.category })}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all space-y-2 group active:scale-[0.99]"
                title={`Kliknij, aby przejść do limitu dla: ${limit.category}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 group-hover:text-indigo-900 truncate">
                    {limit.category}
                  </span>
                  <span className="font-black text-slate-900 shrink-0">
                    {spent.toFixed(0)} / {limit.monthlyLimit.toFixed(0)} zł
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      percent >= 100
                        ? 'bg-rose-500'
                        : percent >= 80
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className={percent >= 100 ? 'text-rose-600 font-bold' : percent >= 80 ? 'text-amber-600 font-bold' : ''}>
                    {percent.toFixed(0)}% wykorzystane
                    {futureSpent > 0 && (
                      <span className="text-indigo-600 font-normal ml-1">
                        (+{futureSpent.toFixed(0)} zł plan)
                      </span>
                    )}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 text-indigo-600 font-semibold transition-opacity">
                    edytuj →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. AI Financial Advisor Card (At the very end of the dashboard) */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Asystent finansowy AI</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatycznie analizuje wydatki, rachunki i limity, sugerując oszczędności na podstawie danych.
              </p>
            </div>
          </div>

          <button
            onClick={fetchAdvice}
            disabled={loadingAdvice}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loadingAdvice ? 'Generowanie wskazówek...' : 'Uzyskaj analizę AI'}</span>
          </button>
        </div>

        {adviceError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs sm:text-sm text-rose-200 flex items-center justify-between gap-3 animate-in fade-in">
            <span>{adviceError}</span>
            <button
              onClick={fetchAdvice}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {aiAdvice && typeof aiAdvice === 'object' && (
          <div className="mt-5 space-y-4 p-5 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-200 animate-in fade-in">
            {/* Health & Savings Rate Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Kondycja finansowa:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    aiAdvice.financialHealth === 'Doskonała'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : aiAdvice.financialHealth === 'Dobra'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : aiAdvice.financialHealth === 'Umiarkowana'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {aiAdvice.financialHealth}
                </span>
              </div>

              {typeof aiAdvice.savingsRatePercent === 'number' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-700 text-slate-300">
                  Wskaźnik oszczędności: <strong className="text-white">{aiAdvice.savingsRatePercent}%</strong>
                </span>
              )}
            </div>

            {/* Summary sentence */}
            {aiAdvice.summary && (
              <p className="text-sm text-slate-100 font-medium italic border-l-2 border-indigo-400 pl-3">
                „{aiAdvice.summary}”
              </p>
            )}

            {/* Alerts */}
            {aiAdvice.alerts && aiAdvice.alerts.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  Uwagi i alerty budżetowe
                </span>
                <div className="space-y-1">
                  {aiAdvice.alerts.map((alert, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Tips */}
            {aiAdvice.actionableTips && aiAdvice.actionableTips.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                  Praktyczne rekomendacje oszczędnościowe
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  {aiAdvice.actionableTips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-xs text-slate-300 flex items-start space-x-2"
                    >
                      <span className="font-bold text-indigo-400 shrink-0">{idx + 1}.</span>
                      <span className="leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {aiAdvice && typeof aiAdvice === 'string' && (
          <div className="mt-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs sm:text-sm text-slate-200 leading-relaxed animate-in fade-in">
            <p className="whitespace-pre-line">{aiAdvice}</p>
          </div>
        )}
      </div>
    </div>
  );
};
