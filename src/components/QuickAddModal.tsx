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
} from 'lucide-react';
import { Transaction, TransactionType, ShoppingItem, ShoppingList } from '../types';
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

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onAddShoppingItem?: (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  transactions?: Transaction[];
  shoppingLists?: ShoppingList[];
  shoppingItems?: ShoppingItem[];
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
  transactions = [],
  shoppingLists = [],
  shoppingItems = [],
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
  const [error, setError] = useState<string | null>(null);

  // Shopping form state (simplified: only title/description & category)
  const [shoppingItemName, setShoppingItemName] = useState<string>('');
  const [shoppingCategory, setShoppingCategory] = useState<string>('Spożywcze');
  const [keepShoppingOpen, setKeepShoppingOpen] = useState<boolean>(false);
  const [shoppingSuccessBadge, setShoppingSuccessBadge] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const shoppingNameInputRef = useRef<HTMLInputElement>(null);

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

    const finalTitle = title.trim() || (type === 'expense' ? `Wydatek: ${category}` : `Wpływ: ${category}`);

    const newTxData = {
      type,
      amount: cleanAmount,
      title: finalTitle,
      category,
      date: date || new Date().toISOString().split('T')[0],
      comment: comment.trim() || undefined,
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
          <button
            id="quick-add-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Zamknij (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
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
          <form onSubmit={handleSubmitTransaction} className="p-5 overflow-y-auto space-y-4 flex-1">
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

              {/* Quick Amount Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleApplyAmount(val)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
                  >
                    +{val} zł
                  </button>
                ))}
              </div>
            </div>

            {/* Description & Category (Title & Category) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Dynamic Smart Transaction Suggestions - now placed right after Title & Category */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Często wybierane w ostatnich 30 dniach ({type === 'expense' ? 'wydatki' : 'wpływy'})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  1-klik uzupełnia
                </span>
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

            {/* Date Picker */}
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

            {/* Optional Note */}
            <div>
              <label htmlFor="quick-add-comment" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Notatka (opcjonalnie)
              </label>
              <input
                id="quick-add-comment"
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="np. Płatność kartą, wspólny obiad..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Alternate action: Scan receipt with AI */}
            <div className="pt-1">
              <button
                type="button"
                id="quick-add-scanner-redirect"
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors border border-indigo-200/60 group"
              >
                <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Masz paragon lub zrzut Apple Pay? Zeskanuj ze zdjęciem (AI)</span>
              </button>
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Anuluj
              </button>
              <button
                type="submit"
                id="quick-add-submit-btn"
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl text-xs font-bold text-white shadow-md transition-all active:scale-98 ${
                  type === 'expense'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Zapisz transakcję</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SHOPPING ITEMS FORM */}
        {activeTabMode === 'shopping' && (
          <form onSubmit={handleSubmitShopping} className="p-5 overflow-y-auto space-y-4 flex-1">
            {shoppingSuccessBadge && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{shoppingSuccessBadge}</span>
              </div>
            )}

            {/* Product Name Input */}
            <div>
              <label htmlFor="quick-add-shopping-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Co chcesz kupić? (Nazwa & opis)
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
                  placeholder="np. Mleko 3.2% 2 kartony, Chleb żytni, Cukier 1kg..."
                  className="w-full text-sm sm:text-base font-bold px-4 py-3 rounded-2xl border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/20 text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Wszystkie detale (ilość, marka, gramatura) możesz wpisać bezpośrednio w tytule.
              </p>
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

            {/* Smart 1-Tap Grocery Suggestions based on 30-day frequency - placed right after Name & Category */}
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {dynamicShoppingSuggestions.some((s) => s.isFrequent)
                      ? 'Często wybierane w ostatnich 30 dniach'
                      : 'Popularne artykuły domowe'}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">1-klik wstawia</span>
              </span>
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

            {/* Keep Open Toggle */}
            <div className="pt-2">
              <label className="flex items-center space-x-2 text-xs text-slate-600 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepShoppingOpen}
                  onChange={(e) => setKeepShoppingOpen(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Pozostaw to okno otwarte po dodaniu (szybkie dodawanie wielu pozycji)</span>
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
