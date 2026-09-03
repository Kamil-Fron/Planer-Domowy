import React, { useState } from 'react';
import {
  Wallet,
  Receipt,
  ShoppingCart,
  Zap,
  ArrowLeftRight,
  Target,
  BarChart3,
  Bell,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
  Home,
  Trash2,
  ChevronDown,
  User,
  Camera,
  Activity,
  Check,
  Cloud,
  ShieldCheck,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { Bill, BudgetLimit, TabType, Transaction, Household, UserProfile, AppNotification } from '../types';
import { generateAutomatedNotifications } from '../utils/notifications';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  bills?: Bill[];
  budgetLimits?: BudgetLimit[];
  transactions?: Transaction[];
  notifications?: AppNotification[];
  household?: Household | null;
  currentUser?: UserProfile;
  syncStatus?: 'synced' | 'saving' | 'error' | 'offline';
  lastSyncedAt?: Date | null;
  onTriggerSync?: () => Promise<void> | void;
  isSyncing?: boolean;
  onOpenHouseholdModal: () => void;
  onOpenDeleteDataModal?: () => void;
  onOpenDataSafetyModal?: () => void;
  onClearNotifications?: () => void;
  onMarkNotificationRead?: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  selectedMonth,
  onMonthChange,
  bills = [],
  budgetLimits = [],
  transactions = [],
  notifications = [],
  household = null,
  currentUser,
  syncStatus = 'synced',
  lastSyncedAt = null,
  onTriggerSync,
  isSyncing = false,
  onOpenHouseholdModal,
  onOpenDeleteDataModal,
  onOpenDataSafetyModal,
  onClearNotifications,
  onMarkNotificationRead,
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Połącz powiadomienia o aktywnościach z automatycznymi alertami (rachunki, limity)
  const allNotifications = generateAutomatedNotifications(bills, transactions, budgetLimits, notifications);
  const activeNotifications = allNotifications.filter((n) => !dismissedIds.includes(n.id));
  const unreadCount = activeNotifications.filter((n) => !n.read).length;

  const handleClearAll = () => {
    setDismissedIds(allNotifications.map((n) => n.id));
    if (onClearNotifications) {
      onClearNotifications();
    }
  };

  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: 'Pulpit', icon: Wallet },
    { id: 'scanner', label: 'Skaner AI', icon: Receipt, badge: 'AI' },
    { id: 'shopping', label: 'Listy Zakupów', icon: ShoppingCart },
    { id: 'bills', label: 'Rachunki Domowe', icon: Zap },
    { id: 'transactions', label: 'Transakcje', icon: ArrowLeftRight },
    { id: 'limits', label: 'Limity Budżetu', icon: Target },
    { id: 'reports', label: 'Wykresy & Raporty', icon: BarChart3 },
  ];

  const monthOptions = [
    { value: '2026-09', label: 'Wrzesień 2026' },
    { value: '2026-08', label: 'Sierpień 2026' },
    { value: '2026-07', label: 'Lipiec 2026' },
    { value: '2026-06', label: 'Czerwiec 2026' },
  ];

  // Mobile main bottom tabs
  const mobileMainTabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Pulpit', icon: Wallet },
    { id: 'scanner', label: 'Skaner AI', icon: Receipt },
    { id: 'shopping', label: 'Zakupy', icon: ShoppingCart },
    { id: 'bills', label: 'Rachunki', icon: Zap },
    { id: 'transactions', label: 'Transakcje', icon: ArrowLeftRight },
  ];

  const formatNotifTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Przed chwilą';
      if (diffMins < 60) return `${diffMins} min temu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} godz. temu`;
      return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Logo & Brand (Bez ikonki AI, aby nie zabierać miejsca) */}
            <div
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none group flex-shrink-0"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition-colors flex-shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
                Planer Budżetu
              </span>
            </div>

            {/* Center Month Selector */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 text-xs transition-colors flex-shrink min-w-0">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer text-xs truncate"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync Pill Indicator */}
            {onOpenDataSafetyModal && (
              <button
                onClick={onOpenDataSafetyModal}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold shrink-0 active:scale-95 ${
                  syncStatus === 'synced'
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100/90 shadow-2xs'
                    : syncStatus === 'saving'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-2xs'
                    : syncStatus === 'error'
                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold animate-pulse shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 shadow-2xs'
                }`}
                title={
                  syncStatus === 'synced'
                    ? `Zapisano w chmurze ${lastSyncedAt ? `(${lastSyncedAt.toLocaleTimeString('pl-PL')})` : ''} - kliknij po kopię zapasową`
                    : syncStatus === 'saving'
                    ? 'Trwa zapisywanie do bazy Firestore...'
                    : syncStatus === 'error'
                    ? 'Błąd zapisu do chmury! Kliknij, aby naprawić lub pobrać kopię zapasową'
                    : 'Tryb lokalny'
                }
              >
                {syncStatus === 'synced' && (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="hidden md:inline">Zapisano</span>
                  </>
                )}
                {syncStatus === 'saving' && (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                    <span className="hidden md:inline">Zapisywanie...</span>
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="hidden sm:inline">Błąd zapisu!</span>
                  </>
                )}
                {syncStatus === 'offline' && (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden md:inline">Lokalnie</span>
                  </>
                )}
              </button>
            )}

            {/* Direct Instant Synchronize Button */}
            {onTriggerSync && household && (
              <button
                onClick={onTriggerSync}
                disabled={isSyncing || syncStatus === 'saving'}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 active:scale-95 text-indigo-700 transition-all text-xs font-semibold shrink-0 shadow-2xs disabled:opacity-50"
                title="Wymuś synchronizację w czasie rzeczywistym (pobierz najnowsze dane z chmury i wyślij lokalne)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 shrink-0 ${isSyncing || syncStatus === 'saving' ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing || syncStatus === 'saving' ? 'Synchronizuję...' : 'Synchronizuj'}</span>
              </button>
            )}

            {/* Right Action Menu: Single Consolidated Button */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                className={`relative flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all active:scale-95 text-xs font-semibold ${
                  isActionMenuOpen
                    ? 'border-indigo-500 bg-indigo-50/90 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                }`}
                title="Menu główne, dodawanie, powiadomienia i konto"
              >
                {currentUser?.isLoggedIn ? (
                  currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-indigo-200"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 text-[11px] font-bold">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )
                ) : (
                  <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}

                <span className="hidden sm:inline font-semibold text-slate-800 max-w-[110px] truncate">
                  {currentUser?.isLoggedIn ? (household ? household.name : currentUser.name) : 'Opcje & Menu'}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    isActionMenuOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />

                {/* Badge powiadomień na przycisku głównym */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white shadow-xs animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Jednolity Dropdown zawierający: Szybkie dodawanie, Powiadomienia o aktywnościach, Profil/Logowanie, Usuwanie */}
              {isActionMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/5 sm:bg-transparent"
                    onClick={() => setIsActionMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-92 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 max-h-[85vh] overflow-y-auto">
                    
                    {/* 1. Szybkie Akcje / Dodawanie (+) */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Szybkie Dodawanie
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTabChange('transactions');
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors group"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                          <span className="text-xs font-medium truncate">Nowa wpłata</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTabChange('transactions');
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left bg-slate-50 hover:bg-rose-50 hover:text-rose-800 text-slate-700 transition-colors group"
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                          <span className="text-xs font-medium truncate">Nowy wydatek</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTabChange('bills');
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left bg-slate-50 hover:bg-indigo-50 hover:text-indigo-800 text-slate-700 transition-colors group"
                        >
                          <span className="w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                          <span className="text-xs font-medium truncate">Rachunek</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTabChange('shopping');
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-700 transition-colors group"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                          <span className="text-xs font-medium truncate">Do koszyka</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTabChange('scanner');
                          }}
                          className="col-span-2 flex items-center justify-center space-x-1.5 p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors font-medium text-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Zeskanuj paragon ze zdjęciem</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Powiadomienia & Aktywności Domowników */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Bell className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Powiadomienia & Aktywności
                          </span>
                          {unreadCount > 0 && (
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded-full font-bold border border-rose-100">
                              {unreadCount} nowe
                            </span>
                          )}
                        </div>
                        {activeNotifications.length > 0 && (
                          <button
                            onClick={handleClearAll}
                            className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            Wyczyść
                          </button>
                        )}
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                        {activeNotifications.length === 0 ? (
                          <div className="py-3 text-center text-slate-400 text-xs flex items-center justify-center space-x-1.5 bg-slate-50/50 rounded-xl">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span>Brak nowych powiadomień i aktywności.</span>
                          </div>
                        ) : (
                          activeNotifications.slice(0, 8).map((notif) => {
                            const isActivity = notif.type === 'activity';
                            return (
                              <div
                                key={notif.id}
                                onClick={() => onMarkNotificationRead && onMarkNotificationRead(notif.id)}
                                className={`p-2.5 rounded-xl border transition-colors flex items-start space-x-2.5 cursor-pointer ${
                                  notif.read
                                    ? 'bg-white border-slate-100 opacity-75 hover:bg-slate-50'
                                    : 'bg-indigo-50/30 border-indigo-100/60 hover:bg-indigo-50/60'
                                }`}
                              >
                                <div className="mt-0.5 flex-shrink-0">
                                  {notif.type === 'bill_overdue' || notif.type === 'budget_exceeded' ? (
                                    <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                  ) : isActivity ? (
                                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                      <Activity className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                                      <Bell className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">
                                      {notif.title}
                                    </p>
                                    <span className="text-[9px] text-slate-400 whitespace-nowrap flex-shrink-0">
                                      {formatNotifTime(notif.date)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  {notif.authorName && (
                                    <span className="inline-block mt-1 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md">
                                      👤 {notif.authorName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 3. Konto, Gospodarstwo & PWA */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onOpenHouseholdModal();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50/70 transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {household ? household.name : 'Gospodarstwo domowe'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {currentUser?.isLoggedIn ? currentUser.email || currentUser.name : 'Zaloguj się / Domownicy'}
                            </p>
                          </div>
                        </div>
                        {currentUser?.isLoggedIn ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 ml-2" />
                        ) : (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex-shrink-0 ml-2">
                            Zaloguj
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Synchronizacja z chmurą */}
                    {onTriggerSync && (
                      <div className="p-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onTriggerSync();
                          }}
                          disabled={isSyncing || syncStatus === 'saving'}
                          className="w-full text-left p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-800 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <RefreshCw className={`w-4 h-4 text-indigo-600 shrink-0 ${isSyncing || syncStatus === 'saving' ? 'animate-spin' : ''}`} />
                            <span className="truncate">Zsynchronizuj teraz z chmurą</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {lastSyncedAt ? lastSyncedAt.toLocaleTimeString('pl-PL') : ''}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Centrum Bezpieczeństwa & Kopie Zapasowe */}
                    {onOpenDataSafetyModal && (
                      <div className="p-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onOpenDataSafetyModal();
                          }}
                          className="w-full text-left p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-800 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="truncate">Centrum Bezpieczeństwa & Kopie</span>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              syncStatus === 'synced'
                                ? 'bg-emerald-500'
                                : syncStatus === 'saving'
                                ? 'bg-blue-500 animate-pulse'
                                : syncStatus === 'error'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* 4. Usuwanie Danych (Kosz) */}
                    {onOpenDeleteDataModal && (
                      <div className="p-2 bg-slate-50/50">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onOpenDeleteDataModal();
                          }}
                          className="w-full text-left p-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center space-x-2"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          <span>Usuń wybrane dane...</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs Bar (md:flex) */}
          <nav className="hidden md:flex items-center space-x-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-100">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
                        isActive ? 'bg-indigo-400 text-slate-900' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR (md:hidden) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg px-2 py-1.5 safe-area-pb">
        <div className="grid grid-cols-6 gap-1 max-w-md mx-auto">
          {mobileMainTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onTabChange(item.id);
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-indigo-600 font-bold bg-indigo-50/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {item.id === 'scanner' && (
                    <span className="absolute -top-1 -right-2 text-[8px] bg-indigo-600 text-white font-bold px-1 rounded-full">
                      AI
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More menu button for mobile (Limity, Raporty, Dom) */}
          <div className="relative">
            <button
              onClick={() => setShowMobileMoreMenu(!showMobileMoreMenu)}
              className={`w-full flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
                activeTab === 'limits' || activeTab === 'reports' || showMobileMoreMenu
                  ? 'text-indigo-600 font-bold bg-indigo-50/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MoreHorizontal className="w-5 h-5 stroke-2" />
              <span className="text-[10px] mt-0.5 tracking-tight">Więcej</span>
            </button>

            {/* Mobile More Popover */}
            {showMobileMoreMenu && (
              <div className="absolute bottom-14 right-0 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    onTabChange('limits');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold ${
                    activeTab === 'limits' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Limity Budżetu</span>
                </button>
                <button
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    onTabChange('reports');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold ${
                    activeTab === 'reports' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Wykresy & Raporty</span>
                </button>
                <button
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    onOpenHouseholdModal();
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold text-indigo-700 hover:bg-indigo-50 border-t border-slate-100"
                >
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>Dom & PWA Telefon</span>
                </button>
                {onOpenDeleteDataModal && (
                  <button
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      onOpenDeleteDataModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold text-rose-600 hover:bg-rose-50 border-t border-slate-100"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Usuń wybrane dane</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
