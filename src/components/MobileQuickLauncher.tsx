import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart,
  PlusCircle,
  Camera,
  CalendarClock,
  Shield,
  ArrowRight,
  X,
  Lock,
  LayoutDashboard,
  CheckCircle2,
  Bell,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { TabType, AppNotification } from '../types';

interface MobileQuickLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType, options?: any) => void;
  onOpenQuickAdd: () => void;
  pendingShoppingCount: number;
  unpaidBillsCount: number;
  unreadNotificationsCount: number;
  userName?: string;
  householdName?: string;
}

const STORAGE_KEY_ENABLED = 'budget_mobile_quick_launcher_enabled';

export const MobileQuickLauncher: React.FC<MobileQuickLauncherProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenQuickAdd,
  pendingShoppingCount,
  unpaidBillsCount,
  unreadNotificationsCount,
  userName,
  householdName,
}) => {
  const [autoStartEnabled, setAutoStartEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleAutoStart = (checked: boolean) => {
    setAutoStartEnabled(checked);
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(checked));
    } catch {
      // ignore
    }
  };

  const handleAction = (actionType: 'shopping' | 'quick_add' | 'scanner' | 'bills' | 'dashboard') => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }

    onClose();

    if (actionType === 'shopping') {
      onNavigate('shopping');
    } else if (actionType === 'quick_add') {
      onOpenQuickAdd();
    } else if (actionType === 'scanner') {
      onNavigate('scanner');
    } else if (actionType === 'bills') {
      onNavigate('bills');
    } else if (actionType === 'dashboard') {
      onNavigate('dashboard');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="mobile-quick-launcher"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl text-white flex flex-col justify-between p-5 select-none overflow-y-auto sm:hidden"
      >
        {/* Top bar with Privacy Shield info & Close button */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-full shadow-sm">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300 flex items-center space-x-1">
              <span>Tryb prywatności</span>
              <span className="text-emerald-500">•</span>
              <span className="text-emerald-400/90 font-normal">Saldo ukryte</span>
            </span>
          </div>

          <button
            onClick={() => handleAction('dashboard')}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-slate-300 hover:text-white"
            title="Przejdź do aplikacji"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Welcome & Purpose */}
        <div className="my-auto py-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 shadow-xl shadow-indigo-500/20 mb-3 border border-white/20">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {userName ? `Cześć, ${userName}!` : 'Szybki Start'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              {householdName ? `${householdName} • ` : ''}Wybierz czynność bez ujawniania stanu konta i salda w miejscu publicznym.
            </p>
          </div>

          {/* 4 Primary Action Tiles Grid (2x2) */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* 1. Lista zakupów */}
            <button
              onClick={() => handleAction('shopping')}
              className="group relative p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-500/30 hover:border-emerald-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between h-36 shadow-lg shadow-emerald-950/40"
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                {pendingShoppingCount > 0 ? (
                  <span className="text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    {pendingShoppingCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-400/80">
                    Kupione
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Lista zakupów
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Odhacz w sklepie
                </p>
              </div>
            </button>

            {/* 2. Transakcja (Wpisz wydatek/wpłatę) */}
            <button
              onClick={() => handleAction('quick_add')}
              className="group relative p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-blue-500/5 border border-indigo-500/30 hover:border-indigo-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between h-36 shadow-lg shadow-indigo-950/40"
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                  + Szybko
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Transakcja
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Wpisz wydatek / wpływ
                </p>
              </div>
            </button>

            {/* 3. Skanuj paragon */}
            <button
              onClick={() => handleAction('scanner')}
              className="group relative p-4 rounded-2xl bg-gradient-to-br from-purple-500/15 to-violet-500/5 border border-purple-500/30 hover:border-purple-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between h-36 shadow-lg shadow-purple-950/40"
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/30 group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold bg-purple-400/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>OCR</span>
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  Skanuj paragon
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Zdjęcie i odczyt kwoty
                </p>
              </div>
            </button>

            {/* 4. Rachunek */}
            <button
              onClick={() => handleAction('bills')}
              className="group relative p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-500/30 hover:border-amber-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between h-36 shadow-lg shadow-amber-950/40"
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 group-hover:scale-105 transition-transform">
                  <CalendarClock className="w-5 h-5" />
                </div>
                {unpaidBillsCount > 0 ? (
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    {unpaidBillsCount} pilne
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-400/80 flex items-center space-x-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  Rachunek
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Opłaty i terminy
                </p>
              </div>
            </button>
          </div>

          {/* Optional unread notification prompt */}
          {unreadNotificationsCount > 0 && (
            <div className="mt-4 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>Masz <b>{unreadNotificationsCount}</b> nowe powiadomienie</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold">
                Sprawdź w menu →
              </span>
            </div>
          )}
        </div>

        {/* Bottom Section: Enter Full App & Toggle Setting */}
        <div className="pt-3 pb-2 space-y-3">
          <button
            onClick={() => handleAction('dashboard')}
            className="w-full py-3.5 px-4 rounded-2xl bg-white text-slate-900 font-bold text-sm shadow-xl hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-900" />
            <span>Przejdź do pełnej aplikacji</span>
            <ArrowRight className="w-4 h-4 text-slate-700 ml-1" />
          </button>

          {/* Toggle preference */}
          <div className="flex items-center justify-between px-2 pt-1">
            <label
              htmlFor="toggle-auto-launcher"
              className="flex items-center space-x-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>Pokazuj ten ekran przy uruchomieniu</span>
            </label>
            <input
              id="toggle-auto-launcher"
              type="checkbox"
              checked={autoStartEnabled}
              onChange={(e) => handleToggleAutoStart(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
