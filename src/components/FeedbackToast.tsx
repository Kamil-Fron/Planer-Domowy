import React, { useEffect } from 'react';
import { CheckCircle2, ArrowDownRight, ArrowUpRight, ShoppingCart, Undo2, X } from 'lucide-react';
import { TransactionType } from '../types';

export interface ToastData {
  id: string;
  title: string;
  amount?: number;
  type?: TransactionType | 'shopping';
  subtitle?: string;
  onUndo?: () => void;
}

interface FeedbackToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const FeedbackToast: React.FC<FeedbackToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isShopping = toast.type === 'shopping';

  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-auto">
      <div className="flex items-center space-x-3 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/60 backdrop-blur-md max-w-sm sm:max-w-md">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
          isShopping
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : toast.type === 'expense'
            ? 'bg-rose-500/20 text-rose-400'
            : 'bg-emerald-500/20 text-emerald-400'
        }`}>
          {isShopping ? (
            <ShoppingCart className="w-4 h-4" />
          ) : toast.type === 'expense' ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : (
            <ArrowUpRight className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-white truncate">{toast.title}</span>
          </div>
          {toast.subtitle ? (
            <p className="text-[11px] text-slate-300 truncate">{toast.subtitle}</p>
          ) : toast.amount !== undefined ? (
            <p className="text-[11px] text-slate-300">
              Zapisano: <strong className={toast.type === 'expense' ? 'text-rose-300' : 'text-emerald-300'}>
                {toast.type === 'expense' ? '-' : '+'}{toast.amount.toFixed(2)} PLN
              </strong>
            </p>
          ) : null}
        </div>

        {toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo?.();
              onClose();
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700 active:scale-95"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Cofnij</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Zamknij"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
