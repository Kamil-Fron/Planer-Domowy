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
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Transaction, TransactionType, DebtItem, DebtCategory, DebtType, ReceiptItemDetail } from '../types';
import { DebtRepaymentLivePreview } from './DebtRepaymentLivePreview';
import { DebtSplitAndLivePreview } from './DebtSplitAndLivePreview';
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

// Helper do normalizacji tekstu wyszukiwania (usuwanie polskich znaków diakrytycznych, małe litery)
const normalizeSearchText = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

// Sprawdzenie czy pozycja z paragonu pasuje do zapytania wyszukiwania
const matchesReceiptItem = (item: ReceiptItemDetail, queryNorm: string): boolean => {
  if (!queryNorm) return true;
  const nameNorm = normalizeSearchText(item.name);
  const catNorm = normalizeSearchText(item.category);
  const notesNorm = normalizeSearchText(item.notes);
  const priceStr = item.price.toFixed(2).replace('.', ',');
  const priceDot = item.price.toFixed(2);
  const quantityStr = item.quantity ? `${item.quantity}` : '';

  return (
    nameNorm.includes(queryNorm) ||
    catNorm.includes(queryNorm) ||
    notesNorm.includes(queryNorm) ||
    priceStr.includes(queryNorm) ||
    priceDot.includes(queryNorm) ||
    (quantityStr !== '' && queryNorm === quantityStr)
  );
};

