import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Camera,
  Check,
  Zap,
  Sparkles,
  Tag,
  DollarSign,
  Coffee,
  ShoppingBag,
  Fuel,
  Pill,
  Home,
  Heart,
  Gift,
  Briefcase,
  ShoppingCart,
  CheckCircle2,
  Package,
  Landmark,
  Building2,
  Users,
  User,
  Percent,
  ChevronDown,
} from 'lucide-react';
import { Transaction, TransactionType, ShoppingItem, ShoppingList, DebtItem, DebtType, DebtCategory } from '../types';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES } from '../mockData';
import {
  getSmartShoppingSuggestions,
  recordShoppingItemUsage,
  SmartSuggestionItem,
} from '../utils/frequentShoppingItems';
import {
  getSmartTransactionSuggestions,
  recordTransactionUsage,
  SmartTransactionSuggestion,
} from '../utils/frequentTransactions';
import {
  calculateSuggestedLoanSplit,
  isInterestBearingDebt,
  isDebtInGracePeriod,
} from '../utils/loanCalculation';
import { DebtRepaymentLivePreview } from './DebtRepaymentLivePreview';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onAddShoppingItem?: (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  onAddDebt?: (debt: DebtItem) => void;
  transactions?: Transaction[];
  shoppingLists?: ShoppingList[];
  shoppingItems?: ShoppingItem[];
  debts?: DebtItem[];
  onOpenScanner: () => void;
  onSuccessFeedback?: (
    title: string,
    amount: number,
    type: TransactionType | 'shopping',
    onUndo?: () => void,
    subtitle?: string
  ) => void;
}

interface SmartSuggestion {
  label: string;
  category: string;
  type: TransactionType;
  icon: React.ComponentType<{ className?: string }>;
}

interface ShoppingQuickSuggestion {
  name: string;
  category: string;
  unit: string;
  estimatedPrice?: number;
  emoji: string;
}

const EXPENSE_CATEGORIES = INITIAL_CATEGORIES.map((c) => c.name);

const EXPENSE_SUGGESTIONS: SmartSuggestion[] = [
  { label: 'Biedronka / Lidl', category: 'Jedzenie i artykuły spożywcze', type: 'expense', icon: ShoppingBag },
  { label: 'Kawiarnia / Lunch', category: 'Jedzenie i artykuły spożywcze', type: 'expense', icon: Coffee },
  { label: 'Paliwo / Stacja', category: 'Transport i paliwo', type: 'expense', icon: Fuel },
  { label: 'Apteka / Kosmetyki', category: 'Zdrowie i kosmetyki', type: 'expense', icon: Pill },
  { label: 'Dla zwierząt', category: 'Dla kotów i zwierząt', type: 'expense', icon: Heart },
  { label: 'Czynsz / Media', category: 'Rachunki i media', type: 'expense', icon: Home },
];

const INCOME_SUGGESTIONS: SmartSuggestion[] = [
  { label: 'Wypłata z etatu', category: 'Wypłata z etatu', type: 'income', icon: Briefcase },
  { label: 'Premia / Bonus', category: 'Premia / Bonus', type: 'income', icon: Zap },
  { label: 'Zwrot / Podatek', category: 'Zwrot (zakupy, podatki)', type: 'income', icon: DollarSign },
  { label: 'Zlecenie / Freelance', category: 'Freelance / Zlecenia', type: 'income', icon: Sparkles },
  { label: 'Prezent / Darowizna', category: 'Prezent / Darowizna', type: 'income', icon: Gift },
];

const SHOPPING_QUICK_SUGGESTIONS: ShoppingQuickSuggestion[] = [
  { name: 'Chleb żytni', category: 'Spożywcze', unit: 'szt.', estimatedPrice: 4.5, emoji: '🥖' },
  { name: 'Mleko 3.2%', category: 'Spożywcze', unit: 'szt.', estimatedPrice: 3.8, emoji: '🥛' },
  { name: 'Masło ekstra', category: 'Spożywcze', unit: 'szt.', estimatedPrice: 7.5, emoji: '🧈' },
  { name: 'Jajka wolny wybieg (10 szt)', category: 'Spożywcze', unit: 'op.', estimatedPrice: 12.0, emoji: '🥚' },
  { name: 'Kawa ziarnista', category: 'Spożywcze', unit: 'op.', estimatedPrice: 45.0, emoji: '☕' },
  { name: 'Pomidory malinowe', category: 'Spożywcze', unit: 'kg', estimatedPrice: 14.0, emoji: '🍅' },
  { name: 'Banany', category: 'Spożywcze', unit: 'kg', estimatedPrice: 6.5, emoji: '🍌' },
  { name: 'Karma dla zwierząt', category: 'Dla kotów i zwierząt', unit: 'op.', estimatedPrice: 35.0, emoji: '🐾' },
  { name: 'Papier toaletowy', category: 'Dom i chemia', unit: 'op.', estimatedPrice: 18.0, emoji: '🧻' },
  { name: 'Proszek / Płyn do prania', category: 'Dom i chemia', unit: 'szt.', estimatedPrice: 39.0, emoji: '🧴' },
];

