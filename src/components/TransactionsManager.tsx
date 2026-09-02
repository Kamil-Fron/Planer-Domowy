import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  MessageSquare,
  Tag,
  Receipt,
  FileSpreadsheet,
  Repeat,
  DollarSign,
  ChevronDown,
  X,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES } from '../mockData';

interface TransactionsManagerProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  selectedMonth: string;
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  selectedMonth,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReceiptDetails, setSelectedReceiptDetails] = useState<Transaction | null>(null);

  // Form State
  const [formType, setFormType] = useState<TransactionType>('income');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Wypłata z etatu');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formComment, setFormComment] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);

  // Filtered list
  const filtered = transactions.filter((t) => {
    const matchesMonth = !selectedMonth || t.date.startsWith(selectedMonth);
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.comment && t.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.receiptStoreName && t.receiptStoreName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesMonth && matchesType && matchesCategory && matchesSearch;
  });

  const totalIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const handleOpenAddModal = (type: TransactionType) => {
    setFormType(type);
    if (type === 'income') {
      setFormCategory(INITIAL_INCOME_CATEGORIES[0]);
    } else {
      setFormCategory(INITIAL_CATEGORIES[0].name);
    }
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount) return;

    onAddTransaction({
      type: formType,
      title: formTitle.trim(),
      amount: parseFloat(formAmount),
      category: formCategory,
      date: formDate,
      comment: formComment.trim() || undefined,
      isRecurring: formRecurring,
    });

    setFormTitle('');
    setFormAmount('');
    setFormComment('');
    setFormRecurring(false);
    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transakcje: Wpłaty i Wydatki</h1>
          <p className="text-sm text-slate-600 mt-1">
            Zarządzaj wpłatami z wypłat i innych dochodów z komentarzem oraz wszystkimi wydatkami w jednym miejscu.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          <button
            onClick={() => handleOpenAddModal('income')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            <span>+ Wpłata / Dochód</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('expense')}
            className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-1.5 transition-colors border border-slate-200 shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
            <span>+ Wydatek</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Łączne dochody</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              +{totalIncome.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">Wpłaty, pensje, premie, zlecenia</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Łączne wydatki</span>
            <p className="text-2xl font-black text-rose-600 mt-1">
              -{totalExpense.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">Paragony, zakupy, opłaty</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Bilans bieżący</span>
            <p
              className={`text-2xl font-black mt-1 ${
                totalIncome - totalExpense >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {totalIncome - totalExpense >= 0 ? '+' : ''}
              {(totalIncome - totalExpense).toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Pozostałe wolne środki w okresie
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          {/* Type Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Wszystkie ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterType === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Wpłaty & Dochody
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterType === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Wydatki
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700"
          >
            <option value="all">Wszystkie kategorie</option>
            {INITIAL_CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
            {INITIAL_INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                💰 {c}
              </option>
            ))}
          </select>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po tytule lub komentarzu..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Transactions List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs sm:text-sm space-y-2">
            <DollarSign className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">Brak transakcji spełniających kryteria</p>
            <p className="text-slate-400">Dodaj nową wpłatę lub wydatek za pomocą przycisków powyżej.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isIncome = item.type === 'income';
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                      isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownRight className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                      {item.isRecurring && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center space-x-1">
                          <Repeat className="w-3 h-3" />
                          <span>Cykliczny</span>
                        </span>
                      )}
                      {item.receiptItems && item.receiptItems.length > 0 && (
                        <button
                          onClick={() => setSelectedReceiptDetails(item)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center space-x-1"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Paragon ({item.receiptItems.length} poz.)</span>
                        </button>
                      )}
                    </div>

                    {/* Rich Comment Display */}
                    {item.comment && (
                      <div className="mt-1.5 flex items-start space-x-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed italic">{item.comment}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-slate-400 mt-1.5">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.date}</span>
                      </span>
                      {item.receiptStoreName && <span>Sklep: {item.receiptStoreName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                  <div className="text-right">
                    <span
                      className={`text-base sm:text-lg font-black ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {item.amount.toFixed(2)} PLN
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteTransaction(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors rounded-lg"
                    title="Usuń transakcję"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {formType === 'income' ? 'Nowa wpłata / Dochód z komentarzem' : 'Nowy wydatek w budżecie'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('income');
                    setFormCategory(INITIAL_INCOME_CATEGORIES[0]);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    formType === 'income' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                  <span>Wpłata / Dochód</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('expense');
                    setFormCategory(INITIAL_CATEGORIES[0].name);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    formType === 'expense' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  <span>Wydatek</span>
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tytuł wpłaty / wydatku *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    formType === 'income'
                      ? 'np. Wynagrodzenie za sierpień, Premia projektowa, Zlecenie WWW'
                      : 'np. Zakupy spożywcze, Farba do sypialni, Karma dla kotów'
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kwota (PLN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="np. 4500.00"
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data transakcji *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium"
                >
                  {formType === 'income'
                    ? INITIAL_INCOME_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    : INITIAL_CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                </select>
              </div>

              {/* Rich Comment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Komentarz / Notatki (szczegóły źródła wpłaty, rozliczenie)
                </label>
                <textarea
                  rows={2}
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="np. Wypłata na konto z dodatkiem za nadgodziny, faktura nr 12/2026..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Recurring Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formRecurring}
                  onChange={(e) => setFormRecurring(e.target.checked)}
                  className="rounded-sm text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-medium text-slate-700">
                  Transakcja cykliczna (powtarza się co miesiąc)
                </span>
              </label>

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
                  {formType === 'income' ? 'Zapisz wpłatę' : 'Zapisz wydatek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Item Breakdown Modal */}
      {selectedReceiptDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">Pozycje z paragonu</h3>
              </div>
              <button
                onClick={() => setSelectedReceiptDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Sklep: <strong className="text-slate-800">{selectedReceiptDetails.receiptStoreName || 'Sklep'}</strong> • Data: {selectedReceiptDetails.date}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {selectedReceiptDetails.receiptItems?.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <span className="text-[10px] text-slate-400">{item.category}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.price.toFixed(2)} zł</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600">Łączna kwota:</span>
              <span className="text-base font-black text-slate-900">
                {selectedReceiptDetails.amount.toFixed(2)} PLN
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
