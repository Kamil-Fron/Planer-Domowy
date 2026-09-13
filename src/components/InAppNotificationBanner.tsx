import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, X, ArrowRight, Bell, Zap, Target, AlertTriangle, CheckCircle2, ShoppingBag } from 'lucide-react';
import { AppNotification, TabType } from '../types';

interface InAppNotificationBannerProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  onMarkRead?: (id: string) => void;
  onNavigate?: (
    tab: TabType,
    options?: {
      transactionFilter?: 'all' | 'income' | 'expense';
      transactionSearch?: string;
      selectedTxId?: string;
      payBillId?: string;
      shoppingCategory?: string;
      shoppingTab?: 'active' | 'completed';
      limitCategory?: string;
    }
  ) => void;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notification,
  onDismiss,
  onMarkRead,
  onNavigate,
}) => {
  useEffect(() => {
    if (!notification) return;

    // Haptic vibration on mobile if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([70, 40, 70]);
      } catch {
        // ignore
      }
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 6500);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const handleClick = () => {
    if (onMarkRead && notification.id) {
      onMarkRead(notification.id);
    }
    onDismiss();
    if (!onNavigate) return;

    if (notification.type === 'item_bought') {
      onNavigate('shopping', { shoppingTab: 'completed', shoppingCategory: notification.relatedId });
    } else if (notification.type === 'bill_due' || notification.type === 'bill_overdue') {
      onNavigate('bills', { payBillId: notification.relatedId });
    } else if (notification.type === 'budget_warning' || notification.type === 'budget_exceeded') {
      const cat =
        notification.relatedId ||
        (notification.id.startsWith('budget-exceeded-')
          ? notification.id.replace(/^budget-exceeded-/, '').replace(/-\d{4}-\d{2}$/, '')
          : notification.id.startsWith('budget-warning-')
          ? notification.id.replace(/^budget-warning-/, '').replace(/-\d{4}-\d{2}$/, '')
          : undefined);
      onNavigate('limits', { limitCategory: cat });
    } else if (notification.type === 'transaction_added' || notification.type === 'item_restored') {
      onNavigate('transactions', { selectedTxId: notification.relatedId });
    } else if (notification.type === 'shopping_added') {
      onNavigate('shopping', { shoppingCategory: notification.relatedId });
    } else if (notification.targetTab) {
      onNavigate(notification.targetTab);
    } else {
      // Fallback detection
      const text = `${notification.title} ${notification.message}`.toLowerCase();
      if (text.includes('rachun') || notification.relatedId?.startsWith('bill-')) {
        onNavigate('bills', { payBillId: notification.relatedId });
      } else if (text.includes('transakcj') || text.includes('wydatek') || text.includes('wpłat') || notification.relatedId?.startsWith('tx-')) {
        onNavigate('transactions', { selectedTxId: notification.relatedId });
      } else if (text.includes('zakup') || notification.relatedId?.startsWith('shop-')) {
        onNavigate('shopping');
      } else if (text.includes('limit') || notification.relatedId?.startsWith('limit-')) {
        onNavigate('limits');
      }
    }
  };

  const getIcon = () => {
    if (notification.type === 'item_bought') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0 ring-2 ring-emerald-200">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    if (notification.type === 'bill_due' || notification.type === 'bill_overdue') {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
          <Zap className="w-4 h-4" />
        </div>
      );
    }
    if (notification.type === 'budget_exceeded') {
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs flex-shrink-0 ring-2 ring-rose-200">
          <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
        </div>
      );
    }
    if (notification.type === 'budget_warning') {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs flex-shrink-0 ring-2 ring-amber-200">
          <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
        </div>
      );
    }
    if (notification.type === 'transaction_added' || notification.type === 'item_restored') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
        <Bell className="w-4 h-4" />
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        key={notification.id}
        initial={{ y: -80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -80, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        drag="y"
        dragConstraints={{ top: -100, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y < -30) {
            onDismiss();
          }
        }}
        className="fixed top-2 left-2 right-2 sm:left-auto sm:right-5 sm:top-4 sm:w-[400px] z-[9999] select-none"
      >
        <div
          onClick={handleClick}
          className={`backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border cursor-pointer transition-all active:scale-[0.98] group relative overflow-hidden ${
            notification.type === 'budget_exceeded'
              ? 'bg-rose-50/98 border-rose-300 ring-2 ring-rose-400/30'
              : notification.type === 'budget_warning'
              ? 'bg-amber-50/98 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white/95 border-slate-200/90 hover:border-indigo-200 hover:shadow-indigo-500/10'
          }`}
        >
          {/* Subtle top indicator */}
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden" />

          {/* App identity line */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5 px-0.5">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full inline-block animate-ping ${
                  notification.type === 'budget_exceeded'
                    ? 'bg-rose-600'
                    : notification.type === 'budget_warning'
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
              />
              <span
                className={`font-bold uppercase tracking-wider text-[10px] ${
                  notification.type === 'budget_exceeded'
                    ? 'text-rose-900'
                    : notification.type === 'budget_warning'
                    ? 'text-amber-900'
                    : 'text-slate-800'
                }`}
              >
                {notification.type === 'budget_exceeded'
                  ? 'Przekroczenie budżetu'
                  : notification.type === 'budget_warning'
                  ? 'Ostrzeżenie budżetowe'
                  : 'Planer Budżetu'}
              </span>
              <span>•</span>
              <span className="text-slate-500">Teraz</span>
            </div>
            <button
              onClick={(e) => {
                if (e && typeof e.stopPropagation === 'function') {
                  e.stopPropagation();
                }
                onDismiss();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors -mr-1 -mt-1"
              title="Zamknij"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notification Main Content */}
          <div className="flex items-start space-x-3 mt-1">
            {getIcon()}
            <div className="flex-1 min-w-0 pr-1">
              <h4
                className={`text-xs font-bold leading-tight ${
                  notification.type === 'budget_exceeded'
                    ? 'text-rose-950 font-black'
                    : notification.type === 'budget_warning'
                    ? 'text-amber-950 font-black'
                    : 'text-slate-900 group-hover:text-indigo-600 transition-colors'
                }`}
              >
                {notification.title}
              </h4>
              <p
                className={`text-xs mt-0.5 leading-snug ${
                  notification.type === 'budget_exceeded'
                    ? 'text-rose-950 font-semibold'
                    : notification.type === 'budget_warning'
                    ? 'text-amber-950 font-semibold'
                    : 'text-slate-600 line-clamp-2'
                }`}
              >
                {notification.message}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                {notification.authorName ? (
                  <span className="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">
                    👤 {notification.authorName}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={`font-bold flex items-center space-x-0.5 group-hover:translate-x-0.5 transition-transform ${
                    notification.type === 'budget_exceeded'
                      ? 'text-rose-700'
                      : notification.type === 'budget_warning'
                      ? 'text-amber-800'
                      : 'text-indigo-600'
                  }`}
                >
                  <span>Dotknij, aby zobaczyć limit</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
