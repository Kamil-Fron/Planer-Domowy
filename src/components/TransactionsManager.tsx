import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Search,
  Trash2,
  Pencil,
  Calendar,
  MessageSquare,
  Receipt,
  Repeat,
  DollarSign,
  X,
  ListFilter,
  Check,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES } from '../mockData';

interface TransactionsManagerProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  selectedMonth: string;
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  selectedMonth,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReceiptDetails, setSelectedReceiptDetails] = useState<Transaction | null>(null);

  // Edit Modal State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editRecurring, setEditRecurring] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');

  // Form State (Add)
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

  const handleOpenEditModal = (t: Transaction) => {
    setEditingTransaction(t);
    // Use title (or comment if title is generic)
    setEditTitle(t.title);
    setEditAmount(t.amount.toString());
    setEditType(t.type);
    setEditCategory(t.category);
    setEditDate(t.date);
    setEditRecurring(!!t.isRecurring);
    setEditStoreName(t.receiptStoreName || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !editTitle.trim() || !editAmount) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (onUpdateTransaction) {
      onUpdateTransaction(editingTransaction.id, {
        title: editTitle.trim(),
        amount: parsedAmount,
        type: editType,
        category: editCategory,
        date: editDate,
        comment: undefined,
        isRecurring: editRecurring,
        receiptStoreName: editStoreName.trim() || undefined,
      });
    }

    setEditingTransaction(null);
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
      comment: undefined,
      isRecurring: formRecurring,
    });

    setFormTitle('');
    setFormAmount('');
    setFormComment('');
    setFormRecurring(false);
    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full overflow-hidden">
      {/* Header Banner - Minimalist with only 2 symbol buttons (Green Arrow Up & Red Arrow Down) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Transakcje</h1>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            Wpłaty, pensje, wydatki i paragony
          </p>
        </div>

        {/* 2 Symbol-Only Buttons: Green Arrow Up (Income) & Red Arrow Down (Expense) */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => handleOpenAddModal('income')}
            className="h-11 w-11 sm:h-10 sm:w-10 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl flex items-center justify-center transition-all shadow-xs"
            title="Dodaj wpłatę / dochód"
            aria-label="Wpłata / Dochód"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            onClick={() => handleOpenAddModal('expense')}
            className="h-11 w-11 sm:h-10 sm:w-10 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl flex items-center justify-center transition-all shadow-xs"
            title="Dodaj wydatek"
            aria-label="Wydatek"
          >
            <ArrowDown className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* KPI Cards - Clean, concise */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">Dochody</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 truncate">
              +{totalIncome.toFixed(2)} PLN
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">Wydatki</span>
            <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 truncate">
              -{totalExpense.toFixed(2)} PLN
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <ArrowDown className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block truncate">Bilans</span>
            <p
              className={`text-xl sm:text-2xl font-black mt-0.5 truncate ${
                totalIncome - totalExpense >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {totalIncome - totalExpense >= 0 ? '+' : ''}
              {(totalIncome - totalExpense).toFixed(2)} PLN
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
        <div className="flex items-center space-x-2 w-full sm:w-auto min-w-0">
          {/* Symbol Filter Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
              title="Wszystkie"
            >
              Wszystkie ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 ${
                filterType === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
              title="Tylko wpłaty"
            >
              <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span className="hidden sm:inline">Wpłaty</span>
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 ${
                filterType === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
              }`}
              title="Tylko wydatki"
            >
              <ArrowDown className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
              <span className="hidden sm:inline">Wydatki</span>
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700 max-w-[140px] sm:max-w-xs truncate"
          >
            <option value="all">Kategorie (wszystkie)</option>
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
        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Transactions List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100 w-full">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs sm:text-sm space-y-2">
            <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">Brak transakcji</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isIncome = item.type === 'income';
            return (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors max-w-full overflow-hidden"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {item.title}
                      </h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0 truncate max-w-[120px]">
                        {item.category}
                      </span>
                      {item.isRecurring && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center space-x-0.5 shrink-0" title="Cykliczny">
                          <Repeat className="w-3 h-3" />
                        </span>
                      )}
                      {item.receiptItems && item.receiptItems.length > 0 && (
                        <button
                          onClick={() => setSelectedReceiptDetails(item)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center space-x-1 shrink-0"
                          title="Pokaż pozycje z paragonu"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>{item.receiptItems.length} poz.</span>
                        </button>
                      )}
                    </div>

                    {item.comment && item.comment.trim() !== item.title.trim() && (
                      <div className="mt-1 flex items-center space-x-1 text-[11px] text-slate-500 truncate max-w-full">
                        <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate italic">{item.comment}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1 truncate">
                      <span className="flex items-center space-x-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        <span>{item.date}</span>
                      </span>
                      {item.receiptStoreName && <span className="truncate">Sklep: {item.receiptStoreName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span
                    className={`text-sm sm:text-base font-black whitespace-nowrap ${
                      isIncome ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {item.amount.toFixed(2)} zł
                  </span>

                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg"
                    title="Edytuj transakcję"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteTransaction(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-lg"
                    title="Usuń"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Pencil className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Edycja transakcji</h3>
              </div>
              <button
                onClick={() => setEditingTransaction(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditType('income');
                    setEditCategory(INITIAL_INCOME_CATEGORIES[0]);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    editType === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  <span>Wpłata</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditType('expense');
                    setEditCategory(INITIAL_CATEGORIES[0].name);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    editType === 'expense' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                  <span>Wydatek</span>
                </button>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kwota (PLN) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Komentarz */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Komentarz <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={editType === 'income' ? 'np. Wynagrodzenie, Premia' : 'np. Zakupy spożywcze, Paliwo'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategoria</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                >
                  {editType === 'income'
                    ? INITIAL_INCOME_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    : INITIAL_CATEGORIES.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                </select>
              </div>

              {/* Store Name (if expense) */}
              {editType === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sklep / Miejsce zakupu (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    placeholder="np. Biedronka, Lidl, Orlen"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              )}

              {/* Recurring */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editRecurring"
                  checked={editRecurring}
                  onChange={(e) => setEditRecurring(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="editRecurring" className="text-xs text-slate-700 select-none cursor-pointer">
                  Cykliczny (np. comiesięczna pensja lub stały wydatek)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Zapisz zmiany</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                {formType === 'income' ? (
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                    <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                  </div>
                )}
                <h3 className="font-bold text-base text-slate-900">
                  {formType === 'income' ? 'Nowa wpłata' : 'Nowy wydatek'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('income');
                    setFormCategory(INITIAL_INCOME_CATEGORIES[0]);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    formType === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  <span>Wpłata</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('expense');
                    setFormCategory(INITIAL_CATEGORIES[0].name);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
                    formType === 'expense' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                  <span>Wydatek</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kwota (PLN) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Komentarz */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Komentarz <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    formType === 'income'
                      ? 'np. Wynagrodzenie, Premia'
                      : 'np. Zakupy spożywcze, Paliwo'
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
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

              {/* Recurring Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formRecurring}
                  onChange={(e) => setFormRecurring(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-medium text-slate-700">
                  Cykliczna co miesiąc
                </span>
              </label>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs"
                >
                  {formType === 'income' ? 'Dodaj wpłatę' : 'Dodaj wydatek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Item Breakdown Modal */}
      {selectedReceiptDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900">Pozycje z paragonu</h3>
              </div>
              <button
                onClick={() => setSelectedReceiptDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500 truncate">
              Sklep: <strong className="text-slate-800">{selectedReceiptDetails.receiptStoreName || 'Sklep'}</strong> • Data: {selectedReceiptDetails.date}
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {selectedReceiptDetails.receiptItems?.map((item, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                    <span className="text-[10px] text-slate-400 truncate block">{item.category}</span>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">{item.price.toFixed(2)} zł</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
              <span className="font-semibold text-slate-600">Łącznie:</span>
              <span className="font-black text-slate-900 text-sm">
                {selectedReceiptDetails.amount.toFixed(2)} PLN
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

