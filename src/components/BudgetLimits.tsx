import React, { useState } from 'react';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Edit3,
  Check,
} from 'lucide-react';
import { BudgetLimit, Transaction } from '../types';
import { INITIAL_CATEGORIES } from '../mockData';

interface BudgetLimitsProps {
  budgetLimits: BudgetLimit[];
  transactions: Transaction[];
  onUpdateLimit: (id: string, newLimit: number, threshold?: number) => void;
  onAddLimit: (limit: Omit<BudgetLimit, 'id'>) => void;
  onDeleteLimit: (id: string) => void;
  selectedMonth: string;
}

export const BudgetLimits: React.FC<BudgetLimitsProps> = ({
  budgetLimits,
  transactions,
  onUpdateLimit,
  onAddLimit,
  onDeleteLimit,
  selectedMonth,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // New limit form
  const [newCategory, setNewCategory] = useState(INITIAL_CATEGORIES[0].name);
  const [newLimitAmount, setNewLimitAmount] = useState('1000');
  const [newThreshold, setNewThreshold] = useState('80');

  // Filter current month expenses
  const currentExpenses = transactions.filter(
    (t) => t.type === 'expense' && (!selectedMonth || t.date.startsWith(selectedMonth))
  );

  // Calculate total budget & total spent across limited categories
  const totalBudget = budgetLimits.reduce((s, l) => s + l.monthlyLimit, 0);
  const totalSpentAcrossLimits = budgetLimits.reduce((s, l) => {
    const spent = currentExpenses
      .filter((t) => t.category === l.category)
      .reduce((sum, t) => sum + t.amount, 0);
    return s + spent;
  }, 0);

  const startEdit = (limit: BudgetLimit) => {
    setEditingId(limit.id);
    setEditLimitValue(limit.monthlyLimit);
  };

  const saveEdit = (id: string) => {
    onUpdateLimit(id, editLimitValue);
    setEditingId(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLimitAmount) return;

    const matchedCat = INITIAL_CATEGORIES.find((c) => c.name === newCategory);
    onAddLimit({
      category: newCategory,
      monthlyLimit: parseFloat(newLimitAmount),
      notifyAtPercent: parseInt(newThreshold) || 80,
      color: matchedCat?.color || '#10b981',
    });

    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Target className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Limity Budżetowe dla Kategorii</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Ustalaj miesięczne cele i maksymalne kwoty wydatków dla każdej kategorii. Otrzymasz ostrzeżenie, gdy wydatki
            zbliżą się do limitu (80%) lub go przekroczą.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj limit dla kategorii</span>
        </button>
      </div>

      {/* Global Limit KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Łączny ustalony budżet</span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalBudget.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Dla {budgetLimits.length} monitorowanych kategorii
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Aktualnie wydano</span>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {totalSpentAcrossLimits.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">
              {totalBudget > 0 ? ((totalSpentAcrossLimits / totalBudget) * 100).toFixed(0) : 0}% całego budżetu
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Pozostały limit do dyspozycji</span>
            <p
              className={`text-2xl font-black mt-1 ${
                totalBudget - totalSpentAcrossLimits >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {(totalBudget - totalSpentAcrossLimits).toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">Bezpieczny margines wydatków</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Limits List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {budgetLimits.map((limit) => {
          const categorySpent = currentExpenses
            .filter((t) => t.category === limit.category)
            .reduce((sum, t) => sum + t.amount, 0);

          const percent = limit.monthlyLimit > 0 ? (categorySpent / limit.monthlyLimit) * 100 : 0;
          const remaining = limit.monthlyLimit - categorySpent;
          const threshold = limit.notifyAtPercent || 80;

          let statusBadge = {
            label: 'W normie',
            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            barBg: 'bg-indigo-600',
            icon: CheckCircle2,
          };

          if (percent >= 100) {
            statusBadge = {
              label: 'PRZEKROCZONY!',
              bg: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
              barBg: 'bg-rose-500',
              icon: AlertTriangle,
            };
          } else if (percent >= threshold) {
            statusBadge = {
              label: `Uwaga (${percent.toFixed(0)}%)`,
              bg: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
              barBg: 'bg-amber-500',
              icon: AlertTriangle,
            };
          }

          const StatusIcon = statusBadge.icon;

          return (
            <div
              key={limit.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {/* Top Row: Category title + Badge + delete */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: limit.color || '#4f46e5' }}
                    />
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                      {limit.category}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${statusBadge.bg}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusBadge.label}</span>
                    </span>
                    <button
                      onClick={() => onDeleteLimit(limit.id)}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                      title="Usuń limit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Spent vs Limit numbers */}
                <div className="my-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Wydano w tym miesiącu</span>
                    <span className="text-xl font-black text-slate-900">
                      {categorySpent.toFixed(2)} <span className="text-xs font-semibold text-slate-500">PLN</span>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Miesięczny limit</span>
                    {editingId === limit.id ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={editLimitValue}
                          onChange={(e) => setEditLimitValue(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg text-right"
                        />
                        <button
                          onClick={() => saveEdit(limit.id)}
                          className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(limit)}
                        className="flex items-center justify-end space-x-1 text-slate-700 hover:text-indigo-600 cursor-pointer group"
                        title="Kliknij aby zmienić limit"
                      >
                        <span className="text-base font-bold">{limit.monthlyLimit.toFixed(2)} PLN</span>
                        <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${statusBadge.barBg}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>Zużycie: {percent.toFixed(0)}%</span>
                    <span>
                      {remaining >= 0 ? (
                        <>Pozostało: <strong className="text-emerald-700">{remaining.toFixed(2)} PLN</strong></>
                      ) : (
                        <>Przekroczenie o: <strong className="text-rose-600">{Math.abs(remaining).toFixed(2)} PLN</strong></>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Slider Quick Adjust */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-2">
                <span className="text-[11px] text-slate-400">Dostosuj limit:</span>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={limit.monthlyLimit}
                  onChange={(e) => onUpdateLimit(limit.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Limit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-lg text-slate-900">Ustaw limit dla kategorii</h3>
            <p className="text-xs text-slate-500">
              Wybierz kategorię wydatków oraz określ maksymalną kwotę na miesiąc.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategoria *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
                >
                  {INITIAL_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Miesięczny limit (PLN) *
                </label>
                <input
                  type="number"
                  step="50"
                  min="10"
                  required
                  value={newLimitAmount}
                  onChange={(e) => setNewLimitAmount(e.target.value)}
                  placeholder="np. 1500"
                  className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Próg ostrzeżenia (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Wyśle powiadomienie po osiągnięciu tego poziomu wydatków.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs"
                >
                  Zapisz limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
