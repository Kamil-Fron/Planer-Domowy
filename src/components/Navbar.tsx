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
  LogIn,
  Trash2,
  ChevronDown,
  User,
  Sparkles,
  Camera,
} from 'lucide-react';
import { Bill, BudgetLimit, TabType, Transaction, Household, UserProfile } from '../types';
import { generateAutomatedNotifications } from '../utils/notifications';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  bills?: Bill[];
  budgetLimits?: BudgetLimit[];
  transactions?: Transaction[];
  household?: Household | null;
  currentUser?: UserProfile;
  onOpenHouseholdModal: () => void;
  onOpenDeleteDataModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  selectedMonth,
  onMonthChange,
  bills = [],
  budgetLimits = [],
  transactions = [],
  household = null,
  currentUser,
  onOpenHouseholdModal,
  onOpenDeleteDataModal,
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Automatically generate active notifications
  const allNotifications = generateAutomatedNotifications(bills, transactions, budgetLimits, []);
  const activeNotifications = allNotifications.filter((n) => !dismissedIds.includes(n.id));
  const unreadCount = activeNotifications.length;

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

                <span className="hidden sm:inline font-semibold text-slate-800 max-w-[100px] truncate">
                  {currentUser?.isLoggedIn ? (household ? household.name : currentUser.name) : 'Opcje & Menu'}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    isActionMenuOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />

                {/* Badge powiadomień na przycisku głównym */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Jednolity Dropdown zawierający: Szybkie dodawanie, Powiadomienia, Profil/Logowanie, Usuwanie */}
              {isActionMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/5 sm:bg-transparent"
                    onClick={() => setIsActionMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-76 sm:w-84 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 max-h-[85vh] overflow-y-auto">
                    
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

                    {/* 2. Powiadomienia & Alerty */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Bell className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Powiadomienia
                          </span>
                          {unreadCount > 0 && (
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded-full font-bold border border-rose-100">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        {activeNotifications.length > 0 && (
                          <button
                            onClick={() => setDismissedIds(allNotifications.map((n) => n.id))}
                            className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            Wyczyść
                          </button>
                        )}
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                        {activeNotifications.length === 0 ? (
                          <div className="py-2.5 text-center text-slate-400 text-xs flex items-center justify-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span>Brak zaległości, wszystko opłacone!</span>
                          </div>
                        ) : (
                          activeNotifications.slice(0, 3).map((notif) => (
                            <div
                              key={notif.id}
                              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors flex items-start space-x-2"
                            >
                              <div className="mt-0.5 flex-shrink-0">
                                {notif.type === 'bill_overdue' || notif.type === 'budget_exceeded' ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                ) : (
                                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-900 leading-tight truncate">
                                  {notif.title}
                                </p>
                                <p className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          ))
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