const DEFAULT_SHOPPING_CATEGORIES = [
  'Spożywcze',
  'Dom i chemia',
  'Remont i ogród',
  'Dla kotów i zwierząt',
  'Kosmetyki i zdrowie',
  'Inne',
];

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  onAddShoppingItem,
  onAddDebt,
  transactions = [],
  shoppingLists = [],
  shoppingItems = [],
  debts = [],
  onOpenScanner,
  onSuccessFeedback,
}) => {
  // Main Tab Mode: 'transaction' or 'shopping'
  const [activeTabMode, setActiveTabMode] = useState<'transaction' | 'shopping'>('transaction');

  // Transaction form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Jedzenie i artykuły spożywcze');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState<string>('');
  const [debtId, setDebtId] = useState<string>('');
  const [debtPrincipal, setDebtPrincipal] = useState<string>('');
  const [debtInterest, setDebtInterest] = useState<string>('');
  const [debtPaymentType, setDebtPaymentType] = useState<'regular' | 'overpayment'>('regular');
  const [error, setError] = useState<string | null>(null);

  // New Debt creation sub-form state when category === 'Zobowiązania i pożyczki'
  const [debtActionType, setDebtActionType] = useState<'link' | 'create_new'>('link');
  const [newDebtCounterparty, setNewDebtCounterparty] = useState<string>('');
  const [newDebtDueDate, setNewDebtDueDate] = useState<string>('');
  const [newDebtCategory, setNewDebtCategory] = useState<DebtCategory>('inne');
  const [newDebtMonthlyPayment, setNewDebtMonthlyPayment] = useState<string>('');
  const [newDebtNotes, setNewDebtNotes] = useState<string>('');

  // Shopping form state (simplified: only title/description & category)
  const [shoppingItemName, setShoppingItemName] = useState<string>('');
  const [shoppingCategory, setShoppingCategory] = useState<string>('Spożywcze');
  const [keepShoppingOpen, setKeepShoppingOpen] = useState<boolean>(false);
  const [shoppingSuccessBadge, setShoppingSuccessBadge] = useState<string | null>(null);
  const [showQuickEntries, setShowQuickEntries] = useState<boolean>(false);
  const [showQuickProducts, setShowQuickProducts] = useState<boolean>(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const shoppingNameInputRef = useRef<HTMLInputElement>(null);
  const formTxRef = useRef<HTMLFormElement>(null);
  const formShopRef = useRef<HTMLFormElement>(null);

  // Dynamic smart suggestions based on user's frequent items + current shopping list + popular defaults (max 10)
  const dynamicShoppingSuggestions = useMemo(() => {
    return getSmartShoppingSuggestions(shoppingItems, '').slice(0, 10);
  }, [shoppingItems, isOpen]);

  // Dynamic smart suggestions for transactions based on frequency and history (max 10)
  const dynamicTransactionSuggestions = useMemo(() => {
    return getSmartTransactionSuggestions(transactions, type, title, 10);
  }, [transactions, type, title, isOpen]);

  // Focus appropriate input on open or tab change
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setShoppingSuccessBadge(null);
      setDebtId('');
      const timer = setTimeout(() => {
        if (activeTabMode === 'transaction') {
          amountInputRef.current?.focus();
        } else {
          shoppingNameInputRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTabMode]);

  // Update default category when switching type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'expense') {
      setCategory('Jedzenie i artykuły spożywcze');
    } else {
      setCategory('Wypłata z etatu');
    }
  };

  const handleApplyTxSuggestion = (sug: SmartTransactionSuggestion) => {
    setTitle(sug.title);
    setCategory(sug.category);
    // As requested: do not add price when clicking suggestions, only title and category
    amountInputRef.current?.focus();
  };

  const handleApplyAmount = (val: number) => {
    const current = parseFloat(amount.replace(',', '.')) || 0;
    if (current > 0) {
      setAmount((current + val).toFixed(2).replace('.00', ''));
    } else {
      setAmount(val.toString());
    }
    amountInputRef.current?.focus();
  };

  const handleApplyShoppingSuggestion = (sug: { name: string; category: string }) => {
    setShoppingItemName(sug.name);
    setShoppingCategory(sug.category);
    if (error) setError(null);
    shoppingNameInputRef.current?.focus();
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount.replace(',', '.'));

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setError('Wpisz poprawną kwotę większą od zera');
      amountInputRef.current?.focus();
      return;
    }

    const isDebtCategory = category === 'Zobowiązania i pożyczki';
    let assignedDebtId = debtId || undefined;
    let debtAction: 'borrow' | 'repay_borrowed' | 'lend' | 'receive_lent' | undefined = undefined;

    let principalAmt: number | undefined = undefined;
    let interestAmt: number | undefined = undefined;

    // If user is adding a NEW debt/loan directly in QuickAdd
    if (isDebtCategory && debtActionType === 'create_new' && onAddDebt) {
      const counterparty = newDebtCounterparty.trim() || (type === 'income' ? 'Bank / Wierzyciel' : 'Dłużnik');
      const debtName = title.trim() || (type === 'income' ? `Zobowiązanie: ${counterparty}` : `Pożyczka dla: ${counterparty}`);
      const monthlyPmt = parseFloat(newDebtMonthlyPayment.replace(',', '.')) || undefined;
      const createdDebtId = `debt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const debtType: DebtType = type === 'income' ? 'borrowed' : 'lent';

      const newDebtItem: DebtItem = {
        id: createdDebtId,
        type: debtType,
        category: newDebtCategory,
        name: debtName,
        counterparty: counterparty,
        initialAmount: cleanAmount,
        totalAmount: cleanAmount,
        currentRemaining: cleanAmount,
        initialPaidAmount: 0,
        paidAmount: 0,
        startDate: date || new Date().toISOString().split('T')[0],
        dueDate: newDebtDueDate || undefined,
        monthlyPayment: monthlyPmt,
        status: 'active',
        notes: newDebtNotes.trim() || undefined,
        paymentsHistory: [],
        createdAt: new Date().toISOString(),
      };

      onAddDebt(newDebtItem);
      assignedDebtId = createdDebtId;
      debtAction = debtType === 'borrowed' ? 'borrow' : 'lend';
    } else if (isDebtCategory && assignedDebtId) {
      const targetDebt = debts.find((d) => d.id === assignedDebtId);
      if (targetDebt) {
        if (targetDebt.currentRemaining > 0 && cleanAmount > targetDebt.currentRemaining + 0.009) {
          const over = cleanAmount - targetDebt.currentRemaining;
          setError(`Kwota (${cleanAmount.toFixed(2)} zł) przekracza pozostałe saldo zobowiązania (${targetDebt.currentRemaining.toFixed(2)} zł) o ${over.toFixed(2)} zł.`);
          return;
        }

        if (isInterestBearingDebt(targetDebt)) {
          if (debtPrincipal) {
            const p = parseFloat(debtPrincipal.replace(',', '.'));
            if (!isNaN(p) && p >= 0) {
              principalAmt = p;
              interestAmt = Math.max(0, Math.round((cleanAmount - p) * 100) / 100);
            }
          }
          if (principalAmt === undefined) {
            const split = calculateSuggestedLoanSplit({
              debt: targetDebt,
              paymentAmount: cleanAmount,
              paymentDate: date,
              paymentType: debtPaymentType,
            });
            principalAmt = split.suggestedPrincipal;
            interestAmt = split.suggestedInterest;
          }
        }
      }
      debtAction = type === 'expense' ? 'repay_borrowed' : 'receive_lent';
    }

    const finalTitle = title.trim() || (type === 'expense' ? `Wydatek: ${category}` : `Wpływ: ${category}`);

    const newTxData = {
      type,
      amount: cleanAmount,
      title: finalTitle,
      category,
      date: date || new Date().toISOString().split('T')[0],
      comment: comment.trim() || undefined,
      debtId: isDebtCategory ? assignedDebtId : undefined,
      debtAction: isDebtCategory ? debtAction : undefined,
      debtCounterparty: isDebtCategory && debtActionType === 'create_new' ? newDebtCounterparty.trim() : undefined,
      principalAmount: principalAmt,
      interestAmount: interestAmt,
      paymentType: debtPaymentType,
    };

    onAddTransaction(newTxData);

    // Record usage for dynamic smart suggestions
    recordTransactionUsage(finalTitle, category, type, cleanAmount);

    if (onSuccessFeedback) {
      onSuccessFeedback(finalTitle, cleanAmount, type);
    }

    onClose();
  };

  const handleSubmitShopping = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = shoppingItemName.trim();
    if (!trimmedName) {
      setError('Wpisz nazwę pozycji do kupienia');
      shoppingNameInputRef.current?.focus();
      return;
    }

    // Determine target listId if a matching list exists
    const matchingList = shoppingLists.find(
      (l) =>
        l.name.toLowerCase() === shoppingCategory.toLowerCase() ||
        l.category.toLowerCase() === shoppingCategory.toLowerCase()
    );

    const listId = matchingList ? matchingList.id : (shoppingLists[0]?.id || `list-${Date.now()}`);

    if (onAddShoppingItem) {
      onAddShoppingItem({
        name: trimmedName,
        category: shoppingCategory,
        quantity: 1,
        unit: 'szt.',
        isCompleted: false,
        listId,
      });
    }

    // Save to frequent shopping items
    recordShoppingItemUsage(trimmedName, shoppingCategory);

    if (onSuccessFeedback) {
      onSuccessFeedback(
        trimmedName,
        0,
        'shopping',
        undefined,
        `Dodano do listy zakupów (${shoppingCategory})`
      );
    }

    if (keepShoppingOpen) {
      setShoppingSuccessBadge(`Dodano: "${trimmedName}". Możesz dodać kolejną pozycję.`);
      setShoppingItemName('');
      setError(null);
      setTimeout(() => setShoppingSuccessBadge(null), 3000);
      shoppingNameInputRef.current?.focus();
    } else {
      setShoppingItemName('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentCategories = type === 'expense' ? EXPENSE_CATEGORIES : INITIAL_INCOME_CATEGORIES;
  const currentSuggestions = type === 'expense' ? EXPENSE_SUGGESTIONS : INCOME_SUGGESTIONS;

  // Build combined shopping categories list (user's custom lists + default categories + category from suggestions)
  const availableShoppingOptions = Array.from(
    new Set([
      ...shoppingLists.map((l) => l.name),
      ...DEFAULT_SHOPPING_CATEGORIES,
      ...dynamicShoppingSuggestions.map((s) => s.category),
      shoppingCategory,
    ])
  );

  return (
    <div
      id="quick-add-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="quick-add-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-xs transition-colors ${
                activeTabMode === 'transaction' ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}
            >
              {activeTabMode === 'transaction' ? <Zap className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="quick-add-title" className="text-base font-bold text-slate-900 tracking-tight">
                Szybki Wpis
              </h2>
              <p className="text-xs text-slate-500">
                {activeTabMode === 'transaction'
                  ? 'Zapisz transakcję w 3 sekundy'
                  : 'Dodaj produkt do listy zakupów jednym kliknięciem'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="quick-add-header-save-btn"
              onClick={() => {
                if (activeTabMode === 'transaction') {
                  formTxRef.current?.requestSubmit();
                } else {
                  formShopRef.current?.requestSubmit();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              Zapisz
            </button>
            <button
              id="quick-add-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Zamknij (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Mode Switcher: Transakcja vs Do listy zakupów */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 bg-white">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              id="quick-add-tab-transaction"
              onClick={() => {
                setActiveTabMode('transaction');
                setError(null);
              }}
              className={`flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTabMode === 'transaction'
                  ? 'bg-white text-slate-900 shadow-xs scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Transakcja (Finanse)</span>
            </button>
            <button
              type="button"
              id="quick-add-tab-shopping"
              onClick={() => {
                setActiveTabMode('shopping');
                setError(null);
              }}
              className={`flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTabMode === 'shopping'
                  ? 'bg-white text-slate-900 shadow-xs scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              <span>Do listy zakupów</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success badge inside modal if keep-open is enabled */}
        {shoppingSuccessBadge && (
          <div className="mx-5 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center space-x-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shoppingSuccessBadge}</span>
          </div>
        )}

        {/* TAB 1: TRANSACTION FORM */}
        {activeTabMode === 'transaction' && (
          <form ref={formTxRef} onSubmit={handleSubmitTransaction} className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* 1-Click Type Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100/90 p-1 rounded-2xl">
              <button
                type="button"
                id="quick-add-type-expense"
                onClick={() => handleTypeChange('expense')}
                className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Wydatek</span>
              </button>
              <button
                type="button"
                id="quick-add-type-income"
                onClick={() => handleTypeChange('income')}
                className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Wpływ / Przychód</span>
              </button>
            </div>

            {/* Amount Field (Hero Input) */}
            <div>
              <label htmlFor="quick-add-amount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Kwota transakcji
              </label>
              <div className="relative flex items-center">
                <input
                  ref={amountInputRef}
                  id="quick-add-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="0.00"
                  className={`w-full text-2xl sm:text-3xl font-extrabold px-4 py-3 rounded-2xl border transition-all text-slate-900 placeholder:text-slate-300 focus:outline-hidden focus:ring-2 ${
                    type === 'expense'
                      ? 'border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20'
                      : 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/20'
                  }`}
                />
                <span className="absolute right-4 font-extrabold text-slate-400 text-lg">PLN</span>
              </div>
            </div>

            {/* Title / Description */}
            <div>
              <label htmlFor="quick-add-title-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Tytuł / Nazwa
              </label>
              <input
                id="quick-add-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'expense' ? 'np. Zakupy w sklepie' : 'np. Wynagrodzenie'}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Date Picker & Category: Date is placed directly after Title and before Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Field (po tytule, a przed kategorią) */}
              <div>
                <label htmlFor="quick-add-date" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Data transakcji
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="quick-add-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="quick-add-category" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Kategoria
                </label>
                <div className="relative">
                  <select
                    id="quick-add-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer pr-8"
                  >
                    {currentCategories.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Debt Link or Create New Debt Selector in QuickAdd (Strictly shown only when category === 'Zobowiązania i pożyczki') */}
            {category === 'Zobowiązania i pożyczki' && (() => {
              const matchingDebts = debts.filter(
                (d) =>
                  (type === 'expense' ? d.type === 'borrowed' : d.type === 'lent') &&
                  d.status !== 'settled' &&
                  d.currentRemaining > 0
              );

              return (
                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-3 transition-all animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-indigo-950">
                        {debtActionType === 'create_new'
                          ? type === 'income'
                            ? 'Nowe zobowiązanie (Wpływ pożyczki / kredytu od wierzyciela)'
                            : 'Nowa udzielona pożyczka (Wydatek na pożyczkę dla dłużnika)'
                          : type === 'expense'
                          ? 'Spłata zobowiązania (Wydatek na rzecz wierzyciela)'
                          : 'Zwrot pożyczki (Wpływ od dłużnika)'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                      Zobowiązania
                    </span>
                  </div>

                  {/* Mode switcher: Powiąż z istniejącym vs Utwórz nowe zobowiązanie */}
                  <div className="flex rounded-lg bg-indigo-100/70 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDebtActionType('link')}
                      className={`flex-1 py-1 px-2 rounded-md transition-all ${
                        debtActionType === 'link'
                          ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                          : 'text-indigo-700 hover:text-indigo-900'
                      }`}
                    >
                      Powiąż z istniejącym ({matchingDebts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDebtActionType('create_new');
                        setDebtId('');
                      }}
                      className={`flex-1 py-1 px-2 rounded-md transition-all ${
                        debtActionType === 'create_new'
                          ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                          : 'text-indigo-700 hover:text-indigo-900'
                      }`}
                    >
                      + Utwórz nowe w sekcji Zadłużenia
                    </button>
                  </div>

                  {debtActionType === 'link' ? (
                    matchingDebts.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-700">
                            {type === 'expense' ? 'Wybierz zobowiązanie do spłaty:' : 'Wybierz pożyczkę do rozliczenia (zwrot od dłużnika):'}
                          </label>
                          {debtId && (
                            <button
                              type="button"
                              onClick={() => setDebtId('')}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
                            >
                              Odłącz
                            </button>
                          )}
                        </div>
                        <select
                          value={debtId}
                          onChange={(e) => {
                            const dId = e.target.value;
                            setDebtId(dId);
                            if (dId) {
                              const targetDebt = debts.find((d) => d.id === dId);
                              if (targetDebt) {
                                if (!title) {
                                  setTitle(type === 'expense' ? `Spłata: ${targetDebt.name}` : `Zwrot pożyczki: ${targetDebt.name}`);
                                }
                                let amountToUse = amount;
                                if (!amount) {
                                  if (targetDebt.monthlyPayment && targetDebt.monthlyPayment <= targetDebt.currentRemaining) {
                                    amountToUse = String(targetDebt.monthlyPayment);
                                    setAmount(amountToUse);
                                  } else if (targetDebt.currentRemaining) {
                                    amountToUse = targetDebt.currentRemaining.toFixed(2);
                                    setAmount(amountToUse);
                                  }
                                }
                                const parsedAmt = parseFloat(amountToUse.replace(',', '.')) || 0;
                                if (isInterestBearingDebt(targetDebt) && parsedAmt > 0) {
                                  const split = calculateSuggestedLoanSplit({
                                    debt: targetDebt,
                                    paymentAmount: parsedAmt,
                                    paymentDate: date || new Date().toISOString().split('T')[0],
                                    paymentType: 'regular',
                                  });
                                  setDebtPrincipal(split.suggestedPrincipal.toFixed(2));
                                  setDebtInterest(split.suggestedInterest.toFixed(2));
                                } else {
                                  setDebtPrincipal(amountToUse);
                                  setDebtInterest('0.00');
                                }
                              }
                            } else {
                              setDebtPrincipal('');
                              setDebtInterest('');
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-indigo-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Wybierz pozycję (lub brak powiązania) --</option>
                          {matchingDebts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.type === 'borrowed' ? '🏦 Kredyt / Zobowiązanie' : '🤝 Udzielona pożyczka'}: {d.name} ({d.counterparty}) — {d.type === 'borrowed' ? 'do spłaty' : 'do odzyskania'}: {d.currentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                            </option>
                          ))}
                        </select>
                        {debtId && (() => {
                          const targetDebt = debts.find((d) => d.id === debtId);
                          const parsedNum = parseFloat(amount.replace(',', '.')) || 0;
                          const isOver = targetDebt && targetDebt.currentRemaining > 0 && parsedNum > targetDebt.currentRemaining + 0.009;
                          const hasInterest = targetDebt && isInterestBearingDebt(targetDebt);

                          const splitSuggestion = targetDebt && hasInterest
                            ? calculateSuggestedLoanSplit({
                                debt: targetDebt,
                                paymentAmount: parsedNum,
                                paymentDate: date || new Date().toISOString().split('T')[0],
                                paymentType: debtPaymentType,
                              })
                            : null;

                          const currentPrincipal = debtPrincipal !== ''
                            ? (parseFloat(debtPrincipal.replace(',', '.')) || 0)
                            : (splitSuggestion ? splitSuggestion.suggestedPrincipal : parsedNum);
                          const currentInterest = debtInterest !== ''
                            ? (parseFloat(debtInterest.replace(',', '.')) || 0)
                            : (splitSuggestion ? splitSuggestion.suggestedInterest : 0);

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
                                    onClick={() => {
                                      setAmount(targetDebt.currentRemaining.toFixed(2));
                                      if (hasInterest) {
                                        const split = calculateSuggestedLoanSplit({
                                          debt: targetDebt,
                                          paymentAmount: targetDebt.currentRemaining,
                                          paymentDate: date || new Date().toISOString().split('T')[0],
                                          paymentType: 'regular',
                                        });
                                        setDebtPrincipal(split.suggestedPrincipal.toFixed(2));
                                        setDebtInterest(split.suggestedInterest.toFixed(2));
                                      }
                                    }}
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

                                  {/* Wybór typu spłaty: Rata vs Nadpłata */}
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    <span className="text-[10px] font-bold text-slate-600">Typ spłaty:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDebtPaymentType('regular');
                                        setDebtPrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                                        setDebtInterest(splitSuggestion.suggestedInterest.toFixed(2));
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        debtPaymentType === 'regular'
                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      🏦 Rata miesięczna
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDebtPaymentType('overpayment');
                                        setDebtPrincipal(parsedNum.toFixed(2));
                                        setDebtInterest('0.00');
                                        if (!title || title.toLowerCase().includes('rata') || title === 'Wydatek: Zobowiązania i pożyczki') {
                                          setTitle(`Nadpłata kredytu: ${targetDebt.name}`);
                                        }
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        debtPaymentType === 'overpayment'
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      🚀 Nadpłata kapitału
                                    </button>
                                  </div>

                                  <p className="text-[11px] text-slate-600 leading-snug">
                                    {splitSuggestion.explanation}
                                  </p>

                                  <div className="flex flex-wrap gap-1 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDebtPrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                                        setDebtInterest(splitSuggestion.suggestedInterest.toFixed(2));
                                      }}
                                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      Sugestia bankowa ({splitSuggestion.suggestedPrincipal.toFixed(2)} zł / {splitSuggestion.suggestedInterest.toFixed(2)} zł)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDebtPrincipal(parsedNum.toFixed(2));
                                        setDebtInterest('0.00');
                                      }}
                                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                    >
                                      100% kapitał
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDebtPrincipal('0.00');
                                        setDebtInterest(parsedNum.toFixed(2));
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
                                        value={debtPrincipal}
                                        onChange={(e) => {
                                          const p = e.target.value;
                                          setDebtPrincipal(p);
                                          const pNum = parseFloat(p) || 0;
                                          setDebtInterest(Math.max(0, Math.round((parsedNum - pNum) * 100) / 100).toFixed(2));
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
                                        value={debtInterest}
                                        onChange={(e) => {
                                          const i = e.target.value;
                                          setDebtInterest(i);
                                          const iNum = parseFloat(i) || 0;
                                          setDebtPrincipal(Math.max(0, Math.round((parsedNum - iNum) * 100) / 100).toFixed(2));
                                        }}
                                        className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                                      />
                                    </div>
                                  </div>

                                  {/* Dynamiczny podgląd na żywo pozostałego salda */}
                                  {parsedNum > 0 && (
                                    <DebtRepaymentLivePreview
                                      debt={targetDebt}
                                      totalPayment={parsedNum}
                                      principalPayment={currentPrincipal}
                                      interestPayment={currentInterest}
                                      paymentType={debtPaymentType}
                                      currency="zł"
                                      className="mt-2"
                                    />
                                  )}
                                </div>
                              )}

                              {!hasInterest && parsedNum > 0 && targetDebt && (
                                <DebtRepaymentLivePreview
                                  debt={targetDebt}
                                  totalPayment={parsedNum}
                                  principalPayment={parsedNum}
                                  interestPayment={0}
                                  paymentType="regular"
                                  currency="zł"
                                  className="mt-2"
                                />
                              )}

                              <p className="text-[10px] text-indigo-800 font-medium">
                                {type === 'expense'
                                  ? (hasInterest
                                      ? '💡 Spłata kapitału pomniejszy saldo kredytu. Część odsetkowa zostanie zarejestrowana jako koszt obsługi długu.'
                                      : '💡 Zapisanie wydatku automatycznie pomniejszy saldo Twojego zadłużenia wobec wierzyciela i doda wpis w historii spłat.')
                                  : '💡 Zapisanie wpływu automatycznie pomniejszy kwotę do zwrotu od dłużnika i doda wpis w historii spłat.'}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <p className="font-semibold">
                          Brak aktywnych pozycji ({type === 'expense' ? 'zobowiązań/kredytów do spłaty' : 'pożyczek udzielonych innym do odzyskania'}).
                        </p>
                        <p className="text-[11px] text-amber-800">
                          Możesz przełączyć na zakładkę <strong>„+ Utwórz nowe”</strong> powyżej, aby dodać nową pozycję w sekcji Zadłużenia.
                        </p>
                      </div>
                    )
                  ) : (
                    /* Create New Debt Sub-form in QuickAdd */
                    <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2.5">
                      <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          {type === 'income'
                            ? 'Parametry nowego zobowiązania (Wierzyciel / Kredytodawca):'
                            : 'Parametry nowej pożyczki (Dłużnik / Komu pożyczasz):'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            {type === 'income' ? 'Wierzyciel / Bank / Osoba od której pożyczasz *' : 'Dłużnik / Osoba której pożyczasz *'}
                          </label>
                          <input
                            type="text"
                            placeholder={type === 'income' ? 'np. PKO BP, Santander, Tomek' : 'np. Marek, Kasia, Znajomy'}
                            value={newDebtCounterparty}
                            onChange={(e) => setNewDebtCounterparty(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Kategoria długu
                          </label>
                          <select
                            value={newDebtCategory}
                            onChange={(e) => setNewDebtCategory(e.target.value as DebtCategory)}
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
                            value={newDebtDueDate}
                            onChange={(e) => setNewDebtDueDate(e.target.value)}
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
                            value={newDebtMonthlyPayment}
                            onChange={(e) => setNewDebtMonthlyPayment(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Notatka / Opis zobowiązania (opcjonalnie)
                        </label>
                        <input
                          type="text"
                          placeholder="np. Pożyczka na naprawę samochodu"
                          value={newDebtNotes}
                          onChange={(e) => setNewDebtNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <p className="text-[10px] text-emerald-800 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        {type === 'income'
                          ? `✨ Rejestrujesz wpływ (np. kredyt/pożyczka). W sekcji Zadłużenia utworzy się zobowiązanie wobec wierzyciela ze stanem do spłaty: ${amount || '0.00'} PLN.`
                          : `✨ Rejestrujesz wydatek (pożyczasz komuś). W sekcji Zadłużenia utworzy się należność od dłużnika ze stanem do zwrotu: ${amount || '0.00'} PLN.`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Szybkie wpisy (często wybierane w ostatnich 30 dniach) */}
            <div>
              <button
                type="button"
                onClick={() => setShowQuickEntries(!showQuickEntries)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/80 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Szybkie wpisy</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickEntries ? 'rotate-180' : ''}`} />
              </button>

              {showQuickEntries && (
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 animate-in fade-in">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Często wybierane ({type === 'expense' ? 'wydatki' : 'wpływy'})
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {dynamicTransactionSuggestions.map((sug, idx) => (
                      <button
                        key={`${sug.title}-${idx}`}
                        type="button"
                        onClick={() => handleApplyTxSuggestion(sug)}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer ${
                          sug.isFrequent
                            ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 hover:bg-indigo-100 hover:border-indigo-400 font-bold'
                            : 'border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-900'
                        }`}
                        title={`${sug.title} • Kategoria: ${sug.category}`}
                      >
                        <span>{sug.emoji}</span>
                        <span className="truncate">{sug.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden submit trigger for Enter and header save */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        )}

        {/* TAB 2: SHOPPING ITEMS FORM */}
        {activeTabMode === 'shopping' && (
          <form ref={formShopRef} onSubmit={handleSubmitShopping} className="p-5 overflow-y-auto space-y-4 flex-1">
            {shoppingSuccessBadge && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{shoppingSuccessBadge}</span>
              </div>
            )}

            {/* Product Name Input */}
            <div>
              <label htmlFor="quick-add-shopping-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Co chcesz kupić? (Nazwa produktu)
              </label>
              <div className="relative">
                <input
                  ref={shoppingNameInputRef}
                  id="quick-add-shopping-name"
                  type="text"
                  value={shoppingItemName}
                  onChange={(e) => {
                    setShoppingItemName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="np. Mleko, Chleb żytni, Cukier..."
                  className="w-full text-sm sm:text-base font-bold px-4 py-3 rounded-2xl border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/20 text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Category / Target List Selector */}
            <div>
              <label htmlFor="quick-add-shopping-category" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Kategoria / Lista zakupów
              </label>
              <div className="relative">
                <select
                  id="quick-add-shopping-category"
                  value={shoppingCategory}
                  onChange={(e) => setShoppingCategory(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none cursor-pointer pr-8"
                >
                  {availableShoppingOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Szybkie produkty (często wybierane w ostatnich 30 dniach) */}
            <div>
              <button
                type="button"
                onClick={() => setShowQuickProducts(!showQuickProducts)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 text-xs font-bold transition-all border border-emerald-200/80 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Szybkie produkty</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickProducts ? 'rotate-180' : ''}`} />
              </button>

              {showQuickProducts && (
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 animate-in fade-in">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Często wybierane
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {dynamicShoppingSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyShoppingSuggestion(sug)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer ${
                          sug.isFrequent
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 font-bold'
                            : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-900'
                        }`}
                        title={`${sug.name} • Kategoria: ${sug.category}`}
                      >
                        <span>{sug.emoji}</span>
                        <span className="truncate">{sug.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keep Open Toggle */}
            <div className="pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-600 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepShoppingOpen}
                  onChange={(e) => setKeepShoppingOpen(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Pozostaw okno otwarte po dodaniu</span>
              </label>
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Zamknij
              </button>
              <button
                type="submit"
                id="quick-add-shopping-submit-btn"
                className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Dodaj do listy zakupów</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
