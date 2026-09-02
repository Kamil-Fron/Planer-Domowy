import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  PieChart as PieIcon,
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { Transaction, Bill, BudgetLimit } from '../types';
import { INITIAL_CATEGORIES } from '../mockData';
import { exportTransactionsToCSV, exportBillsToCSV, generatePDFReport } from '../utils/export';

interface ReportsViewProps {
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  selectedMonth: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  bills,
  budgetLimits,
  selectedMonth,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'daily' | 'category' | 'monthly'>('category');

  // Filter current month transactions
  const monthTransactions = transactions.filter(
    (t) => !selectedMonth || t.date.startsWith(selectedMonth)
  );

  const monthExpenses = monthTransactions.filter((t) => t.type === 'expense');
  const monthIncomes = monthTransactions.filter((t) => t.type === 'income');

  const totalExpense = monthExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = monthIncomes.reduce((s, t) => s + t.amount, 0);

  // 1. Prepare Category Structure Data for Pie / Donut
  const categoryMap: Record<string, number> = {};
  monthExpenses.forEach((t) => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const categoryPieData = Object.entries(categoryMap).map(([name, value]) => {
    const matched = INITIAL_CATEGORIES.find((c) => c.name === name);
    return {
      name,
      value: parseFloat(value.toFixed(2)),
      color: matched?.color || '#64748b',
    };
  }).sort((a, b) => b.value - a.value);

  // 2. Prepare Daily Expense Trend Data
  const dailyMap: Record<string, number> = {};
  monthExpenses.forEach((t) => {
    const day = t.date.split('-')[2] || t.date;
    dailyMap[day] = (dailyMap[day] || 0) + t.amount;
  });

  const dailyData = Object.entries(dailyMap)
    .map(([day, amount]) => ({
      day: `${parseInt(day)} d.`,
      rawDay: day,
      amount: parseFloat(amount.toFixed(2)),
    }))
    .sort((a, b) => parseInt(a.rawDay) - parseInt(b.rawDay));

  // 3. Prepare Monthly Comparison Data (Last 4 Months)
  const monthsList = ['2026-06', '2026-07', '2026-08', '2026-09'];
  const monthlyData = monthsList.map((m) => {
    const mTrans = transactions.filter((t) => t.date.startsWith(m));
    const inc = mTrans.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTrans.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const mNames: Record<string, string> = {
      '2026-06': 'Czerwiec',
      '2026-07': 'Lipiec',
      '2026-08': 'Sierpień',
      '2026-09': 'Wrzesień',
    };
    return {
      month: mNames[m] || m,
      Dochody: parseFloat(inc.toFixed(2)),
      Wydatki: parseFloat(exp.toFixed(2)),
      Oszczędności: parseFloat((inc - exp).toFixed(2)),
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <PieIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Wykresy Graficzne & Raporty Budżetowe</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Wizualna struktura wydatków, trendy dzienne i miesięczne oraz eksport raportów do PDF i arkusza CSV (Excel).
          </p>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => exportTransactionsToCSV(transactions, selectedMonth)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Eksport CSV (Transakcje)</span>
          </button>

          <button
            onClick={() => generatePDFReport(transactions, bills, budgetLimits, selectedMonth)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors border border-slate-200 shadow-xs"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Pobierz Raport PDF</span>
          </button>

          <button
            onClick={() => exportBillsToCSV(bills)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors border border-slate-200 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Rachunki CSV</span>
          </button>
        </div>
      </div>

      {/* Chart View Switcher Tabs */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveChartTab('category')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeChartTab === 'category'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PieIcon className="w-4 h-4 text-indigo-600" />
          <span>Struktura kategorii wydatków</span>
        </button>

        <button
          onClick={() => setActiveChartTab('daily')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeChartTab === 'daily'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Wykres dzienny wydatków</span>
        </button>

        <button
          onClick={() => setActiveChartTab('monthly')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeChartTab === 'monthly'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span>Porównanie miesięczne</span>
        </button>
      </div>

      {/* Main Charts Render */}
      {activeChartTab === 'category' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <PieIcon className="w-5 h-5 text-purple-600" />
              <span>Procentowy udział kategorii w wydatkach ({selectedMonth})</span>
            </h3>

            {categoryPieData.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs">
                Brak zarejestrowanych wydatków w wybranym okresie.
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${value} PLN`, 'Kwota']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Category Breakdown Table / Cards */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
              Kategorie wydatków (PLN & %)
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 divide-y divide-slate-100">
              {categoryPieData.map((cat) => {
                const percent = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                return (
                  <div key={cat.name} className="pt-2.5 first:pt-0">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900 mb-1">
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span className="font-bold whitespace-nowrap">{cat.value.toFixed(2)} zł</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mr-2">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${percent}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      <span className="whitespace-nowrap font-medium">{percent.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeChartTab === 'daily' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <span>Dynamika wydatków w poszczególnych dniach ({selectedMonth})</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Suma: {totalExpense.toFixed(2)} PLN</span>
          </div>

          {dailyData.length === 0 ? (
            <div className="py-24 text-center text-slate-400 text-xs">
              Brak zarejestrowanych wydatków dziennych w wybranym okresie.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} PLN`, 'Wydano']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeChartTab === 'monthly' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2 pb-2 border-b border-slate-100">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span>Porównanie dochodów, wydatków i oszczędności (Miesiąc do miesiąca)</span>
          </h3>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value: any) => [`${value} PLN`]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Dochody" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Wydatki" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Oszczędności" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
