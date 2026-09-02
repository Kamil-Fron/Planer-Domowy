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
  Sparkles,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
  MoreHorizontal,
  Home,
  Users,
  Smartphone,
  LogIn,
} from 'lucide-react';
import { AppNotification, Bill, BudgetLimit, TabType, Transaction, Household, UserProfile } from '../types';
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
}) => {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
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
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Brand */}
            <div
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none group"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition-colors flex-shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight">Planer Budżetu</span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    AI
                  </span>
                </div>
              </div>
            </div>

            {/* Center Month Selector (Visible on mobile & desktop) */}
            <div className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 text-xs transition-colors">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer text-xs"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {/* Individual User / Household Status Button */}
              {currentUser?.isLoggedIn ? (
                <button
                  onClick={onOpenHouseholdModal}
                  className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold transition-colors"
                  title={`Zalogowano jako: ${currentUser.name} (${currentUser.email})`}
                >
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <Home className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate max-w-[110px]">
                    {household ? household.name : currentUser.name}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                </button>
              ) : (
                <button
                  onClick={onOpenHouseholdModal}
                  className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  title="Zaloguj się swoim kontem Google"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline sm:inline">Zaloguj</span>
                </button>
              )}

              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
                  title="Powiadomienia o rachunkach i limitach"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Popover */}
                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-sm text-slate-900">Powiadomienia</span>
                        {unreadCount > 0 && (
                          <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-semibold border border-rose-100">
                            {unreadCount} aktywne
                          </span>
                        )}
                      </div>
                      {activeNotifications.length > 0 && (
                        <button
                          onClick={() => setDismissedIds(allNotifications.map((n) => n.id))}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          Wyczyść
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {activeNotifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs px-4">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                          Brak pilnych powiadomień. Rachunki i limity są pod kontrolą!
                        </div>
                      ) : (
                        activeNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="p-3 hover:bg-slate-50 transition-colors flex items-start space-x-3"
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {notif.type === 'bill_overdue' || notif.type === 'budget_exceeded' ? (
                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                                  <Bell className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900">{notif.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Add Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
                  className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dodaj</span>
                </button>

                {showQuickAddMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setShowQuickAddMenu(false);
                        onTabChange('transactions');
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 font-medium"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Wpłata / Dochód</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAddMenu(false);
                        onTabChange('transactions');
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 font-medium"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Nowy wydatek</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAddMenu(false);
                        onTabChange('bills');
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 font-medium"
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span>Rachunek domowy</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAddMenu(false);
                        onTabChange('shopping');
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 font-medium border-t border-slate-100"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Pozycja na listę zakupów</span>
                    </button>
                  </div>
                )}
              </div>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
