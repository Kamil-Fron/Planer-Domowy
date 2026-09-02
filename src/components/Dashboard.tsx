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
} from 'lucide-react';
import {
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
  TabType,
} from '../types';
import { INITIAL_CATEGORIES } from '../mockData';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  selectedMonth: string;
  onNavigate: (tab: TabType) => void;
  onQuickAddTransaction: (type: 'income' | 'expense') => void;
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
  selectedMonth,
  onNavigate,
  onQuickAddTransaction,
}) => {
  const [aiAdvice, setAiAdvice] = useState<AiAdviceData | string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // Month transactions
  const monthTransactions = transactions.filter(
    (t) => !selectedMonth || t.date.startsWith(selectedMonth)
  );

  const totalIncome = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(0) : '0';

  // Urgent / Upcoming bills
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingBills = bills
    .filter((b) => b.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const upcomingBills = pendingBills.slice(0, 3);

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
      const res = await fetch('/api/financial-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: monthTransactions,
          limits: budgetLimits,
          bills: pendingBills,
        }),
      });
      const data = await res.json();
      if (data.success && data.advice) {
        setAiAdvice(data.advice);
      } else {
        setAdviceError(data.error || 'Nie udało się pobrać analizy finansowej.');
      }
    } catch (err: any) {
      console.error(err);
      setAdviceError(err?.message || 'Błąd połączenia z usługą analizy AI.');
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Top Balance Banner & Quick Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Balance Card */}
        <div className="lg:col-span-2 bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Stan Budżetu • {selectedMonth}
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30">
                Stopa oszczędności: {savingsRate}%
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs text-slate-400 font-medium">Bieżący bilans netto</span>
              <p
                className={`text-3xl sm:text-4xl font-black tracking-tight mt-0.5 ${
                  balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {balance >= 0 ? '+' : ''}
                {balance.toFixed(2)} <span className="text-lg font-bold text-slate-300">PLN</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800">
            <div>
              <span className="text-xs text-slate-400 flex items-center space-x-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Wpłaty & Dochody</span>
              </span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">
                +{totalIncome.toFixed(2)} zł
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center space-x-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Wydatki łączne</span>
              </span>
              <p className="text-lg font-bold text-rose-400 mt-0.5">
                -{totalExpense.toFixed(2)} zł
              </p>
            </div>
          </div>
        </div>

        {/* Action Hub */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Szybkie Akcje</h3>
            <p className="text-xs text-slate-500">
              Wygodne rejestrowanie paragonów AI, wpłat z komentarzem oraz tworzenie list zakupowych.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => onNavigate('scanner')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-indigo-600 text-white w-fit group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Skanuj Paragon</span>
            </button>

            <button
              onClick={() => onQuickAddTransaction('income')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-emerald-600 text-white w-fit group-hover:scale-105 transition-transform">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Wpłata z wypłaty</span>
            </button>

            <button
              onClick={() => onNavigate('shopping')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-amber-600 text-white w-fit group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold mt-2 text-slate-800">Listy Zakupów</span>
            </button>

            <button
              onClick={() => onNavigate('bills')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 text-left transition-all flex flex-col justify-between group"
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
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 flex-shrink-0 mt-0.5 border border-amber-200">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Zbliżające się terminy płatności rachunków ({upcomingBills.length})
              </h4>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {upcomingBills.map((b) => (
                  <span
                    key={b.id}
                    className="text-xs font-medium px-2.5 py-1 bg-white rounded-lg border border-amber-200 text-slate-800 shadow-2xs"
                  >
                    <strong>{b.name}</strong>: {b.amount.toFixed(2)} zł (Termin: {b.dueDate})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('bills')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shadow-xs"
          >
            Przejdź do rachunków →
          </button>
        </div>
      )}

      {/* 3. AI Financial Advisor Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Inteligentny Asystent Finansowy Gemini AI</h3>
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

      {/* 4. Grid: Category Limits + Shopping Overview + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Budget Limits Quick View */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Limity Wydatków</h3>
            </div>
            <button
              onClick={() => onNavigate('limits')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Wszystkie →
            </button>
          </div>

          <div className="space-y-3">
            {budgetLimits.slice(0, 4).map((limit) => {
              const spent = monthTransactions
                .filter((t) => t.category === limit.category && t.type === 'expense')
                .reduce((s, t) => s + t.amount, 0);
              const percent = limit.monthlyLimit > 0 ? (spent / limit.monthlyLimit) * 100 : 0;

              return (
                <div key={limit.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{limit.category}</span>
                    <span className="font-bold text-slate-900">
                      {spent.toFixed(0)} / {limit.monthlyLimit.toFixed(0)} zł
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        percent >= 100
                          ? 'bg-rose-500'
                          : percent >= 80
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Col: Shopping Lists Quick View */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Listy Zakupów</h3>
            </div>
            <button
              onClick={() => onNavigate('shopping')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Otwórz koszyk →
            </button>
          </div>

          <div className="space-y-2.5">
            {shoppingLists.map((list) => {
              const listItems = shoppingItems.filter(
                (i) => i.listId === list.id || i.category === list.name || i.category === list.category
              );
              const pending = listItems.filter((i) => !i.isCompleted).length;
              const completed = listItems.filter((i) => i.isCompleted).length;
              if (listItems.length === 0) return null;
              return (
                <div
                  key={list.id}
                  onClick={() => onNavigate('shopping')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: list.color || '#4f46e5' }}
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{list.name}</h4>
                      <p className="text-[10px] text-slate-400">{list.category}</p>
                    </div>
                  </div>

                  <span className={`text-xs font-semibold ${pending === 0 ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
                    {pending === 0 ? 'Wszystko kupione' : `${pending} do kupienia`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Recent Transactions Stream */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900">Ostatnie Transakcje</h3>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Wszystkie ({transactions.length}) →
            </button>
          </div>

          <div className="space-y-2.5">
            {monthTransactions.slice(0, 4).map((item) => {
              const isIncome = item.type === 'income';
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-900 truncate">{item.title}</p>
                    <span className="text-[10px] text-slate-400">{item.date} • {item.category}</span>
                  </div>
                  <span
                    className={`font-black whitespace-nowrap ${
                      isIncome ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {item.amount.toFixed(2)} zł
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
