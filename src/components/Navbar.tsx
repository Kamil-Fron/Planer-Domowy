import React, { useState, useMemo } from 'react';
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
  LogOut,
  Sparkles,
  Info,
  Landmark,
  Settings,
  Shield,
  Smartphone,
  BellRing,
  ExternalLink,
  Scale,
} from 'lucide-react';
import { Bill, BudgetLimit, TabType, Transaction, Household, UserProfile, AppNotification } from '../types';
import { generateAutomatedNotifications, sendBrowserPushNotification } from '../utils/notifications';
import { getAvailableMonthOptions } from '../utils/rollover';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  sendTestPushNotification,
  scheduleTestPushNotification,
  getExistingPushSubscription,
  isRunningInIframe,
  isAppleDevice,
  isStandalonePWA,
} from '../utils/pushManager';

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
  onOpenSettings?: (tab?: 'activity' | 'sync' | 'safety' | 'version' | 'danger') => void;
  onOpenDeleteDataModal?: () => void;
  onOpenDataSafetyModal?: () => void;
  onOpenQuickAdd?: () => void;
  onOpenVersionInfo?: () => void;
  onClearNotifications?: () => void;
  onMarkNotificationRead?: (id: string) => void;
  onLogout?: () => void;
  onOpenMobileLauncher?: () => void;
  onShowNotificationBanner?: (notification: AppNotification) => void;
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
  onOpenSettings,
  onOpenDeleteDataModal,
  onOpenDataSafetyModal,
  onOpenQuickAdd,
  onOpenVersionInfo,
  onClearNotifications,
  onMarkNotificationRead,
  onLogout,
  onOpenMobileLauncher,
  onShowNotificationBanner,
  onNavigate,
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'unread' | 'history'>('unread');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('app_read_notification_ids') || '[]');
    } catch {
      return [];
    }
  });

  // Połącz powiadomienia o aktywnościach z automatycznymi alertami (rachunki, limity)
  const allNotifications = useMemo(() => {
    return generateAutomatedNotifications(bills, transactions, budgetLimits, notifications);
  }, [bills, transactions, budgetLimits, notifications]);

  // Powiadomienia nieprzeczytane - po odczytaniu/kliknięciu natychmiast znikają z tej listy
  const unreadNotifications = useMemo(() => {
    return allNotifications.filter(
      (n) => !dismissedIds.includes(n.id) && !readIds.includes(n.id) && !n.read
    );
  }, [allNotifications, dismissedIds, readIds]);

  // Historia powiadomień odczytanych
  const historyNotifications = useMemo(() => {
    return allNotifications.filter(
      (n) => !dismissedIds.includes(n.id) && (readIds.includes(n.id) || n.read)
    );
  }, [allNotifications, dismissedIds, readIds]);

  const unreadCount = unreadNotifications.length;

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [testPushMsg, setTestPushMsg] = useState<string | null>(null);
  const [pushErrorMsg, setPushErrorMsg] = useState<string | null>(null);
  const [scheduledDelayCountdown, setScheduledDelayCountdown] = useState<number | null>(null);
  const [isBackgroundGuideOpen, setIsBackgroundGuideOpen] = useState(false);

  const handleEnablePush = async () => {
    setIsSubscribingPush(true);
    setPushErrorMsg(null);
    try {
      const { subscription, error } = await subscribeToPushNotifications({
        householdId: household?.id || 'default',
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'Domownik',
      });
      setPushPermission(getNotificationPermission());
      if (subscription) {
        setPushErrorMsg(null);
        setTestPushMsg('Włączono! ✅');
        setTimeout(() => setTestPushMsg(null), 4000);
      } else if (error) {
        setPushErrorMsg(error);
      }
    } catch (e: any) {
      setPushErrorMsg(e?.message || 'Nie udało się włączyć powiadomień.');
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushMsg('Wysyłanie testu...');
    setPushErrorMsg(null);

    // 1. ZAWSZE natychmiast wywołaj baner w aplikacji, by użytkownik od razu widział działanie powiadomień
    if (onShowNotificationBanner) {
      onShowNotificationBanner({
        id: `test-${Date.now()}`,
        title: '🔔 Test powiadomień w aplikacji',
        message: 'System powiadomień działa! Baner wizualny oraz alerty w aplikacji są w pełni aktywne.',
        type: 'activity',
        date: new Date().toISOString(),
        read: false,
      });
    }

    // 2. Wywołaj lokalne powiadomienie przeglądarki / Service Workera + wibrację
    sendBrowserPushNotification('🔔 Test powiadomień w telefonie', {
      body: 'Powiadomienia przeglądarkowe i wibracja działają prawidłowo!',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    }).catch(() => {});

    try {
      // 3. Sprawdź lub uzyskaj subskrypcję push dla urządzenia
      let currentSub: PushSubscription | null = await getExistingPushSubscription();

      if (!currentSub && isPushSupported() && !isRunningInIframe()) {
        const { subscription, error } = await subscribeToPushNotifications({
          householdId: household?.id || 'default',
          userId: currentUser?.id || 'user',
          userName: currentUser?.name || 'Domownik',
        });
        if (subscription) {
          currentSub = subscription;
          setPushPermission('granted');
        } else if (error) {
          console.warn('Ostrzeżenie przy próbie automatycznej subskrypcji push:', error);
        }
      }

      // 4. Wyślij rzeczywisty push w tle przez backend do zarejestrowanych urządzeń
      const result = await sendTestPushNotification({
        subscription: currentSub,
        householdId: household?.id,
        userId: currentUser?.id,
        extraSubscriptions: household?.pushSubscriptions,
      });

      if (result.success) {
        setTestPushMsg(`Wysłano (${result.sentCount || 1} urządz.) 📲`);
        setPushErrorMsg(null);
      } else {
        if (isRunningInIframe()) {
          setTestPushMsg('Baner działa! 🔔');
          setPushErrorMsg('W oknie podglądu wyświetlono baner. Aby przetestować push przy zablokowanym telefonie, otwórz aplikację w nowej karcie.');
        } else {
          setTestPushMsg('Baner działa! 🔔');
          setPushErrorMsg(result.error || 'Powiadomienie na ekranie działa! Włącz powiadomienia w telefonie dla odbioru w tle.');
        }
      }
      setTimeout(() => setTestPushMsg(null), 4500);
    } catch (err: any) {
      setTestPushMsg('Baner działa! 🔔');
      setPushErrorMsg(err?.message || 'Błąd wysyłki sieciowej');
      setTimeout(() => setTestPushMsg(null), 4500);
    }
  };

  const handleScheduleDelayedTestPush = async () => {
    setPushErrorMsg(null);
    try {
      let currentSub = await getExistingPushSubscription();
      if (!currentSub && isPushSupported() && !isRunningInIframe()) {
        const { subscription } = await subscribeToPushNotifications({
          householdId: household?.id || 'default',
          userId: currentUser?.id || 'user',
          userName: currentUser?.name || 'Domownik',
        });
        if (subscription) {
          currentSub = subscription;
          setPushPermission('granted');
        }
      }

      let remaining = 10;
      setScheduledDelayCountdown(remaining);
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timer);
          setScheduledDelayCountdown(null);
        } else {
          setScheduledDelayCountdown(remaining);
        }
      }, 1000);

      const res = await scheduleTestPushNotification({
        subscription: currentSub,
        householdId: household?.id,
        userId: currentUser?.id,
        extraSubscriptions: household?.pushSubscriptions,
        delaySeconds: 10,
        title: '📲 Test w tle: Sukces!',
        body: 'Powiadomienie dotarło przy wygaszonym ekranie / wyłączonej aplikacji! 🔔',
      });

      clearInterval(timer);
      setScheduledDelayCountdown(null);

      if (res.success) {
        setTestPushMsg('Wysłano w tle! 🔔');
        setTimeout(() => setTestPushMsg(null), 5000);
      } else {
        setPushErrorMsg(res.error || 'Nie udało się zaplanować testu w tle.');
      }
    } catch (err: any) {
      setScheduledDelayCountdown(null);
      setPushErrorMsg(err?.message || 'Błąd planowania testu push');
    }
  };

  const markNotificationAsRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('app_read_notification_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (onMarkNotificationRead) {
      onMarkNotificationRead(id);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    // Natychmiast oznacz jako przeczytane, dzięki czemu znika z listy nieprzeczytanych
    markNotificationAsRead(notif.id);
    setIsActionMenuOpen(false);

    if (onNavigate) {
      if (notif.type === 'item_bought') {
        onNavigate('shopping', { shoppingTab: 'completed', shoppingCategory: notif.relatedId });
      } else if (notif.targetTab === 'transactions' || notif.type === 'transaction_added') {
        onNavigate('transactions', {
          selectedTxId: notif.relatedId,
          transactionFilter: 'all',
        });
      } else if (notif.targetTab === 'bills' || notif.type === 'bill_due' || notif.type === 'bill_overdue') {
        onNavigate('bills', { payBillId: notif.relatedId });
      } else if (notif.targetTab === 'shopping' || notif.type === 'shopping_added') {
        onNavigate('shopping', { shoppingCategory: notif.relatedId });
      } else if (notif.targetTab === 'limits' || notif.type === 'budget_warning' || notif.type === 'budget_exceeded') {
        const cat =
          notif.relatedId ||
          (notif.id.startsWith('budget-exceeded-')
            ? notif.id.replace(/^budget-exceeded-/, '').replace(/-\d{4}-\d{2}$/, '')
            : notif.id.startsWith('budget-warning-')
            ? notif.id.replace(/^budget-warning-/, '').replace(/-\d{4}-\d{2}$/, '')
            : undefined);
        onNavigate('limits', { limitCategory: cat });
      } else if (notif.relatedId?.startsWith('tx-')) {
        onNavigate('transactions', { selectedTxId: notif.relatedId, transactionFilter: 'all' });
      } else if (notif.relatedId?.startsWith('bill-')) {
        onNavigate('bills', { payBillId: notif.relatedId });
      } else if (notif.relatedId?.startsWith('shop-') || notif.relatedId?.startsWith('list-')) {
        onNavigate('shopping', { shoppingCategory: notif.relatedId });
      } else if (notif.targetTab) {
        onNavigate(notif.targetTab);
      } else {
        onNavigate('dashboard');
      }
    } else {
      if (notif.targetTab) {
        onTabChange(notif.targetTab);
      } else if (notif.type === 'bill_due' || notif.type === 'bill_overdue') {
        onTabChange('bills');
      } else if (notif.type === 'budget_warning' || notif.type === 'budget_exceeded') {
        onTabChange('limits');
      } else {
        onTabChange('dashboard');
      }
    }
  };

  const handleMarkAllRead = () => {
    const unreadIds = unreadNotifications.map((n) => n.id);
    setReadIds((prev) => {
      const updated = Array.from(new Set([...prev, ...unreadIds]));
      try {
        localStorage.setItem('app_read_notification_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    unreadIds.forEach((id) => {
      if (onMarkNotificationRead) {
        onMarkNotificationRead(id);
      }
    });
    if (onClearNotifications) {
      onClearNotifications();
    }
  };

  const handleClearHistory = () => {
    const historyIds = historyNotifications.map((n) => n.id);
    setDismissedIds((prev) => Array.from(new Set([...prev, ...historyIds])));
  };

  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: 'Pulpit', icon: Wallet },
    { id: 'scanner', label: 'Skaner AI', icon: Receipt, badge: 'AI' },
    { id: 'shopping', label: 'Listy Zakupów', icon: ShoppingCart },
    { id: 'bills', label: 'Rachunki Domowe', icon: Zap },
    { id: 'transactions', label: 'Transakcje', icon: ArrowLeftRight },
    { id: 'limits', label: 'Limity Budżetu', icon: Target },
    { id: 'debts', label: 'Zadłużenia', icon: Scale },
    { id: 'reports', label: 'Wykresy & Raporty', icon: BarChart3 },
  ];

  const monthOptions = useMemo(() => {
    return getAvailableMonthOptions(transactions);
  }, [transactions]);

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

            {/* Integrated Save & Sync Indicator / Action Button */}
            <button
              onClick={() => {
                if (onTriggerSync && household) {
                  onTriggerSync();
                } else if (onOpenDataSafetyModal) {
                  onOpenDataSafetyModal();
                }
              }}
              disabled={isSyncing || syncStatus === 'saving'}
              className={`group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold shrink-0 active:scale-95 disabled:opacity-75 ${
                syncStatus === 'synced'
                  ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 shadow-2xs'
                  : syncStatus === 'saving' || isSyncing
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-2xs'
                  : syncStatus === 'error'
                  ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold animate-pulse shadow-2xs'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 shadow-2xs'
              }`}
              title={
                syncStatus === 'synced'
                  ? `Zapisano w chmurze ${lastSyncedAt ? `(${lastSyncedAt.toLocaleTimeString('pl-PL')})` : ''} • Kliknij, aby natychmiast zsynchronizować`
                  : syncStatus === 'saving' || isSyncing
                  ? 'Trwa zapisywanie i synchronizacja z chmurą...'
                  : syncStatus === 'error'
                  ? 'Błąd zapisu! Kliknij, aby ponowić synchronizację'
                  : 'Tryb lokalny'
              }
            >
              {(syncStatus === 'saving' || isSyncing) ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                  <span className="hidden sm:inline">Zapisywanie...</span>
                </>
              ) : syncStatus === 'synced' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:rotate-180 transition-transform duration-300" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="hidden sm:inline">Zapisano</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">Błąd zapisu!</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="hidden sm:inline">Lokalnie</span>
                </>
              )}
            </button>

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
                            if (onOpenQuickAdd) {
                              onOpenQuickAdd();
                            } else {
                              onTabChange('transactions');
                            }
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors group"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform flex-shrink-0"></span>
                          <span className="text-xs font-medium truncate">Nowa wpłata</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            if (onOpenQuickAdd) {
                              onOpenQuickAdd();
                            } else {
                              onTabChange('transactions');
                            }
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

                    {/* 2. Powiadomienia (Tylko powiadomienia z przejściem do czynności) */}
                    <div className="p-3">
                      <div className="flex flex-col space-y-2 mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Bell className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Powiadomienia
                            </span>
                            {unreadCount > 0 && (
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded-full font-bold border border-rose-100">
                                {unreadCount} nowe
                              </span>
                            )}
                          </div>

                          {notificationTab === 'unread' && unreadNotifications.length > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors flex items-center space-x-1"
                              title="Oznacz wszystkie jako odczytane"
                            >
                              <Check className="w-3 h-3" />
                              <span>Odczytaj wszystkie</span>
                            </button>
                          )}
                          {notificationTab === 'history' && historyNotifications.length > 0 && (
                            <button
                              onClick={handleClearHistory}
                              className="text-[10px] text-slate-400 hover:text-rose-600 font-medium transition-colors"
                              title="Wyczyść całą historię"
                            >
                              Wyczyść historię
                            </button>
                          )}
                        </div>

                        {/* Zakładki: Nowe / Historia */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold w-full">
                          <button
                            onClick={() => setNotificationTab('unread')}
                            className={`flex-1 py-1 rounded-md transition-all text-center ${
                              notificationTab === 'unread'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Nieodczytane ({unreadNotifications.length})
                          </button>
                          <button
                            onClick={() => setNotificationTab('history')}
                            className={`flex-1 py-1 rounded-md transition-all text-center ${
                              notificationTab === 'history'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Historia ({historyNotifications.length})
                          </button>
                        </div>
                      </div>

                      {/* Status powiadomień w telefonie */}
                      <div className="px-3 pt-2">
                        {pushPermission === 'granted' ? (
                          <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-2 text-[11px]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-emerald-900 font-medium min-w-0">
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">Powiadomienia w telefonie: <strong className="text-emerald-700">Włączone</strong></span>
                              </div>
                            </div>

                            {/* Przyciski testowe: natychmiast oraz test w tle z opóźnieniem */}
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              <button
                                onClick={handleSendTestPush}
                                className="px-2 py-1.5 text-[10px] font-bold bg-white text-emerald-800 hover:bg-emerald-100/70 rounded-lg border border-emerald-300 transition-all shadow-2xs text-center cursor-pointer active:scale-95"
                                title="Wyślij próbne powiadomienie natychmiast"
                              >
                                {testPushMsg || 'Test teraz 📲'}
                              </button>
                              <button
                                onClick={handleScheduleDelayedTestPush}
                                disabled={scheduledDelayCountdown !== null}
                                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all shadow-2xs text-center cursor-pointer active:scale-95 ${
                                  scheduledDelayCountdown !== null
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-700'
                                }`}
                                title="Zaplanuj wysyłkę za 10 sekund — zablokuj telefon lub zamknij aplikację"
                              >
                                {scheduledDelayCountdown !== null
                                  ? `Za ${scheduledDelayCountdown}s... zablokuj ekran! ⏳`
                                  : 'Test w tle (za 10s) ⏳'}
                              </button>
                            </div>

                            {scheduledDelayCountdown !== null && (
                              <p className="text-[10px] text-amber-900 bg-amber-100/80 border border-amber-200 p-1.5 rounded-md font-medium leading-tight">
                                🔒 <strong>Odliczanie aktywne:</strong> Zablokuj teraz ekran telefonu lub zamknij aplikację. Za chwilę otrzymasz powiadomienie Web Push w tle!
                              </p>
                            )}

                            {pushErrorMsg && (
                              <p className="text-[10px] text-slate-700 bg-emerald-100/60 p-1 rounded font-medium">{pushErrorMsg}</p>
                            )}

                            {/* Przewodnik działania w tle */}
                            <div className="pt-1.5 border-t border-emerald-200/60">
                              <button
                                type="button"
                                onClick={() => setIsBackgroundGuideOpen((v) => !v)}
                                className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <span>{isBackgroundGuideOpen ? '▾ Ukryj wskazówki działania w tle' : '▸ Jak sprawić, by powiadomienia wyskakiwały zawsze?'}</span>
                              </button>

                              {isBackgroundGuideOpen && (
                                <div className="mt-2 p-2.5 bg-white/95 border border-emerald-200 rounded-lg text-[10px] text-slate-700 space-y-2.5 leading-relaxed shadow-xs">
                                  <div>
                                    <strong className="text-slate-900 block font-semibold">🤖 Android (aby powiadomienia budziły telefon i ekran):</strong>
                                    <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-600">
                                      <li>
                                        <strong>Wyłącz optymalizację baterii:</strong> Ustawienia telefonu → Aplikacje → Budżet Domowy (lub Chrome) → <em>Bateria</em> → zaznacz <strong>„Bez ograniczeń” (Nieograniczone)</strong>. Dzięki temu telefon nie uśpi powiadomień przy wygaszonym ekranie.
                                      </li>
                                      <li>
                                        <strong>Włącz na ekranie blokady:</strong> Ustawienia telefonu → Powiadomienia → <em>Powiadomienia na ekranie blokady</em> → wybierz <strong>„Pokaż zawartość”</strong>.
                                      </li>
                                      <li>
                                        <strong>Dla Xiaomi / Samsung / Motorola / Huawei:</strong> W szczegółach aplikacji włącz uprawnienie <strong>„Autostart”</strong> oraz upewnij się, że kategoria powiadomień nie jest ustawiona na „Ciche”.
                                      </li>
                                    </ol>
                                  </div>
                                  <div>
                                    <strong className="text-slate-900 block font-semibold">🍏 iPhone / iPad (iOS 16.4+):</strong>
                                    <ul className="list-disc list-inside space-y-0.5 mt-0.5 text-slate-600">
                                      <li>
                                        Musisz dodać aplikację do ekranu: w Safari kliknij ikonę <strong>Udostępnij</strong> → <strong>„Do ekranu początkowego”</strong>.
                                      </li>
                                      <li>
                                        Uruchom aplikację z ikony na pulpicie i w Ustawienia iOS → Powiadomienia upewnij się, że zaznaczony jest <strong>„Ekran blokady”</strong>.
                                      </li>
                                      <li>
                                        Wyłącz <em>Tryb niskiego zużycia energii</em> (żółta bateria), gdyż wstrzymuje on budzenie systemu przez Web Push.
                                      </li>
                                    </ul>
                                  </div>
                                  <div className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                                    <span>💡 Serwer monitoruje rachunki i budzi urządzenia domowników 24/7.</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : pushPermission === 'denied' ? (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Powiadomienia zablokowane</span>
                              </div>
                              <button
                                onClick={handleSendTestPush}
                                className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 rounded border border-amber-300 transition-colors"
                              >
                                {testPushMsg || 'Test w aplikacji 🔔'}
                              </button>
                            </div>
                            <p className="text-[10px] text-amber-800 leading-snug">
                              Przeglądarka zablokowała powiadomienia systemowe dla tej witryny. Kliknij ikonę kłódki/ustawień obok adresu URL, aby zezwolić na Powiadomienia.
                            </p>
                          </div>
                        ) : isRunningInIframe() ? (
                          <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-[11px] space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-1.5 text-indigo-950 font-bold">
                                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <span>Powiadomienia w telefonie</span>
                              </div>
                              <button
                                onClick={handleSendTestPush}
                                className="px-2 py-0.5 text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 shadow-2xs"
                              >
                                {testPushMsg || 'Testuj teraz 🔔'}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-snug">
                              W oknie podglądu możesz przetestować baner powiadomień. Aby włączyć powiadomienia push w tle na smartfonie, otwórz aplikację w nowej karcie:
                            </p>
                            {pushErrorMsg && (
                              <p className="text-[10px] text-indigo-900 bg-white/70 p-1.5 rounded font-medium">{pushErrorMsg}</p>
                            )}
                            <a
                              href={typeof window !== 'undefined' ? window.location.href : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1.5 shadow-2xs text-center"
                            >
                              <span>Otwórz w nowej karcie (do rejestracji push)</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : isAppleDevice() && !isStandalonePWA() ? (
                          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[11px] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start space-x-1.5 text-sky-950 font-bold">
                                <Smartphone className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                                <span>Powiadomienia na iPhone (iOS)</span>
                              </div>
                              <button
                                onClick={handleSendTestPush}
                                className="px-2 py-0.5 text-[10px] font-bold bg-white text-sky-700 hover:bg-sky-100 rounded border border-sky-300 shadow-2xs"
                              >
                                {testPushMsg || 'Testuj 🔔'}
                              </button>
                            </div>
                            <p className="text-[10px] text-sky-800 leading-snug">
                              Na iOS powiadomienia push wymagają dodania do ekranu głównego: kliknij przycisk <strong>Udostępnij</strong> (kwadrat ze strzałką) → <strong>Dodaj do ekranu początkowego</strong>, a potem otwórz aplikację z ikony.
                            </p>
                          </div>
                        ) : isPushSupported() ? (
                          <div className="p-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/90 rounded-xl text-[11px] space-y-1.5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2 min-w-0">
                                <BellRing className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="font-bold text-indigo-950 leading-tight">Powiadomienia w telefonie</p>
                                  <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                                    Alerty o zakupach i rachunkach — nawet przy wyłączonej aplikacji.
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={handleSendTestPush}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 shadow-2xs shrink-0 ml-1"
                              >
                                {testPushMsg || 'Test 🔔'}
                              </button>
                            </div>
                            {pushErrorMsg && (
                              <p className="text-[10px] text-rose-600 font-semibold">{pushErrorMsg}</p>
                            )}
                            <button
                              onClick={handleEnablePush}
                              disabled={isSubscribingPush}
                              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 shadow-2xs disabled:opacity-60 cursor-pointer"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>{isSubscribingPush ? 'Włączanie...' : 'Włącz powiadomienia w telefonie'}</span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="max-h-64 sm:max-h-80 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                        {notificationTab === 'unread' && unreadNotifications.length === 0 ? (
                          <div className="py-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-1 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="font-semibold text-slate-700">Brak nowych powiadomień</span>
                            <span className="text-[10px] text-slate-400">Wszystkie powiadomienia zostały odczytane.</span>
                            {historyNotifications.length > 0 && (
                              <button
                                onClick={() => setNotificationTab('history')}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline mt-1"
                              >
                                Zobacz historię ({historyNotifications.length})
                              </button>
                            )}
                          </div>
                        ) : notificationTab === 'history' && historyNotifications.length === 0 ? (
                          <div className="py-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-1 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                            <Bell className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-500">Brak powiadomień w historii</span>
                          </div>
                        ) : (
                          (notificationTab === 'unread' ? unreadNotifications : historyNotifications).map((notif) => {
                            const isBudgetExceeded = notif.type === 'budget_exceeded';
                            const isBudgetWarning = notif.type === 'budget_warning';
                            const isBudgetAlert = isBudgetExceeded || isBudgetWarning;

                            if (isBudgetAlert) {
                              return (
                                <div
                                  key={notif.id}
                                  onClick={() => handleNotificationClick(notif)}
                                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer group hover:scale-[1.01] active:scale-[0.99] ${
                                    isBudgetExceeded
                                      ? 'bg-rose-50 border-rose-300 hover:bg-rose-100/90'
                                      : 'bg-amber-50 border-amber-300 hover:bg-amber-100/90'
                                  }`}
                                  title="Kliknij, aby przejść do limitu"
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                        isBudgetExceeded ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                                      }`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </div>
                                    <p
                                      className={`text-xs font-bold truncate ${
                                        isBudgetExceeded ? 'text-rose-950' : 'text-amber-950'
                                      }`}
                                    >
                                      {notif.title}
                                    </p>
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isBudgetExceeded
                                          ? 'bg-rose-200/90 text-rose-900'
                                          : 'bg-amber-200/90 text-amber-900'
                                      }`}
                                    >
                                      {notif.message}
                                    </span>
                                    {notificationTab === 'unread' ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markNotificationAsRead(notif.id);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-white/90 transition-colors"
                                        title="Oznacz jako odczytane (usuń z listy)"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <span className="text-[9px] text-slate-400">Odczytane</span>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-3 rounded-xl border transition-all flex items-start space-x-2.5 cursor-pointer group hover:scale-[1.01] active:scale-[0.99] ${
                                  notificationTab === 'unread'
                                    ? 'bg-emerald-50/70 border-emerald-200/90 hover:bg-emerald-100/70 hover:border-emerald-300 shadow-2xs'
                                    : 'bg-white border-slate-100 opacity-80 hover:opacity-100 hover:bg-slate-50 hover:border-slate-200'
                                }`}
                              >
                                <div className="mt-0.5 flex-shrink-0">
                                  {notif.type === 'item_bought' ? (
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center ring-1 ring-emerald-300">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </div>
                                  ) : notif.type === 'bill_overdue' ? (
                                    <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                  ) : notif.type === 'item_restored' ? (
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                      <Bell className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="min-w-0">
                                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                        {notificationTab === 'unread' ? (
                                          <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded-full shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                            <span>Nowe</span>
                                          </span>
                                        ) : null}
                                        <p className="text-xs font-bold leading-tight text-slate-900 truncate group-hover:text-emerald-800">
                                          {notif.title}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                      <span className="text-[9px] text-slate-400 whitespace-nowrap mt-0.5">
                                        {formatNotifTime(notif.date)}
                                      </span>
                                      {notificationTab === 'unread' ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            markNotificationAsRead(notif.id);
                                          }}
                                          className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors ml-0.5"
                                          title="Oznacz jako odczytane (usuń z listy)"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                                    {notif.message}
                                  </p>
                                  {notif.authorName && (
                                    <div className="mt-1 pt-1 border-t border-slate-200/40">
                                      <span className="inline-block text-[9px] font-semibold text-slate-700 bg-white/80 px-1.5 py-0.2 rounded-md border border-slate-200">
                                        👤 {notif.authorName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 3. Konto, Gospodarstwo & Profil */}
                    <div className="p-2 space-y-1">
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

                      {/* Direct Logout Button in Dropdown */}
                      {currentUser?.isLoggedIn && onLogout && (
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full text-left p-2 px-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center space-x-2.5"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <span>Wyloguj się z konta</span>
                        </button>
                      )}
                    </div>

                    {/* Opcja trybu prywatności / szybkiego startu na telefonach */}
                    {onOpenMobileLauncher && (
                      <div className="p-2 border-t border-slate-100 sm:hidden">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onOpenMobileLauncher();
                          }}
                          className="w-full text-left p-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 transition-all flex items-center justify-between border border-emerald-100 bg-emerald-50/40"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-none">Tryb prywatności</p>
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5">Szybki start & ukryte saldo</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                            Włącz
                          </span>
                        </button>
                      </div>
                    )}

                    {/* 4. Sekcja Ustawień (Aktywność, Synchronizacja, Bezpieczeństwo, Wersja) */}
                    {onOpenSettings && (
                      <div className="p-2 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onOpenSettings('activity');
                          }}
                          className="w-full text-left p-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-white hover:text-indigo-600 transition-all flex items-center justify-between border border-transparent hover:border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                              <Settings className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-none">Ustawienia & Aktywność</p>
                              <p className="text-[10px] text-slate-400 font-normal mt-0.5">Logi, sync, kopie zapasowe, wersja</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Otwórz
                          </span>
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
                    onTabChange('debts');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold ${
                    activeTab === 'debts' || activeTab === 'mortgage' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Scale className="w-4 h-4 text-indigo-600" />
                  <span>Zadłużenia & Pożyczki</span>
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
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      onOpenSettings('activity');
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-2 font-semibold text-slate-800 hover:bg-indigo-50 border-t border-slate-100"
                  >
                    <Settings className="w-4 h-4 text-indigo-600" />
                    <span>Ustawienia & Aktywność</span>
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