// Komponent bezpiecznego podświetlania dopasowanego fragmentu wyszukiwania
const HighlightText: React.FC<{ text: string | undefined | null; query: string }> = ({
  text,
  query,
}) => {
  if (!text) return null;
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length > 1) {
      return (
        <>
          {parts.map((part, i) =>
            part.toLowerCase() === trimmed.toLowerCase() ? (
              <mark key={i} className="bg-amber-200/90 text-amber-950 font-bold px-0.5 rounded-xs">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    }
  } catch {
    // fallback poniżej
  }

  const textNorm = normalizeSearchText(text);
  const queryNorm = normalizeSearchText(trimmed);
  const idx = textNorm.indexOf(queryNorm);
  if (idx !== -1 && idx < text.length) {
    const endIdx = Math.min(text.length, idx + trimmed.length);
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-200/90 text-amber-950 font-bold px-0.5 rounded-xs">
          {text.slice(idx, endIdx)}
        </mark>
        {text.slice(endIdx)}
      </>
    );
  }

  return <>{text}</>;
};

export interface FlatReceiptItem {
  id: string;
  transaction: Transaction;
  item: ReceiptItemDetail;
  itemIndex: number;
  matchesQuery: boolean;
}

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
  const [viewMode, setViewMode] = useState<'transactions' | 'receipt_items'>('transactions');
  const [searchAllMonths, setSearchAllMonths] = useState<boolean>(false);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string>>(new Set());
  const [showAllItemsTxIds, setShowAllItemsTxIds] = useState<Set<string>>(new Set());
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
  const [editPaymentType, setEditPaymentType] = useState<'regular' | 'overpayment'>('regular');

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
  const [formPaymentType, setFormPaymentType] = useState<'regular' | 'overpayment'>('regular');

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

  // Query normalized
  const queryNorm = normalizeSearchText(searchQuery);

  // Filtered list
  const filtered = transactions.filter((t) => {
    if (isolatedTransactionId) {
      return t.id === isolatedTransactionId;
    }
    const matchesMonth = searchAllMonths || !selectedMonth || t.date.startsWith(selectedMonth);
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesCategory =
      filterCategory === 'all' ||
      t.category === filterCategory ||
      (t.receiptItems && t.receiptItems.some((item) => item.category === filterCategory));

    if (!queryNorm) {
      return matchesMonth && matchesType && matchesCategory;
    }

    const matchesDirectly =
      normalizeSearchText(t.title).includes(queryNorm) ||
      (t.comment && normalizeSearchText(t.comment).includes(queryNorm)) ||
      normalizeSearchText(t.category).includes(queryNorm) ||
      (t.receiptStoreName && normalizeSearchText(t.receiptStoreName).includes(queryNorm)) ||
      (t.debtCounterparty && normalizeSearchText(t.debtCounterparty).includes(queryNorm));

    const matchesReceiptItems =
      !!t.receiptItems &&
      t.receiptItems.length > 0 &&
      t.receiptItems.some((item) => matchesReceiptItem(item, queryNorm));

    return matchesMonth && matchesType && matchesCategory && (matchesDirectly || matchesReceiptItems);
  });

  // Licznik wyników w innych miesiącach, gdy filtr miesiąca jest aktywny i nic lub mało znaleziono
  const otherMonthMatchesCount =
    !searchAllMonths && selectedMonth && queryNorm
      ? transactions.filter((t) => {
          if (t.date.startsWith(selectedMonth)) return false;
          const matchesType = filterType === 'all' || t.type === filterType;
          const matchesCategory =
            filterCategory === 'all' ||
            t.category === filterCategory ||
            (t.receiptItems && t.receiptItems.some((item) => item.category === filterCategory));

          const matchesDirectly =
            normalizeSearchText(t.title).includes(queryNorm) ||
            (t.comment && normalizeSearchText(t.comment).includes(queryNorm)) ||
            normalizeSearchText(t.category).includes(queryNorm) ||
            (t.receiptStoreName && normalizeSearchText(t.receiptStoreName).includes(queryNorm)) ||
            (t.debtCounterparty && normalizeSearchText(t.debtCounterparty).includes(queryNorm));

          const matchesReceiptItems =
            !!t.receiptItems &&
            t.receiptItems.length > 0 &&
            t.receiptItems.some((item) => matchesReceiptItem(item, queryNorm));

          return matchesType && matchesCategory && (matchesDirectly || matchesReceiptItems);
        }).length
      : 0;

  // Spłaszczona lista pozycji z paragonów dla dedykowanego widoku / wyszukiwarki pozycji
  const allFilteredReceiptItems: FlatReceiptItem[] = [];
  filtered.forEach((t) => {
    if (!t.receiptItems || t.receiptItems.length === 0) return;
    t.receiptItems.forEach((item, idx) => {
      // Filtr kategorii
      if (
        filterCategory !== 'all' &&
        item.category !== filterCategory &&
        t.category !== filterCategory
      ) {
        return;
      }
      const isItemMatch = queryNorm ? matchesReceiptItem(item, queryNorm) : true;
      const parentMatches = queryNorm
        ? normalizeSearchText(t.title).includes(queryNorm) ||
          (t.receiptStoreName && normalizeSearchText(t.receiptStoreName).includes(queryNorm)) ||
          (t.comment && normalizeSearchText(t.comment).includes(queryNorm))
        : true;

      if (!queryNorm || isItemMatch || parentMatches) {
        allFilteredReceiptItems.push({
          id: `${t.id}-item-${idx}`,
          transaction: t,
          item,
          itemIndex: idx,
          matchesQuery: isItemMatch,
        });
      }
    });
  });

  const totalReceiptItemsSum = allFilteredReceiptItems.reduce(
    (sum, f) => sum + f.item.price,
    0
  );

  const handleScrollToTransaction = (txId: string) => {
    setViewMode('transactions');
    setExpandedReceiptIds((prev) => new Set(prev).add(txId));
    setTimeout(() => {
      const el = document.getElementById(`tx-row-${txId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50/70');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50/70');
        }, 2200);
      }
    }, 60);
  };

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
    const isOverpayment =
      (t as any).paymentType === 'overpayment' ||
      t.mortgagePaymentType === 'overpayment' ||
      t.title.toLowerCase().includes('nadpłat') ||
      (t.comment && t.comment.toLowerCase().includes('nadpłat'));
    setEditPaymentType(isOverpayment ? 'overpayment' : 'regular');

    const existingPaymentRecord = linkedDebt?.paymentsHistory?.find((p) => p.transactionId === t.id);

    if (t.principalAmount !== undefined) {
      setEditDebtPrincipal(t.principalAmount.toString());
      setEditDebtInterest((t.interestAmount !== undefined ? t.interestAmount : Math.max(0, Math.round((t.amount - t.principalAmount) * 100) / 100)).toString());
    } else if (existingPaymentRecord && existingPaymentRecord.principalAmount !== undefined) {
      setEditDebtPrincipal(existingPaymentRecord.principalAmount.toString());
      setEditDebtInterest((existingPaymentRecord.interestAmount !== undefined ? existingPaymentRecord.interestAmount : Math.max(0, Math.round((t.amount - existingPaymentRecord.principalAmount) * 100) / 100)).toString());
    } else if (linkedDebt && isInterestBearingDebt(linkedDebt)) {
      const split = calculateSuggestedLoanSplit({
        debt: linkedDebt,
        paymentAmount: t.amount,
        paymentDate: t.date,
        paymentType: isOverpayment ? 'overpayment' : 'regular',
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
      if (targetDebt) {
        if (editDebtPrincipal) {
          const p = parseFloat(editDebtPrincipal.replace(',', '.'));
          if (!isNaN(p) && p >= 0) {
            principalAmt = p;
            interestAmt = editDebtInterest
              ? (parseFloat(editDebtInterest.replace(',', '.')) || 0)
              : Math.max(0, Math.round((parsedAmount - p) * 100) / 100);
          }
        }
        if (principalAmt === undefined) {
          if (editPaymentType === 'overpayment') {
            principalAmt = parsedAmount;
            interestAmt = 0;
          } else if (isInterestBearingDebt(targetDebt)) {
            const split = calculateSuggestedLoanSplit({
              debt: targetDebt,
              paymentAmount: parsedAmount,
              paymentDate: editDate,
              paymentType: editPaymentType,
            });
            principalAmt = split.suggestedPrincipal;
            interestAmt = split.suggestedInterest;
          } else {
            principalAmt = parsedAmount;
            interestAmt = 0;
          }
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
        paymentType: editPaymentType,
        mortgagePaymentType: editPaymentType,
      } as any);
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
        initialPaidAmount: 0,
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

        if (formDebtPrincipal) {
          const p = parseFloat(formDebtPrincipal.replace(',', '.'));
          if (!isNaN(p) && p >= 0) {
            principalAmt = p;
            interestAmt = formDebtInterest
              ? (parseFloat(formDebtInterest.replace(',', '.')) || 0)
              : Math.max(0, Math.round((parsedAmount - p) * 100) / 100);
          }
        }
        if (principalAmt === undefined) {
          if (formPaymentType === 'overpayment') {
            principalAmt = parsedAmount;
            interestAmt = 0;
          } else if (isInterestBearingDebt(targetDebt)) {
            const split = calculateSuggestedLoanSplit({
              debt: targetDebt,
              paymentAmount: parsedAmount,
              paymentDate: formDate,
              paymentType: formPaymentType,
            });
            principalAmt = split.suggestedPrincipal;
            interestAmt = split.suggestedInterest;
          } else {
            principalAmt = parsedAmount;
            interestAmt = 0;
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
      paymentType: formPaymentType,
      mortgagePaymentType: formPaymentType,
    } as any);

    recordTransactionUsage(formTitle.trim(), formCategory, formType, parsedAmount);

    setFormTitle('');
    setFormAmount('');
    setFormComment('');
    setFormRecurring(false);
    setFormDebtId('');
    setFormDebtPrincipal('');
    setFormDebtInterest('');
    setFormPaymentType('regular');
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
        <div className="relative w-full sm:w-72 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj (transakcje, pozycje, sklep)..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
              title="Wyczyść wyszukiwanie"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* View Mode Switcher & Search Scope Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-0.5">
        {/* Tabs: Główne wpisy vs Pozycje z paragonów */}
        <div className="flex items-center space-x-1.5 bg-slate-100/90 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/60">
          <button
            type="button"
            onClick={() => setViewMode('transactions')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
              viewMode === 'transactions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Główne wpisy ({filtered.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('receipt_items')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
              viewMode === 'receipt_items'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600'
            }`}
            title="Przełącz na widok pojedynczych pozycji z paragonów"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Pozycje z paragonów ({allFilteredReceiptItems.length})</span>
          </button>
        </div>

        {/* Search details & All Months Scope */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 flex-wrap justify-between sm:justify-end gap-y-1.5">
          {selectedMonth && (
            <label className="flex items-center space-x-1.5 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-2 py-1 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={searchAllMonths}
                onChange={(e) => setSearchAllMonths(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span className="text-[11px] font-medium text-slate-700">Wszystkie miesiące</span>
            </label>
          )}

          {searchQuery.trim() && (
            <div className="flex items-center space-x-1.5 text-[11px] bg-amber-50 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200/70 font-medium">
              <span>Szukasz:</span>
              <strong className="font-bold underline decoration-amber-400">„{searchQuery}”</strong>
              <span className="text-amber-700/80 font-normal">
                ({filtered.length} wpisów, {allFilteredReceiptItems.length} pozycji)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Out-of-month search matches prompt */}
      {otherMonthMatchesCount > 0 && !searchAllMonths && filtered.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-center justify-between gap-3 shadow-xs">
          <span>
            Brak wyników w wybranym miesiącu ({selectedMonth}), ale znaleziono <strong>{otherMonthMatchesCount}</strong> pasujących wpisów w innych miesiącach.
          </span>
          <button
            type="button"
            onClick={() => setSearchAllMonths(true)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg transition-colors shrink-0 cursor-pointer text-xs"
          >
            Pokaż ze wszystkich miesięcy
          </button>
        </div>
      )}

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

      {/* Transactions List Table / Receipt Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100 w-full">
        {viewMode === 'receipt_items' ? (
          allFilteredReceiptItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">Brak pozycji z paragonów</p>
              <p className="text-xs text-slate-400">
                {searchQuery
                  ? `Nie znaleziono pozycji w paragonach pasujących do „${searchQuery}”.`
                  : 'Brak zarejestrowanych paragonów ze szczegółowymi pozycjami w wybranym filtrze.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Sub-header with count and sum */}
              <div className="p-3 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 flex-wrap gap-2">
                <span className="font-medium">
                  Znaleziono <strong className="text-slate-800">{allFilteredReceiptItems.length}</strong> {allFilteredReceiptItems.length === 1 ? 'pozycję' : 'pozycji'} w paragonach
                </span>
                <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                  Suma pozycji: {totalReceiptItemsSum.toFixed(2)} PLN
                </span>
              </div>

              {allFilteredReceiptItems.map((flatItem) => {
                const isIncome = flatItem.transaction.type === 'income';
                return (
                  <div
                    key={flatItem.id}
                    className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/80 transition-colors w-full overflow-hidden"
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="p-2 rounded-xl shrink-0 mt-0.5 sm:mt-0 bg-indigo-50 text-indigo-600">
                        <Receipt className="w-4 h-4 stroke-[2.5]" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug break-words">
                                <HighlightText text={flatItem.item.name} query={searchQuery} />
                              </h3>
                              {flatItem.item.quantity && flatItem.item.quantity > 1 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  x{flatItem.item.quantity}
                                </span>
                              )}
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                                {flatItem.item.category || flatItem.transaction.category}
                              </span>
                            </div>
                          </div>

                          {/* Mobile Price */}
                          <div className="text-right sm:hidden shrink-0 pl-1">
                            <span
                              className={`text-sm font-black whitespace-nowrap block ${
                                isIncome ? 'text-emerald-600' : 'text-slate-900'
                              }`}
                            >
                              {isIncome ? '+' : '-'}
                              {flatItem.item.price.toFixed(2)} zł
                            </span>
                          </div>
                        </div>

                        {/* Origin Receipt Info */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                          <span className="font-medium text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/60 flex items-center space-x-1">
                            <span>Paragon:</span>
                            <strong className="text-indigo-900">
                              <HighlightText
                                text={flatItem.transaction.receiptStoreName || flatItem.transaction.title}
                                query={searchQuery}
                              />
                            </strong>
                          </span>
                          <span className="flex items-center space-x-1 text-slate-400">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{flatItem.item.date || flatItem.transaction.date}</span>
                          </span>
                          {flatItem.item.notes && (
                            <span className="italic text-slate-400 text-[10px] truncate max-w-[200px]">
                              ({flatItem.item.notes})
                            </span>
                          )}
                        </div>

                        {/* Mobile actions */}
                        <div className="flex items-center space-x-2 pt-1 sm:hidden">
                          <button
                            type="button"
                            onClick={() => handleScrollToTransaction(flatItem.transaction.id)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Pokaż wpis</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptDetails(flatItem.transaction)}
                            className="text-[11px] font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Pełny paragon
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Price & Actions */}
                    <div className="hidden sm:flex items-center space-x-3 shrink-0 pl-2">
                      <div className="text-right">
                        <span
                          className={`text-sm sm:text-base font-black whitespace-nowrap block ${
                            isIncome ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {flatItem.item.price.toFixed(2)} zł
                        </span>
                        <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                          z paragonu: {flatItem.transaction.amount.toFixed(2)} zł
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleScrollToTransaction(flatItem.transaction.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Pokaż główną transakcję na liście"
                      >
                        <span>Wpis</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedReceiptDetails(flatItem.transaction)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg cursor-pointer"
                        title="Pokaż cały paragon"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(flatItem.transaction)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg cursor-pointer"
                        title="Edytuj powiązaną transakcję"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm space-y-2">
              <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">Brak transakcji</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isIncome = item.type === 'income';

              // Calculate loan interest / principal split if applicable
              const linkedDebt = item.debtId ? debts.find((d) => d.id === item.debtId) : null;
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

              const hasAnyBadges =
                item.isBalanceRollover ||
                item.debtId ||
                item.isRecurring ||
                (item.receiptItems && item.receiptItems.length > 0);

              return (
                <div
                  key={item.id}
                  id={`tx-row-${item.id}`}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/80 transition-colors w-full overflow-hidden"
                >
                  {/* Main Content Area */}
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    {/* Direction Arrow Icon */}
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>

                    {/* Text & Badges Details */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Header Row: Title, Category & (Mobile-only) Amount */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug break-words">
                              <HighlightText text={item.title} query={searchQuery} />
                            </h3>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                              {item.category}
                            </span>
                          </div>
                        </div>

                        {/* Amount on Mobile (< sm) */}
                        <div className="text-right sm:hidden shrink-0 pl-1">
                          <span
                            className={`text-sm font-black whitespace-nowrap block ${
                              isIncome ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {item.amount.toFixed(2)} zł
                          </span>
                        </div>
                      </div>

                      {/* Labels / Badges Row (dedicated container, full-width wrapping, never overlapping amount) */}
                      {hasAnyBadges && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.isBalanceRollover && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center space-x-1 shrink-0"
                              title={`Przeniesienie bilansu z ${item.rolloverFromMonth || 'poprzedniego miesiąca'}`}
                            >
                              <Sparkles className="w-3 h-3 text-violet-600 shrink-0" />
                              <span>Przeniesienie bilansu</span>
                            </span>
                          )}

                          {item.debtId && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1 max-w-full"
                              title={linkedDebt ? `Spłata dla: ${linkedDebt.name}` : 'Powiązano ze zobowiązaniem'}
                            >
                              <Landmark className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[200px] sm:max-w-xs">
                                {linkedDebt ? `Zobowiązanie: ${linkedDebt.name}` : 'Zobowiązanie'}
                              </span>
                            </span>
                          )}

                          {item.debtId && hasInterest && (pAmt !== undefined || iAmt !== undefined) && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 flex items-center space-x-1 max-w-full"
                              title="Podział wpłaty na ratę kapitałową i odsetkową"
                            >
                              <Percent className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="break-normal">
                                Kapitał: {(pAmt ?? item.amount).toFixed(2)} zł • Odsetki: {(iAmt ?? 0).toFixed(2)} zł
                              </span>
                            </span>
                          )}

                          {item.isRecurring && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center space-x-0.5 shrink-0"
                              title="Płatność cykliczna"
                            >
                              <Repeat className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>Cykliczna</span>
                            </span>
                          )}

                          {item.receiptItems && item.receiptItems.length > 0 && (() => {
                            const isAutoExpanded = !!queryNorm && (
                              item.receiptItems.some((ri) => matchesReceiptItem(ri, queryNorm)) ||
                              normalizeSearchText(item.title).includes(queryNorm) ||
                              (item.receiptStoreName && normalizeSearchText(item.receiptStoreName).includes(queryNorm))
                            );
                            const isManuallyExpanded = expandedReceiptIds.has(item.id);
                            const isExpanded = isAutoExpanded || isManuallyExpanded;

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedReceiptIds((prev) => {
                                    const next = new Set(prev);
                                    if (isExpanded) {
                                      next.delete(item.id);
                                    } else {
                                      next.add(item.id);
                                    }
                                    return next;
                                  });
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center space-x-1 shrink-0 cursor-pointer ${
                                  isExpanded
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 active:bg-indigo-200'
                                }`}
                                title={isExpanded ? 'Zwiń pozycje z paragonu' : 'Rozwiń pozycje z paragonu'}
                              >
                                <Receipt className="w-3 h-3 shrink-0" />
                                <span>{item.receiptItems.length} poz. paragonu</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 shrink-0" />
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      )}

                      {/* Inline Receipt Items section */}
                      {item.receiptItems && item.receiptItems.length > 0 && (() => {
                        const matchingItems = queryNorm
                          ? item.receiptItems.filter((ri) => matchesReceiptItem(ri, queryNorm))
                          : [];
                        const parentMatchedDirectly = queryNorm
                          ? (
                              normalizeSearchText(item.title).includes(queryNorm) ||
                              (item.receiptStoreName && normalizeSearchText(item.receiptStoreName).includes(queryNorm)) ||
                              (item.comment && normalizeSearchText(item.comment).includes(queryNorm)) ||
                              normalizeSearchText(item.category).includes(queryNorm)
                            )
                          : false;

                        const isAutoExpanded = queryNorm.length > 0 && (matchingItems.length > 0 || parentMatchedDirectly);
                        const isManuallyExpanded = expandedReceiptIds.has(item.id);
                        const isExpanded = isAutoExpanded || isManuallyExpanded;

                        if (!isExpanded) return null;

                        const showAll =
                          showAllItemsTxIds.has(item.id) ||
                          parentMatchedDirectly ||
                          matchingItems.length === 0 ||
                          matchingItems.length === item.receiptItems.length ||
                          !queryNorm;

                        const itemsToDisplay = showAll ? item.receiptItems : matchingItems;

                        return (
                          <div className="w-full mt-2 pt-2 border-t border-slate-100 space-y-1.5 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                              <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                                <Receipt className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>
                                  {queryNorm && !showAll
                                    ? `Dopasowane pozycje w paragonie (${matchingItems.length} z ${item.receiptItems.length}):`
                                    : `Pozycje w paragonie (${item.receiptItems.length}):`}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-[11px]">
                                {!showAll && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAllItemsTxIds((prev) => new Set(prev).add(item.id));
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline-offset-2 hover:underline"
                                  >
                                    + Pokaż wszystkie ({item.receiptItems.length})
                                  </button>
                                )}
                                {showAll && queryNorm && matchingItems.length < item.receiptItems.length && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAllItemsTxIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(item.id);
                                        return next;
                                      });
                                    }}
                                    className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer underline-offset-2 hover:underline"
                                  >
                                    Tylko dopasowane ({matchingItems.length})
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedReceiptDetails(item)}
                                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline-offset-2 hover:underline flex items-center space-x-0.5"
                                >
                                  <span>Pełny podgląd</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            <div className="bg-slate-50/90 rounded-xl p-1.5 border border-slate-200/80 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                              {itemsToDisplay.map((recItem, rIdx) => {
                                const isThisItemMatch = queryNorm ? matchesReceiptItem(recItem, queryNorm) : false;
                                return (
                                  <div
                                    key={rIdx}
                                    className={`py-1.5 px-2 flex items-center justify-between text-xs rounded-lg transition-colors ${
                                      isThisItemMatch ? 'bg-amber-50/90 border border-amber-200/60 font-medium' : 'hover:bg-slate-100/60'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center space-x-1.5 flex-wrap">
                                        {isThisItemMatch && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Dopasowanie wyszukiwania" />
                                        )}
                                        <span className="text-slate-900 font-medium truncate max-w-full">
                                          <HighlightText text={recItem.name} query={searchQuery} />
                                        </span>
                                        {recItem.quantity && recItem.quantity > 1 && (
                                          <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-slate-200/70 text-slate-600 shrink-0">
                                            x{recItem.quantity}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium">
                                          {recItem.category || item.category}
                                        </span>
                                        {recItem.notes && (
                                          <span className="italic text-slate-500 truncate max-w-[200px]">
                                            {recItem.notes}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 pl-1">
                                      <span className="font-bold text-slate-900 text-xs">
                                        {recItem.price.toFixed(2)} zł
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Note / Comment (if present) */}
                      {item.comment && item.comment.trim() !== item.title.trim() && (
                        <div className="flex items-start space-x-1.5 text-[11px] text-slate-500 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100/80 max-w-full">
                          <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="italic break-words">
                            <HighlightText text={item.comment} query={searchQuery} />
                          </span>
                        </div>
                      )}

                      {/* Date, Store and (on mobile) Action Buttons */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
                        <div className="flex items-center space-x-3 shrink-0 flex-wrap">
                          <span className="flex items-center space-x-1 font-medium text-slate-500">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="whitespace-nowrap">{item.date}</span>
                          </span>
                          {item.receiptStoreName && (
                            <span className="text-slate-600 font-medium truncate max-w-[150px] sm:max-w-xs">
                              Sklep: <HighlightText text={item.receiptStoreName} query={searchQuery} />
                            </span>
                          )}
                        </div>

                        {/* Mobile Actions: Edit & Delete buttons */}
                        <div className="flex items-center space-x-1 sm:hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors rounded-lg touch-manipulation"
                            title="Edytuj transakcję"
                            aria-label="Edytuj"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors rounded-lg touch-manipulation"
                            title="Usuń transakcję"
                            aria-label="Usuń"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Amount & Actions (sm and up) */}
                  <div className="hidden sm:flex items-center space-x-3 shrink-0 pl-2">
                    <div className="text-right">
                      <span
                        className={`text-sm sm:text-base font-black whitespace-nowrap block ${
                          isIncome ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {item.amount.toFixed(2)} zł
                      </span>
                      {hasInterest && (pAmt !== undefined || iAmt !== undefined) && (
                        <span className="text-[10px] font-semibold text-slate-500 block whitespace-nowrap">
                          kap. {(pAmt ?? item.amount).toFixed(2)} zł / ods. {(iAmt ?? 0).toFixed(2)} zł
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg cursor-pointer"
                      title="Edytuj transakcję"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(item.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-lg cursor-pointer"
                      title="Usuń"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
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
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="submit"
                  form="edit-tx-form"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Zapisz zmiany"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Zapisz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zamknij"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form id="edit-tx-form" onSubmit={handleSaveEdit} className="space-y-3.5">
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
                      if (!targetDebt) return null;
                      const parsedAmt = parseFloat(editAmount.replace(',', '.')) || 0;

                      return (
                        <div className="space-y-2">
                          <DebtSplitAndLivePreview
                            debt={targetDebt}
                            paymentAmount={parsedAmt}
                            paymentDate={editDate}
                            paymentType={editPaymentType}
                            onChangePaymentType={(type) => setEditPaymentType(type)}
                            principalAmount={editDebtPrincipal}
                            onChangePrincipal={(val) => setEditDebtPrincipal(val)}
                            interestAmount={editDebtInterest}
                            onChangeInterest={(val) => setEditDebtInterest(val)}
                            onSetExactAmount={(amt) => setEditAmount(amt)}
                            excludeTransactionId={editingTransaction.id}
                            className="mt-1"
                          />
                          <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                            💡 Zapisanie zmian zaktualizuje historię spłat i saldo tego zobowiązania.
                          </p>
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
      {showAddModal && (() => {
        const isDebtCategory = formCategory === 'Zobowiązania i pożyczki';
        const linkedDebtTarget =
          isDebtCategory && formDebtActionType === 'link' && formDebtId
            ? debts.find((d) => d.id === formDebtId)
            : undefined;
        const parsedFormAmt = parseFloat(formAmount.replace(',', '.')) || 0;
        const isDebtOverpaid =
          !!linkedDebtTarget &&
          linkedDebtTarget.currentRemaining > 0 &&
          parsedFormAmt > linkedDebtTarget.currentRemaining + 0.009;
        const isFormValid =
          !!formTitle.trim() && !!formAmount && parsedFormAmt > 0 && !isDebtOverpaid;

        return (
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
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="submit"
                    form="add-tx-form"
                    disabled={!isFormValid}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                    title={formType === 'income' ? 'Dodaj wpłatę' : 'Dodaj wydatek'}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{formType === 'income' ? 'Dodaj' : 'Zapisz'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Zamknij"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form id="add-tx-form" onSubmit={handleSubmit} className="space-y-3.5">
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
                            if (!targetDebt) return null;
                            const parsedNum = parseFloat(formAmount.replace(',', '.')) || 0;

                            return (
                              <div className="space-y-2">
                                <DebtSplitAndLivePreview
                                  debt={targetDebt}
                                  paymentAmount={parsedNum}
                                  paymentDate={formDate}
                                  paymentType={formPaymentType}
                                  onChangePaymentType={(type) => setFormPaymentType(type)}
                                  principalAmount={formDebtPrincipal}
                                  onChangePrincipal={(val) => setFormDebtPrincipal(val)}
                                  interestAmount={formDebtInterest}
                                  onChangeInterest={(val) => setFormDebtInterest(val)}
                                  onSetExactAmount={(amt) => setFormAmount(amt)}
                                  className="mt-1"
                                />
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
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isDebtOverpaid ? 'Kwota przekracza saldo spłaty' : (formType === 'income' ? 'Dodaj wpłatę' : 'Dodaj wydatek')}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

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

