import React, { useState, useEffect, useRef } from 'react';
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
  Undo2,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES } from '../mockData';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onOpenScanner: () => void;
  onSuccessFeedback?: (title: string, amount: number, type: TransactionType, onUndo?: () => void) => void;
}

interface SmartSuggestion {
  label: string;
  category: string;
  type: TransactionType;
  icon: React.ComponentType<{ className?: string }>;
}

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

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  onOpenScanner,
  onSuccessFeedback,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Jedzenie i artykuły spożywcze');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus amount on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setType('expense');
      setAmount('');
      setTitle('');
      setCategory('Jedzenie i artykuły spożywcze');
      setDate(new Date().toISOString().split('T')[0]);
      setComment('');

      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Update default category when switching type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'expense') {
      setCategory('Jedzenie i artykuły spożywcze');
    } else {
      setCategory('Wypłata z etatu');
    }
  };

  const handleApplySuggestion = (sug: SmartSuggestion) => {
    setTitle(sug.label);
    setCategory(sug.category);
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

  const handleSubmit = (e: React.FormEvent) => {
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

    if (onSuccessFeedback) {
      onSuccessFeedback(finalTitle, cleanAmount, type);
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentCategories = type === 'expense' ? INITIAL_CATEGORIES : INITIAL_INCOME_CATEGORIES;
  const currentSuggestions = type === 'expense' ? EXPENSE_SUGGESTIONS : INCOME_SUGGESTIONS;

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 id="quick-add-title" className="text-base font-bold text-slate-900 tracking-tight">
                Szybkie Dodawanie
              </h2>
              <p className="text-xs text-slate-500">Zapisz transakcję w 3 sekundy</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-800 text-xs"
              >
                ✕
              </button>
            </div>
          )}

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
              <span className="absolute right-4 font-bold text-sm text-slate-400 select-none">
                PLN
              </span>
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 mr-1 select-none">Szybko:</span>
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleApplyAmount(amt)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition-colors active:scale-95"
                >
                  +{amt} zł
                </button>
              ))}
            </div>
          </div>

          {/* Quick Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Popularne szablony (1 klik)
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentSuggestions.map((sug) => {
                const Icon = sug.icon;
                const isSelected = title === sug.label;
                return (
                  <button
                    key={sug.label}
                    type="button"
                    onClick={() => handleApplySuggestion(sug)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs scale-98'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <span>{sug.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label htmlFor="quick-add-title-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Tytuł lub opis
            </label>
            <input
              id="quick-add-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'expense' ? 'np. Obiad w restauracji, Paliwo, Zakupy' : 'np. Wypłata za sierpień, Premia'}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Category & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-add-category" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Kategoria
              </label>
              <div className="relative">
                <select
                  id="quick-add-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  {currentCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="quick-add-date" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Data
              </label>
              <div className="relative flex items-center">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="quick-add-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                />
              </div>
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
      </div>
    </div>
  );
};
