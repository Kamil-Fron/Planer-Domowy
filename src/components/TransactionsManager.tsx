import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Landmark,
  User,
  Percent,
} from 'lucide-react';
import { Transaction, TransactionType, DebtItem, DebtCategory, DebtType } from '../types';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES } from '../mockData';
import { MonthRolloverControl } from './MonthRolloverControl';
import { useMonthSwipe } from '../hooks/useMonthSwipe';
import {
  getSmartTransactionSuggestions,
  recordTransactionUsage,
  SmartTransactionSuggestion,
} from '../utils/frequentTransactions';
import {
  calculateSuggestedLoanSplit,
  isInterestBearingDebt,
  getLoanEffectiveInterestRate,
  isDebtInGracePeriod,
} from '../utils/loanCalculation';

interface TransactionsManagerProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onAddDebt?: (debt: DebtItem) => void;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  initialFilterType?: 'all' | 'expense' | 'income' | null;
  initialSearchQuery?: string;
  initialSelectedTransactionId?: string | null;
  onClearInitialState?: () => void;
  debts?: DebtItem[];
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onAddDebt,
  selectedMonth,
  onMonthChange,
  initialFilterType,
  initialSearchQuery,
  initialSelectedTransactionId,
  onClearInitialState,
  debts = [],
}) => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>(
    initialFilterType || 'all'
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReceiptDetails, setSelectedReceiptDetails] = useState<Transaction | null>(null);
  const [isolatedTransactionId, setIsolatedTransactionId] = useState<string | null>(null);

  // Sync external navigation parameters (e.g. from Dashboard click on Net Balance, Income, Expense or Tx)
  useEffect(() => {
    if (initialFilterType) {
      setFilterType(initialFilterType);
    }
  }, [initialFilterType]);

  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== '') {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (initialSelectedTransactionId) {
      setIsolatedTransactionId(initialSelectedTransactionId);
      const targetTx = transactions.find((t) => t.id === initialSelectedTransactionId);
      if (targetTx) {
        if (targetTx.receiptItems && targetTx.receiptItems.length > 0) {
          setSelectedReceiptDetails(targetTx);
        }
      }
    }
  }, [initialSelectedTransactionId, transactions]);

  // Notify parent to clear initial parameters once consumed
  useEffect(() => {
    if (initialFilterType || initialSearchQuery || initialSelectedTransactionId) {
      if (onClearInitialState) {
        onClearInitialState();
      }
    }
  }, [initialFilterType, initialSearchQuery, initialSelectedTransactionId, onClearInitialState]);

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
  const [editDebtId, setEditDebtId] = useState<string>('');
  const [editDebtPrincipal, setEditDebtPrincipal] = useState<string>('');
  const [editDebtInterest, setEditDebtInterest] = useState<string>('');

  // Form State (Add)
  const [formType, setFormType] = useState<TransactionType>('income');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Wypłata z etatu');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formComment, setFormComment] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formDebtId, setFormDebtId] = useState<string>('');
  const [formDebtPrincipal, setFormDebtPrincipal] = useState<string>('');
  const [formDebtInterest, setFormDebtInterest] = useState<string>('');

  // New Debt creation sub-form state when formCategory === 'Zobowiązania i pożyczki'
  const [formDebtActionType, setFormDebtActionType] = useState<'link' | 'create_new'>('link');
  const [formNewDebtCounterparty, setFormNewDebtCounterparty] = useState('');
  const [formNewDebtDueDate, setFormNewDebtDueDate] = useState('');
  const [formNewDebtCategory, setFormNewDebtCategory] = useState<DebtCategory>('inne');
  const [formNewDebtMonthlyPayment, setFormNewDebtMonthlyPayment] = useState('');
  const [formNewDebtNotes, setFormNewDebtNotes] = useState('');

  // Mobile swipe gesture for month switching
  const { touchHandlers, swipeFeedback } = useMonthSwipe({
    selectedMonth,
    onMonthChange,
    transactions,
  });

  // Filtered list
  const filtered = transactions.filter((t) => {
    if (isolatedTransactionId) {
      return t.id === isolatedTransactionId;
    }
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
    setFormDebtId('');
    setFormDebtPrincipal('');
    setFormDebtInterest('');
    setFormDebtActionType('link');
    setFormNewDebtCounterparty('');
    setFormNewDebtDueDate('');
    setFormNewDebtCategory('inne');
    setFormNewDebtMonthlyPayment('');
    setFormNewDebtNotes('');
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
    setEditDebtId(t.debtId || '');

    const linkedDebt = t.debtId ? debts.find((d) => d.id === t.debtId) : undefined;
    if (t.principalAmount !== undefined) {
      setEditDebtPrincipal(t.principalAmount.toString());
      setEditDebtInterest((t.interestAmount !== undefined ? t.interestAmount : Math.max(0, Math.round((t.amount - t.principalAmount) * 100) / 100)).toString());
    } else if (linkedDebt && isInterestBearingDebt(linkedDebt)) {
      const split = calculateSuggestedLoanSplit({
        debt: linkedDebt,
        paymentAmount: t.amount,
        paymentDate: t.date,
        paymentType: 'regular',
      });
      setEditDebtPrincipal(split.suggestedPrincipal.toFixed(2));
      setEditDebtInterest(split.suggestedInterest.toFixed(2));
    } else {
      setEditDebtPrincipal('');
      setEditDebtInterest('');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !editTitle.trim() || !editAmount) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    let principalAmt: number | undefined = undefined;
    let interestAmt: number | undefined = undefined;

    if (editDebtId) {
      const targetDebt = debts.find((d) => d.id === editDebtId);
      if (targetDebt && isInterestBearingDebt(targetDebt)) {
        if (editDebtPrincipal) {
          const p = parseFloat(editDebtPrincipal.replace(',', '.'));
          if (!isNaN(p) && p >= 0) {
            principalAmt = p;
            interestAmt = Math.max(0, Math.round((parsedAmount - p) * 100) / 100);
          }
        }
        if (principalAmt === undefined) {
          const split = calculateSuggestedLoanSplit({
            debt: targetDebt,
            paymentAmount: parsedAmount,
            paymentDate: editDate,
            paymentType: 'regular',
          });
          principalAmt = split.suggestedPrincipal;
          interestAmt = split.suggestedInterest;
        }
      }
    }

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
        debtId: editDebtId || undefined,
        principalAmount: principalAmt,
        interestAmount: interestAmt,
      });
    }

    setEditingTransaction(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount) return;

    const parsedAmount = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const isDebtCategory = formCategory === 'Zobowiązania i pożyczki';
    let assignedDebtId = formDebtId || undefined;
    let debtAction: 'borrow' | 'repay_borrowed' | 'lend' | 'receive_lent' | undefined = undefined;

    let principalAmt: number | undefined = undefined;
    let interestAmt: number | undefined = undefined;

    if (isDebtCategory && formDebtActionType === 'create_new' && onAddDebt) {
      const counterparty = formNewDebtCounterparty.trim() || (formType === 'income' ? 'Bank / Wierzyciel' : 'Dłużnik');
      const debtName = formTitle.trim() || (formType === 'income' ? `Zobowiązanie: ${counterparty}` : `Pożyczka dla: ${counterparty}`);
      const monthlyPmt = parseFloat(formNewDebtMonthlyPayment.replace(',', '.')) || undefined;
      const createdDebtId = `debt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const debtType: DebtType = formType === 'income' ? 'borrowed' : 'lent';

      const newDebtItem: DebtItem = {
        id: createdDebtId,
        type: debtType,
        category: formNewDebtCategory,
        name: debtName,
        counterparty: counterparty,
        initialAmount: parsedAmount,
        totalAmount: parsedAmount,
        currentRemaining: parsedAmount,
        paidAmount: 0,
        startDate: formDate || new Date().toISOString().split('T')[0],
        dueDate: formNewDebtDueDate || undefined,
        monthlyPayment: monthlyPmt,
        status: 'active',
        notes: formNewDebtNotes.trim() || undefined,
        paymentsHistory: [],
        createdAt: new Date().toISOString(),
      };

      onAddDebt(newDebtItem);
      assignedDebtId = createdDebtId;
      debtAction = debtType === 'borrowed' ? 'borrow' : 'lend';
    } else if (isDebtCategory && assignedDebtId) {
      const targetDebt = debts.find((d) => d.id === assignedDebtId);
      if (targetDebt) {
        if (targetDebt.currentRemaining > 0 && parsedAmount > targetDebt.currentRemaining + 0.009) {
          const over = parsedAmount - targetDebt.currentRemaining;
          alert(`Kwota (${parsedAmount.toFixed(2)} zł) przekracza pozostałe saldo zobowiązania (${targetDebt.currentRemaining.toFixed(2)} zł) o ${over.toFixed(2)} zł. Skoryguj kwotę przed zapisaniem transakcji.`);
          return;
        }

        if (isInterestBearingDebt(targetDebt)) {
          if (formDebtPrincipal) {
            const p = parseFloat(formDebtPrincipal.replace(',', '.'));
            if (!isNaN(p) && p >= 0) {
              principalAmt = p;
              interestAmt = Math.max(0, Math.round((parsedAmount - p) * 100) / 100);
            }
          }
          if (principalAmt === undefined) {
            const split = calculateSuggestedLoanSplit({
              debt: targetDebt,
              paymentAmount: parsedAmount,
              paymentDate: formDate,
              paymentType: 'regular',
            });
            principalAmt = split.suggestedPrincipal;
            interestAmt = split.suggestedInterest;
          }
        }
      }
      debtAction = formType === 'expense' ? 'repay_borrowed' : 'receive_lent';
    }

    onAddTransaction({
      type: formType,
      title: formTitle.trim(),
      amount: parsedAmount,
      category: formCategory,
      date: formDate,
      comment: formComment.trim() || undefined,
      isRecurring: formRecurring,
      debtId: isDebtCategory ? assignedDebtId : undefined,
      debtAction: isDebtCategory ? debtAction : undefined,
      debtCounterparty: isDebtCategory && formDebtActionType === 'create_new' ? formNewDebtCounterparty.trim() : undefined,
      principalAmount: principalAmt,
      interestAmount: interestAmt,
    });

    recordTransactionUsage(formTitle.trim(), formCategory, formType, parsedAmount);

    setFormTitle('');
    setFormAmount('');
    setFormComment('');
    setFormRecurring(false);
    setFormDebtId('');
    setFormDebtPrincipal('');
    setFormDebtInterest('');
    setFormDebtActionType('link');
    setFormNewDebtCounterparty('');
    setFormNewDebtDueDate('');
    setFormNewDebtCategory('inne');
    setFormNewDebtMonthlyPayment('');
    setFormNewDebtNotes('');
    setShowAddModal(false);
  };

  const dynamicAddSuggestions = React.useMemo(() => {
    return getSmartTransactionSuggestions(transactions, formType, formTitle, 10);
  }, [transactions, formType, formTitle, showAddModal]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full overflow-hidden">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Transakcje</h1>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            Wpłaty, pensje, wydatki i paragony
          </p>
        </div>
      </div>

      {/* KPI Cards - Clean, concise with mobile gesture support */}
      <div className="relative">
        {swipeFeedback === 'blocked' && (
          <div className="absolute -top-3 inset-x-0 mx-auto w-max z-30 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full shadow-lg animate-in fade-in zoom-in-95">
            Przyszły miesiąc jest zablokowany (brak transakcji)
          </div>
        )}
        <div
          {...touchHandlers}
          className={`grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 transition-transform duration-200 select-none touch-pan-y ${
            swipeFeedback === 'next'
              ? '-translate-x-1.5 opacity-90'
              : swipeFeedback === 'prev'
              ? 'translate-x-1.5 opacity-90'
              : swipeFeedback === 'blocked'
              ? '-translate-x-0.5 opacity-90'
              : ''
          }`}
        >
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
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500 font-medium block truncate">Bilans</span>
              {/* Mała dyskretna ikonka przesunięcia bilansu */}
              <MonthRolloverControl
                selectedMonth={selectedMonth}
                transactions={transactions}
                onAddTransaction={onAddTransaction}
                onDeleteTransaction={onDeleteTransaction}
                onNavigateToMonth={onMonthChange}
                variant="icon"
                theme="light"
              />
            </div>
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
    </div>

      {/* Mobile gesture hint */}
      <div className="sm:hidden text-center text-[10px] text-slate-400 py-0.5">
        <span>‹ Przesuń palcem w lewo / prawo po kafelkach, aby zmienić miesiąc ›</span>
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

      {/* Isolated Transaction Banner (opened from notification) */}
      {isolatedTransactionId && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-indigo-950">
                Wyświetlanie pojedynczej pozycji z powiadomienia
              </h3>
              <p className="text-[11px] text-indigo-700">
                Wyświetlany jest wyłącznie ten wpis. Kliknij przycisk obok, aby powrócić do pełnej listy transakcji.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsolatedTransactionId(null)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors self-end sm:self-auto shrink-0"
          >
            ← Pokaż wszystkie transakcje
          </button>
        </div>
      )}

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
                      {item.isBalanceRollover && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center space-x-1 shrink-0"
                          title={`Przeniesienie bilansu z ${item.rolloverFromMonth || 'poprzedniego miesiąca'}`}
                        >
                          <Sparkles className="w-3 h-3 text-violet-600" />
                          <span>Przeniesienie bilansu</span>
                        </span>
                      )}
                      {item.debtId && (() => {
                        const linkedDebt = debts.find((d) => d.id === item.debtId);
                        const hasInterest = linkedDebt && isInterestBearingDebt(linkedDebt);
                        let pAmt = item.principalAmount;
                        let iAmt = item.interestAmount;
                        if ((pAmt === undefined || iAmt === undefined) && linkedDebt && hasInterest) {
                          const autoSplit = calculateSuggestedLoanSplit({
                            debt: linkedDebt,
                            paymentAmount: item.amount,
                            paymentDate: item.date,
                            paymentType: 'regular',
                          });
                          if (pAmt === undefined) pAmt = autoSplit.suggestedPrincipal;
                          if (iAmt === undefined) iAmt = autoSplit.suggestedInterest;
                        }

                        return (
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1 shrink-0"
                              title={linkedDebt ? `Spłata dla: ${linkedDebt.name}` : 'Powiązano ze zobowiązaniem'}
                            >
                              <Landmark className="w-3 h-3 text-indigo-600" />
                              <span>{linkedDebt ? `Zobowiązanie: ${linkedDebt.name}` : 'Zobowiązanie'}</span>
                            </span>

                            {hasInterest && (pAmt !== undefined || iAmt !== undefined) && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 flex items-center space-x-1 shrink-0"
                                title="Podział wpłaty na ratę kapitałową i odsetkową"
                              >
                                <Percent className="w-3 h-3 text-amber-600" />
                                <span>Kapitał: {(pAmt ?? item.amount).toFixed(2)} zł • Odsetki: {(iAmt ?? 0).toFixed(2)} zł</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
                  <div className="text-right">
                    <span
                      className={`text-sm sm:text-base font-black whitespace-nowrap block ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {item.amount.toFixed(2)} zł
                    </span>
                    {item.debtId && (() => {
                      const linkedDebt = debts.find((d) => d.id === item.debtId);
                      const hasInterest = linkedDebt && isInterestBearingDebt(linkedDebt);
                      let pAmt = item.principalAmount;
                      let iAmt = item.interestAmount;
                      if ((pAmt === undefined || iAmt === undefined) && linkedDebt && hasInterest) {
                        const autoSplit = calculateSuggestedLoanSplit({
                          debt: linkedDebt,
                          paymentAmount: item.amount,
                          paymentDate: item.date,
                          paymentType: 'regular',
                        });
                        if (pAmt === undefined) pAmt = autoSplit.suggestedPrincipal;
                        if (iAmt === undefined) iAmt = autoSplit.suggestedInterest;
                      }
                      if (hasInterest && (pAmt !== undefined || iAmt !== undefined)) {
                        return (
                          <span className="text-[10px] font-semibold text-slate-500 block whitespace-nowrap">
                            kap. {(pAmt ?? item.amount).toFixed(2)} zł / ods. {(iAmt ?? 0).toFixed(2)} zł
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

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

              {/* Debt Link Selector in Edit Modal - ONLY when category is "Zobowiązania i pożyczki" */}
              {editCategory === 'Zobowiązania i pożyczki' && (() => {
                const applicableDebts = debts.filter(
                  (d) =>
                    (editType === 'expense' ? d.type === 'borrowed' : d.type === 'lent') &&
                    (d.id === editDebtId || (d.status !== 'settled' && d.currentRemaining > 0))
                );
                if (applicableDebts.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs text-amber-800">
                        {editType === 'expense'
                          ? 'Brak aktywnych pożyczek/kredytów do spłaty w sekcji Zadłużenia.'
                          : 'Brak zarejestrowanych kwot pożyczonych innym do zwrotu w sekcji Zadłużenia.'}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        <span>Powiązanie ze zobowiązaniem / pożyczką</span>
                      </label>
                      {editDebtId && (
                        <button
                          type="button"
                          onClick={() => setEditDebtId('')}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
                        >
                          Odłącz
                        </button>
                      )}
                    </div>
                    <select
                      value={editDebtId}
                      onChange={(e) => {
                        const dId = e.target.value;
                        setEditDebtId(dId);
                        if (dId) {
                          const targetDebt = debts.find((d) => d.id === dId);
                          const parsedAmt = parseFloat(editAmount.replace(',', '.')) || 0;
                          if (targetDebt && isInterestBearingDebt(targetDebt) && parsedAmt > 0) {
                            const split = calculateSuggestedLoanSplit({
                              debt: targetDebt,
                              paymentAmount: parsedAmt,
                              paymentDate: editDate,
                              paymentType: 'regular',
                            });
                            setEditDebtPrincipal(split.suggestedPrincipal.toFixed(2));
                            setEditDebtInterest(split.suggestedInterest.toFixed(2));
                          } else {
                            setEditDebtPrincipal(editAmount);
                            setEditDebtInterest('0.00');
                          }
                        } else {
                          setEditDebtPrincipal('');
                          setEditDebtInterest('');
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="">-- Wybierz pozycję do rozliczenia --</option>
                      {applicableDebts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.type === 'borrowed' ? '🏦 Kredyt / Zobowiązanie' : '🤝 Pożyczka'}: {d.name} ({d.counterparty}) — do spłaty: {d.currentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </option>
                      ))}
                    </select>

                    {editDebtId && (() => {
                      const targetDebt = debts.find((d) => d.id === editDebtId);
                      const parsedAmt = parseFloat(editAmount.replace(',', '.')) || 0;
                      const hasInterest = targetDebt && isInterestBearingDebt(targetDebt);
                      const splitSuggestion = targetDebt && hasInterest
                        ? calculateSuggestedLoanSplit({
                            debt: targetDebt,
                            paymentAmount: parsedAmt,
                            paymentDate: editDate,
                            paymentType: 'regular',
                          })
                        : null;

                      if (!hasInterest || !splitSuggestion) {
                        return (
                          <p className="text-[11px] text-indigo-800 leading-relaxed">
                            💡 Zapisanie zmian zaktualizuje historię spłat i saldo tego zobowiązania.
                          </p>
                        );
                      }

                      return (
                        <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Automatyczny podział raty (kapitał / odsetki)</span>
                            </span>
                            <div className="flex items-center gap-1">
                              {splitSuggestion.isInGracePeriod ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                  Karencja do {splitSuggestion.graceEndDate || 'końca'}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-bold">
                                  Oproc.: {splitSuggestion.effectiveAnnualRate}%
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-snug">
                            {splitSuggestion.explanation}
                          </p>

                          <div className="flex flex-wrap gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditDebtPrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                                setEditDebtInterest(splitSuggestion.suggestedInterest.toFixed(2));
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Sugestia bankowa ({splitSuggestion.suggestedPrincipal.toFixed(2)} zł / {splitSuggestion.suggestedInterest.toFixed(2)} zł)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditDebtPrincipal(parsedAmt.toFixed(2));
                                setEditDebtInterest('0.00');
                              }}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              100% kapitał
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditDebtPrincipal('0.00');
                                setEditDebtInterest(parsedAmt.toFixed(2));
                              }}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              100% odsetki
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Kapitał (zł):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={editDebtPrincipal}
                                onChange={(e) => {
                                  const p = e.target.value;
                                  setEditDebtPrincipal(p);
                                  const pNum = parseFloat(p) || 0;
                                  setEditDebtInterest(Math.max(0, Math.round((parsedAmt - pNum) * 100) / 100).toFixed(2));
                                }}
                                className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Odsetki (zł):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={editDebtInterest}
                                onChange={(e) => {
                                  const i = e.target.value;
                                  setEditDebtInterest(i);
                                  const iNum = parseFloat(i) || 0;
                                  setEditDebtPrincipal(Math.max(0, Math.round((parsedAmt - iNum) * 100) / 100).toFixed(2));
                                }}
                                className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

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

              {/* Debt Link / Create Selector in Add Modal - ONLY when category is "Zobowiązania i pożyczki" */}
              {formCategory === 'Zobowiązania i pożyczki' && (() => {
                const applicableDebts = debts.filter(
                  (d) =>
                    (formType === 'expense' ? d.type === 'borrowed' : d.type === 'lent') &&
                    d.status !== 'settled' &&
                    d.currentRemaining > 0
                );
                return (
                  <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2.5 transition-all">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        <span>
                          {formDebtActionType === 'create_new'
                            ? formType === 'income'
                              ? 'Nowe zobowiązanie (Wpływ pożyczki / kredytu od wierzyciela)'
                              : 'Nowa udzielona pożyczka (Wydatek na pożyczkę dla dłużnika)'
                            : formType === 'expense'
                            ? 'Spłata zobowiązania (Wydatek na rzecz wierzyciela)'
                            : 'Zwrot pożyczki (Wpływ od dłużnika)'}
                        </span>
                      </label>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                        Zobowiązania
                      </span>
                    </div>

                    {/* Mode Switcher */}
                    <div className="flex rounded-lg bg-indigo-100/70 p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setFormDebtActionType('link')}
                        className={`flex-1 py-1 px-2 rounded-md transition-all ${
                          formDebtActionType === 'link'
                            ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                            : 'text-indigo-700 hover:text-indigo-900'
                        }`}
                      >
                        Powiąż z istniejącym ({applicableDebts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormDebtActionType('create_new');
                          setFormDebtId('');
                        }}
                        className={`flex-1 py-1 px-2 rounded-md transition-all ${
                          formDebtActionType === 'create_new'
                            ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                            : 'text-indigo-700 hover:text-indigo-900'
                        }`}
                      >
                        + Utwórz nowe w sekcji Zadłużenia
                      </button>
                    </div>

                    {formDebtActionType === 'link' ? (
                      applicableDebts.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-700">
                              {formType === 'expense' ? 'Wybierz zobowiązanie do spłaty:' : 'Wybierz pożyczkę do rozliczenia (zwrot od dłużnika):'}
                            </label>
                            {formDebtId && (
                              <button
                                type="button"
                                onClick={() => setFormDebtId('')}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
                              >
                                Odłącz
                              </button>
                            )}
                          </div>
                          <select
                            value={formDebtId}
                            onChange={(e) => {
                              const dId = e.target.value;
                              setFormDebtId(dId);
                              if (dId) {
                                const targetDebt = applicableDebts.find((d) => d.id === dId);
                                if (targetDebt) {
                                  if (!formTitle || formTitle === 'Nowy wydatek' || formTitle === 'Nowa wpłata') {
                                    if (formType === 'expense') {
                                      setFormTitle(`Spłata: ${targetDebt.name}`);
                                    } else {
                                      setFormTitle(`Zwrot pożyczki: ${targetDebt.name}`);
                                    }
                                  }
                                  let amountToUse = formAmount;
                                  if (!formAmount) {
                                    if (targetDebt.monthlyPayment && targetDebt.monthlyPayment <= targetDebt.currentRemaining) {
                                      amountToUse = String(targetDebt.monthlyPayment);
                                      setFormAmount(amountToUse);
                                    } else if (targetDebt.currentRemaining) {
                                      amountToUse = targetDebt.currentRemaining.toFixed(2);
                                      setFormAmount(amountToUse);
                                    }
                                  }

                                  const parsedAmt = parseFloat(amountToUse.replace(',', '.')) || 0;
                                  if (isInterestBearingDebt(targetDebt) && parsedAmt > 0) {
                                    const split = calculateSuggestedLoanSplit({
                                      debt: targetDebt,
                                      paymentAmount: parsedAmt,
                                      paymentDate: formDate,
                                      paymentType: 'regular',
                                    });
                                    setFormDebtPrincipal(split.suggestedPrincipal.toFixed(2));
                                    setFormDebtInterest(split.suggestedInterest.toFixed(2));
                                  } else {
                                    setFormDebtPrincipal(amountToUse);
                                    setFormDebtInterest('0.00');
                                  }
                                }
                              } else {
                                setFormDebtPrincipal('');
                                setFormDebtInterest('');
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                          >
                            <option value="">-- Wybierz pozycję (lub brak powiązania) --</option>
                            {applicableDebts.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.type === 'borrowed' ? '🏦 Kredyt / Zobowiązanie' : '🤝 Udzielona pożyczka'}: {d.name} ({d.counterparty}) — {d.type === 'borrowed' ? 'do spłaty' : 'do odzyskania'}: {d.currentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                              </option>
                            ))}
                          </select>
                          {formDebtId ? (() => {
                            const targetDebt = applicableDebts.find((d) => d.id === formDebtId);
                            const parsedNum = parseFloat(formAmount.replace(',', '.')) || 0;
                            const isOver = targetDebt && targetDebt.currentRemaining > 0 && parsedNum > targetDebt.currentRemaining + 0.009;
                            const hasInterest = targetDebt && isInterestBearingDebt(targetDebt);

                            const splitSuggestion = targetDebt && hasInterest
                              ? calculateSuggestedLoanSplit({
                                  debt: targetDebt,
                                  paymentAmount: parsedNum,
                                  paymentDate: formDate,
                                  paymentType: 'regular',
                                })
                              : null;

                            return (
                              <div className="space-y-2.5">
                                {isOver && (
                                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <span className="font-bold block text-rose-900">
                                        ⚠️ Kwota ({parsedNum.toFixed(2)} zł) przekracza pozostałe saldo ({targetDebt.currentRemaining.toFixed(2)} zł)!
                                      </span>
                                      <span className="text-[10px] text-rose-800">
                                        Do całkowitego rozliczenia należy zapłacić {targetDebt.currentRemaining.toFixed(2)} zł.
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setFormAmount(targetDebt.currentRemaining.toFixed(2))}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
                                    >
                                      Ustaw {targetDebt.currentRemaining.toFixed(2)} zł
                                    </button>
                                  </div>
                                )}

                                {hasInterest && splitSuggestion && (
                                  <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2 shadow-2xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Automatyczny podział raty (kapitał / odsetki)</span>
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {splitSuggestion.isInGracePeriod ? (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                            Karencja do {splitSuggestion.graceEndDate || 'końca'}
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-bold">
                                            Oproc.: {splitSuggestion.effectiveAnnualRate}%
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-[11px] text-slate-600 leading-snug">
                                      {splitSuggestion.explanation}
                                    </p>

                                    <div className="flex flex-wrap gap-1 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormDebtPrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                                          setFormDebtInterest(splitSuggestion.suggestedInterest.toFixed(2));
                                        }}
                                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        Sugestia bankowa ({splitSuggestion.suggestedPrincipal.toFixed(2)} zł / {splitSuggestion.suggestedInterest.toFixed(2)} zł)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormDebtPrincipal(parsedNum.toFixed(2));
                                          setFormDebtInterest('0.00');
                                        }}
                                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                      >
                                        100% kapitał
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormDebtPrincipal('0.00');
                                          setFormDebtInterest(parsedNum.toFixed(2));
                                        }}
                                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                      >
                                        100% odsetki
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                          Kapitał (zł):
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={formDebtPrincipal}
                                          onChange={(e) => {
                                            const p = e.target.value;
                                            setFormDebtPrincipal(p);
                                            const pNum = parseFloat(p) || 0;
                                            setFormDebtInterest(Math.max(0, parsedNum - pNum).toFixed(2));
                                          }}
                                          className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                          Odsetki (zł):
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={formDebtInterest}
                                          onChange={(e) => {
                                            const i = e.target.value;
                                            setFormDebtInterest(i);
                                            const iNum = parseFloat(i) || 0;
                                            setFormDebtPrincipal(Math.max(0, parsedNum - iNum).toFixed(2));
                                          }}
                                          className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                                  {formType === 'expense'
                                    ? '💡 Dodanie tego wydatku automatycznie pomniejszy saldo Twojego zadłużenia wobec wierzyciela i utworzy wpis w historii spłat.'
                                    : '💡 Dodanie tego wpływu automatycznie pomniejszy kwotę do zwrotu od dłużnika i utworzy wpis w historii spłat.'}
                                </p>
                              </div>
                            );
                          })() : (
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                              ⚠️ Wybierz powyżej pozycję z listy zobowiązań, aby transakcja automatycznie rozliczyła i pomniejszyła saldo.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                          <p className="font-semibold">
                            {formType === 'expense'
                              ? 'Brak aktywnych zobowiązań/kredytów do spłaty w sekcji Zadłużenia.'
                              : 'Brak zarejestrowanych kwot pożyczonych innym do zwrotu w sekcji Zadłużenia.'}
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Przełącz powyżej na <strong>„+ Utwórz nowe”</strong>, aby automatycznie utworzyć nową pozycję w sekcji Zadłużenia.
                          </p>
                        </div>
                      )
                    ) : (
                      /* Create New Debt Sub-form */
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2.5">
                        <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {formType === 'income'
                              ? 'Parametry nowego zobowiązania (Wierzyciel / Kredytodawca):'
                              : 'Parametry nowej pożyczki (Dłużnik / Komu pożyczasz):'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              {formType === 'income' ? 'Wierzyciel / Bank / Osoba od której pożyczasz *' : 'Dłużnik / Osoba której pożyczasz *'}
                            </label>
                            <input
                              type="text"
                              placeholder={formType === 'income' ? 'np. PKO BP, Santander, Tomek' : 'np. Marek, Kasia, Znajomy'}
                              value={formNewDebtCounterparty}
                              onChange={(e) => setFormNewDebtCounterparty(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Kategoria długu
                            </label>
                            <select
                              value={formNewDebtCategory}
                              onChange={(e) => setFormNewDebtCategory(e.target.value as DebtCategory)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            >
                              <option value="inne">Inne</option>
                              <option value="kredyt_gotowkowy">Kredyt gotówkowy</option>
                              <option value="kredyt_hipoteczny">Kredyt hipoteczny</option>
                              <option value="pozyczka_znajomy">Pożyczka prywatna / znajomi</option>
                              <option value="karta_kredytowa">Karta kredytowa / debet</option>
                              <option value="chwilowka">Chwilówka / pożyczka pozabankowa</option>
                              <option value="leasing_auto">Leasing / Auto</option>
                              <option value="zakupy_raty">Zakupy na raty</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Termin całkowitego zwrotu (opcjonalnie)
                            </label>
                            <input
                              type="date"
                              value={formNewDebtDueDate}
                              onChange={(e) => setFormNewDebtDueDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Rata miesięczna (PLN, opcjonalnie)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="np. 450.00"
                              value={formNewDebtMonthlyPayment}
                              onChange={(e) => setFormNewDebtMonthlyPayment(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Notatki / cel (opcjonalnie)
                          </label>
                          <input
                            type="text"
                            placeholder="np. Pożyczka na remont, auto"
                            value={formNewDebtNotes}
                            onChange={(e) => setFormNewDebtNotes(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <p className="text-[10px] text-indigo-800 leading-relaxed font-medium bg-indigo-50 p-2 rounded-md">
                          {formType === 'income'
                            ? `✨ Rejestrujesz wpływ (np. kredyt/pożyczka). W sekcji Zadłużenia utworzy się zobowiązanie wobec wierzyciela ze stanem do spłaty: ${formAmount || '0.00'} zł.`
                            : `✨ Rejestrujesz wydatek (pożyczasz komuś). W sekcji Zadłużenia utworzy się należność od dłużnika ze stanem do zwrotu: ${formAmount || '0.00'} zł.`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Dynamic Smart Suggestions - placed right after description & category */}
              {dynamicAddSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Często wybierane w ostatnich 30 dniach:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">1-klik wypełnia</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {dynamicAddSuggestions.map((sug, idx) => (
                      <button
                        key={`${sug.title}-${idx}`}
                        type="button"
                        onClick={() => {
                          setFormTitle(sug.title);
                          setFormCategory(sug.category);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                        title={`${sug.title} • Kategoria: ${sug.category}`}
                      >
                        <span>{sug.emoji}</span>
                        <span className="font-semibold">{sug.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                {(() => {
                  const isDebtCategory = formCategory === 'Zobowiązania i pożyczki';
                  const linkedDebtTarget = isDebtCategory && formDebtActionType === 'link' && formDebtId
                    ? debts.find((d) => d.id === formDebtId)
                    : undefined;
                  const parsedFormAmt = parseFloat(formAmount.replace(',', '.')) || 0;
                  const isDebtOverpaid = !!linkedDebtTarget && linkedDebtTarget.currentRemaining > 0 && parsedFormAmt > linkedDebtTarget.currentRemaining + 0.009;
                  const isFormValid = !!formTitle.trim() && !!formAmount && parsedFormAmt > 0 && !isDebtOverpaid;

                  return (
                    <button
                      type="submit"
                      disabled={!isFormValid}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {isDebtOverpaid ? 'Kwota przekracza saldo spłaty' : (formType === 'income' ? 'Dodaj wpłatę' : 'Dodaj wydatek')}
                    </button>
                  );
                })()}
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

