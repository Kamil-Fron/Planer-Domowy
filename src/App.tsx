import React, { useState, useEffect, useRef } from 'react';
import {
  TabType,
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
  Household,
  UserProfile,
  AppNotification,
  MortgageLoan,
  DebtItem,
  ActivityLogEntry,
} from './types';
import {
  loadTransactions,
  saveTransactions,
  loadBills,
  saveBills,
  loadBudgetLimits,
  saveBudgetLimits,
  loadShoppingLists,
  saveShoppingLists,
  loadShoppingItems,
  saveShoppingItems,
  loadNotifications,
  saveNotifications,
  loadActivities,
  saveActivities,
  loadMortgages,
  saveMortgages,
  loadDebts,
  saveDebts,
  loadPushSetting,
  savePushSetting,
  loadHousehold,
  saveHousehold,
  loadUserProfile,
  saveUserProfile,
  saveBackupSnapshot,
  scanLocalStorageForLostData,
  clearAllBackupSnapshots,
} from './storage';
import {
  subscribeToFirebaseAuthState,
  subscribeToHouseholdFirestore,
  saveHouseholdToFirestore,
  isFirebaseConfigured,
  getUserProfileFromFirestore,
  saveUserProfileToFirestore,
  getHouseholdFromFirestore,
  findHouseholdByInviteCode,
  findHouseholdsByMemberEmail,
  logoutFromFirebase,
} from './firebase';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TransactionsManager } from './components/TransactionsManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ShoppingLists } from './components/ShoppingLists';
import { BillsManager } from './components/BillsManager';
import { BudgetLimits } from './components/BudgetLimits';
import { MortgageManager } from './components/MortgageManager';
import { DebtManager } from './components/DebtManager';
import { ReportsView } from './components/ReportsView';
import { HouseholdModal } from './components/HouseholdModal';
import { DeleteDataModal, DeleteSelection } from './components/DeleteDataModal';
import { DataSafetyModal } from './components/DataSafetyModal';
import { SettingsModal } from './components/SettingsModal';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { MobileQuickLauncher } from './components/MobileQuickLauncher';
import { LoginScreen } from './components/LoginScreen';
import { QuickAddModal } from './components/QuickAddModal';
import { QuickAddFAB } from './components/QuickAddFAB';
import { VersionInfoModal } from './components/VersionInfoModal';
import { AppFooter } from './components/AppFooter';
import { FeedbackToast, ToastData } from './components/FeedbackToast';
import { recordShoppingItemUsage, unrecordShoppingItemUsage } from './utils/frequentShoppingItems';
import { recordTransactionUsage } from './utils/frequentTransactions';
import {
  checkAndTriggerBillNotifications,
  createActivityNotification,
  sendBrowserPushNotification,
} from './utils/notifications';
import {
  sendPushNotificationToHousehold,
  subscribeToPushNotifications,
  isPushSupported,
} from './utils/pushManager';
import { calculatePreviousDueDate } from './utils/billCycle';
import { calculateSuggestedLoanSplit, isInterestBearingDebt } from './utils/loanCalculation';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');

  // Core Data States loaded from Storage
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(loadBudgetLimits);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>(loadShoppingLists);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(loadShoppingItems);
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const [mortgages, setMortgages] = useState<MortgageLoan[]>(loadMortgages);
  const [debts, setDebts] = useState<DebtItem[]>(loadDebts);
  const [pushEnabled, setPushEnabled] = useState<boolean>(loadPushSetting);

  // Household & Auth States
  const [household, setHousehold] = useState<Household | null>(loadHousehold);
  const [currentUser, setCurrentUser] = useState<UserProfile>(loadUserProfile);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isDataSafetyModalOpen, setIsDataSafetyModalOpen] = useState(false);
  const [householdModalTab, setHouseholdModalTab] = useState<'household' | 'firebase_config' | 'pwa' | 'delete_data'>('household');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'activity' | 'sync' | 'safety' | 'version' | 'danger'>('activity');
  const [activities, setActivities] = useState<ActivityLogEntry[]>(loadActivities);
  const [bannerNotification, setBannerNotification] = useState<AppNotification | null>(null);
  const [toastFeedback, setToastFeedback] = useState<ToastData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error' | 'offline'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date());
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Deep navigation states from Dashboard & Notifications
  const [navTxFilter, setNavTxFilter] = useState<'all' | 'expense' | 'income' | null>(null);
  const [navTxSearch, setNavTxSearch] = useState<string>('');
  const [navTxSelectedId, setNavTxSelectedId] = useState<string | null>(null);
  const [navPayBillId, setNavPayBillId] = useState<string | null>(null);
  const [navShoppingCategory, setNavShoppingCategory] = useState<string | null>(null);
  const [navShoppingTab, setNavShoppingTab] = useState<'active' | 'completed' | null>(null);
  const [navLimitCategory, setNavLimitCategory] = useState<string | null>(null);

  // Mobile Privacy & Quick-Start Launcher (Shields balance on mobile launch)
  const [isMobileLauncherOpen, setIsMobileLauncherOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return false;
    try {
      const enabled = localStorage.getItem('budget_mobile_quick_launcher_enabled');
      if (enabled === 'false') return false;
      const dismissed = sessionStorage.getItem('budget_mobile_launcher_dismissed');
      if (dismissed === 'true') return false;
    } catch {
      // ignore
    }
    return true;
  });

  const handleCloseMobileLauncher = () => {
    setIsMobileLauncherOpen(false);
    try {
      sessionStorage.setItem('budget_mobile_launcher_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleDashboardNavigate = (
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
  ) => {
    if (options?.transactionFilter) setNavTxFilter(options.transactionFilter);
    if (options?.transactionSearch !== undefined) setNavTxSearch(options.transactionSearch);
    if (options?.selectedTxId) setNavTxSelectedId(options.selectedTxId);
    if (options?.payBillId) setNavPayBillId(options.payBillId);
    if (options?.shoppingCategory) setNavShoppingCategory(options.shoppingCategory);
    if (options?.shoppingTab) setNavShoppingTab(options.shoppingTab);
    if (options?.limitCategory) setNavLimitCategory(options.limitCategory);
    setActiveTab(tab);
  };

  // Global Keyboard Shortcuts (UX): '+' or 'N' opens Quick Add anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '+' || e.key === '=' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsQuickAddOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ref to prevent echo update loops when Firestore snapshot triggers local state update
  const isIncomingFirestoreUpdate = useRef(false);
  const lastLocalMutationTime = useRef<number>(0);
  const hasUnsavedLocalChanges = useRef<boolean>(false);

  // Ref always pointing to freshest data
  const stateRef = useRef({
    transactions,
    bills,
    budgetLimits,
    shoppingLists,
    shoppingItems,
    notifications,
    mortgages,
    debts,
    household,
    currentUser,
  });

  useEffect(() => {
    stateRef.current = {
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
      notifications,
      mortgages,
      debts,
      household,
      currentUser,
    };
  });

  // Track known notification IDs to detect notifications created by other household members
  const knownNotificationIds = useRef<Set<string>>(new Set(notifications.map((n) => n.id)));
  const isInitialFirestoreLoad = useRef<boolean>(true);

  // Handle deep navigation from URL query parameters (e.g. when app is opened directly from background push on phone)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabType;
      const txIdParam = params.get('txId') || params.get('selectedTxId') || params.get('entityId');
      const billIdParam = params.get('billId');

      if (txIdParam) {
        setActiveTab('transactions');
        setNavTxSelectedId(txIdParam);
      } else if (tabParam) {
        setActiveTab(tabParam);
        if (billIdParam) setNavPayBillId(billIdParam);
      }
    } catch (e) {
      console.warn('Błąd odczytu parametrów URL:', e);
    }
  }, []);

  // Handle messages from Service Worker (when user clicks push notification while app window is open/focused)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION') {
        const targetTab = event.data.targetTab as TabType;
        const notifData = event.data.notificationData || {};
        const entityId = notifData.selectedTxId || notifData.entityId || notifData.relatedId;

        if (targetTab === 'transactions' || (entityId && entityId.startsWith('tx-'))) {
          setActiveTab('transactions');
          if (entityId) {
            setNavTxSelectedId(entityId);
          }
        } else if (targetTab === 'bills' || (entityId && entityId.startsWith('bill-'))) {
          setActiveTab('bills');
          if (entityId) {
            setNavPayBillId(entityId);
          }
        } else if (targetTab) {
          setActiveTab(targetTab);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  // Auto-subscribe device to push notifications if permission is already granted
  useEffect(() => {
    if (!currentUser?.isLoggedIn || !household?.id) return;
    if (typeof window === 'undefined' || !isPushSupported()) return;

    if (Notification.permission === 'granted') {
      subscribeToPushNotifications({
        householdId: household.id,
        userId: currentUser.id,
        userName: currentUser.name || 'Domownik',
      })
        .then(({ subscription }) => {
          if (subscription && household?.id) {
            const subJson = subscription.toJSON();
            if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
              setHousehold((prev) => {
                if (!prev) return null;
                const existingSubs = prev.pushSubscriptions || [];
                if (existingSubs.some((s) => s.endpoint === subJson.endpoint)) {
                  return prev;
                }
                const newSub = {
                  endpoint: subJson.endpoint,
                  keys: {
                    p256dh: subJson.keys.p256dh!,
                    auth: subJson.keys.auth!,
                  },
                  userId: currentUser.id,
                  userName: currentUser.name || 'Domownik',
                  device: navigator.userAgent.substring(0, 50),
                  updatedAt: new Date().toISOString(),
                };
                const updatedHousehold = {
                  ...prev,
                  pushSubscriptions: [...existingSubs, newSub],
                };
                if (isFirebaseConfigured() && prev.id) {
                  saveHouseholdToFirestore(prev.id, {
                    pushSubscriptions: updatedHousehold.pushSubscriptions,
                  }).catch(() => {});
                }
                return updatedHousehold;
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id, currentUser?.isLoggedIn, household?.id]);

  // Household Admin Permission Check
  const isHouseholdAdmin =
    !household ||
    !currentUser.isLoggedIn ||
    household.createdBy === currentUser.id ||
    household.members?.find((m) => m.id === currentUser.id)?.role === 'owner';

  // Comprehensive Activity & Notification Recording Handler
  const recordActivity = (options: {
    action: 'create' | 'update' | 'delete' | 'restore';
    entityType: 'transaction' | 'shopping_item' | 'bill' | 'budget_limit' | 'shopping_list' | 'debt' | 'household' | 'system';
    entityId: string;
    title: string;
    description: string;
    snapshot?: any;
    targetTab?: TabType;
  }) => {
    const author = currentUser?.name || 'Domownik';
    const authorId = currentUser?.id || '';
    const now = new Date().toISOString();

    const activityEntry: ActivityLogEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      relatedId: options.entityId,
      title: options.title,
      description: options.description,
      authorName: author,
      userName: author,
      timestamp: now,
      snapshot: options.snapshot,
      deletedPayload:
        options.action === 'delete' && options.snapshot
          ? {
              type: options.entityType as any,
              data: options.snapshot,
            }
          : undefined,
    };

    setActivities((prev) => {
      const updated = [activityEntry, ...prev.slice(0, 99)];
      saveActivities(updated);
      return updated;
    });

    // Powiadomienia:
    // 1. Kasowanie NIE trafia do powiadomień ("Nie dodawaj takich aktywności do powiadomień jak usuwanie").
    // 2. Co więcej, jeśli element zostaje usunięty, istniejące powiadomienie o nim znika ("Jak to zostaje usunięte to powiadomienie znika").
    if (options.action === 'delete') {
      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.relatedId !== options.entityId);
        saveNotifications(filtered);
        return filtered;
      });
      setBannerNotification((curr) => (curr?.relatedId === options.entityId ? null : curr));
      return;
    }

    // 3. Dodanie (create), przywrócenie (restore) lub kupienie artykułu (item_bought) trafia do powiadomień ORAZ wyskakuje w banerze.
    const isBoughtNotification =
      options.entityType === 'shopping_item' &&
      typeof options.title === 'string' &&
      options.title.startsWith('Kupiono');

    if (options.action === 'create' || options.action === 'restore' || isBoughtNotification) {
      let notifType: AppNotification['type'] = 'activity';
      if (options.action === 'restore') {
        notifType = 'item_restored';
      } else if (isBoughtNotification) {
        notifType = 'item_bought';
      } else if (options.entityType === 'transaction') {
        notifType = 'transaction_added';
      } else if (options.entityType === 'shopping_item') {
        notifType = 'shopping_added';
      } else if (options.entityType === 'bill') {
        notifType = 'bill_due';
      }

      const defaultTab: TabType =
        options.targetTab ||
        (options.entityType === 'transaction'
          ? 'transactions'
          : options.entityType === 'bill'
          ? 'bills'
          : options.entityType === 'shopping_item' || options.entityType === 'shopping_list'
          ? 'shopping'
          : options.entityType === 'budget_limit'
          ? 'limits'
          : options.entityType === 'debt'
          ? 'debts'
          : 'dashboard');

      const notif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: notifType,
        title: options.title,
        message: options.description,
        authorName: author,
        authorId: authorId,
        date: now,
        read: false,
        relatedId: options.entityId,
        targetTab: defaultTab,
      };

      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.relatedId !== options.entityId);
        const updated = [notif, ...filtered.slice(0, 49)];
        saveNotifications(updated);
        return updated;
      });

      // Wysyłamy powiadomienie PUSH w tle do urządzeń w gospodarstwie domowym (w tym własnego)
      if (household?.id) {
        sendPushNotificationToHousehold({
          householdId: household.id,
          senderUserId: authorId,
          senderUserName: author,
          title: options.title,
          body: options.description,
          targetTab: defaultTab,
          extraSubscriptions: household.pushSubscriptions,
          data: {
            entityId: options.entityId,
            selectedTxId: options.entityId,
            relatedId: options.entityId,
            targetTab: defaultTab,
            authorName: author,
          },
        }).catch((err) => {
          console.warn('Błąd wysyłki Web Push do domowników:', err);
        });
      }
    }
  };

  // Helper kompatybilności wstecznej
  const logActivity = (title: string, message: string, relatedId?: string) => {
    recordActivity({
      action: 'create',
      entityType: 'transaction',
      entityId: relatedId || `activity-${Date.now()}`,
      title,
      description: message,
    });
  };

  // Przywracanie usuniętego wpisu z logów aktywności
  const handleRestoreActivityItem = (entry: ActivityLogEntry) => {
    const payloadData = entry.snapshot || entry.deletedPayload?.data;
    if (!payloadData) {
      setToastFeedback({
        id: `toast-${Date.now()}`,
        title: 'Brak danych do przywrócenia tego wpisu',
        type: 'expense',
      });
      return;
    }

    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;

    // Mark activity entry as restored in state & storage
    setActivities((prev) => {
      const updated = prev.map((act) => (act.id === entry.id ? { ...act, restored: true } : act));
      saveActivities(updated);
      return updated;
    });

    if (entry.entityType === 'transaction') {
      const tx = payloadData as Transaction;
      setTransactions((prev) => {
        if (prev.some((t) => t.id === tx.id)) return prev;
        const updated = [tx, ...prev];
        saveTransactions(updated);
        return updated;
      });
      recordActivity({
        action: 'restore',
        entityType: 'transaction',
        entityId: tx.id,
        title: `Przywrócono transakcję: ${tx.title}`,
        description: `Kwota ${tx.amount.toFixed(2)} PLN (${tx.category})`,
        targetTab: 'transactions',
        snapshot: tx,
      });
    } else if (entry.entityType === 'bill') {
      const bill = payloadData as Bill;
      setBills((prev) => {
        if (prev.some((b) => b.id === bill.id)) return prev;
        const updated = [...prev, bill];
        saveBills(updated);
        return updated;
      });
      recordActivity({
        action: 'restore',
        entityType: 'bill',
        entityId: bill.id,
        title: `Przywrócono rachunek: ${bill.name}`,
        description: `Kwota ${bill.amount.toFixed(2)} PLN, termin: ${bill.dueDate}`,
        targetTab: 'bills',
        snapshot: bill,
      });
    } else if (entry.entityType === 'shopping_item') {
      const item = payloadData as ShoppingItem;
      setShoppingItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        const updated = [...prev, item];
        saveShoppingItems(updated);
        return updated;
      });
      recordActivity({
        action: 'restore',
        entityType: 'shopping_item',
        entityId: item.id,
        title: `Przywrócono artykuł: ${item.name}`,
        description: `${item.quantity} ${item.unit || 'szt.'} (${item.category})`,
        targetTab: 'shopping',
        snapshot: item,
      });
    } else if (entry.entityType === 'shopping_list') {
      const list = payloadData as ShoppingList;
      setShoppingLists((prev) => {
        if (prev.some((l) => l.id === list.id)) return prev;
        const updated = [...prev, list];
        saveShoppingLists(updated);
        return updated;
      });
      recordActivity({
        action: 'restore',
        entityType: 'shopping_list',
        entityId: list.id,
        title: `Przywrócono listę zakupów: ${list.name}`,
        description: `Kategoria: ${list.category}`,
        targetTab: 'shopping',
        snapshot: list,
      });
    } else if (entry.entityType === 'budget_limit') {
      const limit = payloadData as BudgetLimit;
      setBudgetLimits((prev) => {
        if (prev.some((l) => l.id === limit.id)) return prev;
        const updated = [...prev, limit];
        saveBudgetLimits(updated);
        return updated;
      });
      recordActivity({
        action: 'restore',
        entityType: 'budget_limit',
        entityId: limit.id,
        title: `Przywrócono limit: ${limit.category}`,
        description: `Miesięczny limit ${limit.monthlyLimit.toFixed(2)} PLN`,
        targetTab: 'limits',
        snapshot: limit,
      });
    } else if (entry.entityType === 'debt') {
      const debt = payloadData as DebtItem;
      setDebts((prev) => {
        if (prev.some((d) => d.id === debt.id)) return prev;
        const updated = [debt, ...prev];
        saveDebts(updated);
        return updated;
      });
      if (debt.isBankLoan) {
        setMortgages((prev) => {
          if (prev.some((m) => m.id === debt.id)) return prev;
          const restoredMortgage: MortgageLoan = {
            id: debt.id,
            name: debt.name,
            bankName: debt.bankName || debt.counterparty,
            totalLoanAmount: debt.initialAmount,
            remainingPrincipal: debt.currentRemaining,
            initialPaidPrincipal: debt.paidAmount,
            monthlyPayment: debt.monthlyPayment || 0,
            interestRate: debt.interestRate || 0,
            loanTermYears: debt.loanTermYears || 25,
            startDate: debt.startDate,
            paymentDayOfMonth: debt.paymentDayOfMonth || 10,
            rateType: debt.rateType || 'equal',
            paymentsHistory: [],
            createdAt: debt.createdAt || new Date().toISOString(),
          };
          const next = [restoredMortgage, ...prev];
          saveMortgages(next);
          return next;
        });
      }
      recordActivity({
        action: 'restore',
        entityType: 'debt',
        entityId: debt.id,
        title: `Przywrócono zobowiązanie: ${debt.name}`,
        description: `Kwota ${(debt.initialAmount || 0).toFixed(2)} PLN (${debt.type === 'borrowed' ? 'Do spłaty' : 'Do odzyskania'})`,
        targetTab: 'debts',
        snapshot: debt,
      });
    }

    setToastFeedback({
      id: `toast-${Date.now()}`,
      title: `Przywrócono wpis: ${entry.title}`,
      type: 'income',
    });
  };

  // Obsługa zatwierdzania i odrzucania próśb o dołączenie do gospodarstwa (Admin)
  const handleApproveJoinRequest = async (requestId: string) => {
    if (!household || !household.pendingRequests) return;
    const req = household.pendingRequests.find((r) => r.id === requestId);
    if (!req) return;

    const newMember = {
      id: req.userId || req.id,
      name: req.name,
      email: req.email,
      avatarUrl: req.avatarUrl,
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    };

    const updatedMembers = [...(household.members || []).filter((m) => m.id !== newMember.id), newMember];
    const updatedPending = household.pendingRequests.filter((r) => r.id !== requestId);

    const updatedHousehold: Household = {
      ...household,
      members: updatedMembers,
      pendingRequests: updatedPending,
    };

    setHousehold(updatedHousehold);
    saveHousehold(updatedHousehold);

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...updatedHousehold,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.warn('Błąd zatwierdzania prośby w Firestore:', err);
      }
    }

    recordActivity({
      action: 'update',
      entityType: 'household' as any,
      entityId: household.id,
      title: 'Zatwierdzono nowego domownika',
      description: `${req.name} (${req.email}) dołączył(a) do gospodarstwa`,
    });

    setToastFeedback({
      id: `toast-${Date.now()}`,
      title: `Zatwierdzono domownika: ${req.name}`,
      type: 'income',
    });
  };

  const handleRejectJoinRequest = async (requestId: string) => {
    if (!household || !household.pendingRequests) return;
    const req = household.pendingRequests.find((r) => r.id === requestId);
    if (!req) return;

    const updatedPending = household.pendingRequests.filter((r) => r.id !== requestId);
    const updatedHousehold: Household = {
      ...household,
      pendingRequests: updatedPending,
    };

    setHousehold(updatedHousehold);
    saveHousehold(updatedHousehold);

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...updatedHousehold,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.warn('Błąd odrzucania prośby w Firestore:', err);
      }
    }

    setToastFeedback({
      id: `toast-${Date.now()}`,
      title: `Odrzucono prośbę od: ${req.name}`,
      type: 'expense',
    });
  };

  // 1. Subscribe to Firebase Auth state on mount (ensures independent user isolation)
  useEffect(() => {
    const unsubAuth = subscribeToFirebaseAuthState(async (user) => {
      if (user) {
        setCurrentUser({
          ...user,
          isLoggedIn: true,
        });

        // Pobierz profil użytkownika z Firestore i załaduj jego aktywny dom
        if (isFirebaseConfigured()) {
          try {
            const profileData = await getUserProfileFromFirestore(user.id);
            let targetHouseholdId = profileData?.activeHouseholdId;

            // Jeśli profil nie ma aktywnego domu, sprawdź czy użytkownik nie został zaproszony przez email do istniejącego domu
            if (!targetHouseholdId && user.email) {
              const invitedHouseholds = await findHouseholdsByMemberEmail(user.email);
              if (invitedHouseholds.length > 0) {
                targetHouseholdId = invitedHouseholds[0].id;
                // Zaktualizuj activeHouseholdId w profilu
                await saveUserProfileToFirestore(user, targetHouseholdId);
              }
            }

            if (targetHouseholdId) {
              const cloudHousehold = await getHouseholdFromFirestore(targetHouseholdId);
              if (cloudHousehold) {
                // Zaktualizuj wpis członka o rzeczywiste dane zalogowanego użytkownika
                let updatedMembers = cloudHousehold.members || [];
                let memberChanged = false;
                const memberIndex = updatedMembers.findIndex(
                  (m) =>
                    m.id === user.id ||
                    (user.email && m.email && m.email.trim().toLowerCase() === user.email.trim().toLowerCase())
                );

                if (memberIndex >= 0) {
                  if (
                    updatedMembers[memberIndex].id !== user.id ||
                    updatedMembers[memberIndex].name !== user.name ||
                    updatedMembers[memberIndex].avatarUrl !== user.avatarUrl
                  ) {
                    updatedMembers[memberIndex] = {
                      ...updatedMembers[memberIndex],
                      id: user.id,
                      name: user.name || updatedMembers[memberIndex].name,
                      email: user.email || updatedMembers[memberIndex].email,
                      avatarUrl: user.avatarUrl || updatedMembers[memberIndex].avatarUrl,
                    };
                    memberChanged = true;
                  }
                }

                setHousehold({
                  id: cloudHousehold.id,
                  name: cloudHousehold.name,
                  inviteCode: cloudHousehold.inviteCode,
                  createdAt: cloudHousehold.createdAt,
                  createdBy: cloudHousehold.createdBy,
                  members: updatedMembers,
                  syncStatus: 'synced',
                  cloudProvider: 'firebase',
                });

                // Directly assign cloud data as source of truth for logged in account
                const cloudTxs = cloudHousehold.transactions || [];
                const cloudBills = cloudHousehold.bills || [];
                const cloudLimits = cloudHousehold.budgetLimits || [];
                const cloudLists = cloudHousehold.shoppingLists || [];
                const cloudItems = cloudHousehold.shoppingItems || [];
                const cloudNotifs = cloudHousehold.notifications || [];

                setTransactions(cloudTxs);
                saveTransactions(cloudTxs);

                setBills(cloudBills);
                saveBills(cloudBills);

                setBudgetLimits(cloudLimits);
                saveBudgetLimits(cloudLimits);

                setShoppingLists(cloudLists);
                saveShoppingLists(cloudLists);

                setShoppingItems(cloudItems);
                saveShoppingItems(cloudItems);

                setNotifications(cloudNotifs);
                saveNotifications(cloudNotifs);

                setSyncStatus('synced');
                setLastSyncedAt(new Date());
                hasUnsavedLocalChanges.current = false;

                if (memberChanged) {
                  await saveHouseholdToFirestore(cloudHousehold.id, {
                    ...cloudHousehold,
                    members: updatedMembers,
                  });
                }
              }
            } else {
              // Użytkownik nie ma jeszcze przypisanego żadnego domu - wyczyść stale dane z innego konta
              setHousehold(null);
              setTransactions([]);
              saveTransactions([]);
              setBills([]);
              saveBills([]);
              setBudgetLimits([]);
              saveBudgetLimits([]);
              setShoppingLists([]);
              saveShoppingLists([]);
              setShoppingItems([]);
              saveShoppingItems([]);
              setNotifications([]);
              saveNotifications([]);
              hasUnsavedLocalChanges.current = false;
            }
          } catch (e) {
            console.warn('Błąd pobierania powiązanego profilu/domu:', e);
          }
        }
      } else {
        setCurrentUser({
          id: '',
          name: 'Gość',
          email: '',
          isLoggedIn: false,
        });
        setHousehold(null);
        hasUnsavedLocalChanges.current = false;
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Real-time sync with Cloud Firestore when household is present
  useEffect(() => {
    if (!household?.id || !isFirebaseConfigured()) return;

    const unsubscribe = subscribeToHouseholdFirestore(
      household.id,
      (cloudData, hasPendingWrites) => {
        if (!cloudData) return;
        // Don't overwrite if the user is in the middle of active local typing/mutation
        if (hasUnsavedLocalChanges.current && hasPendingWrites) return;

        isIncomingFirestoreUpdate.current = true;
        hasUnsavedLocalChanges.current = false;

        const cloudTxs = cloudData.transactions || [];
        const cloudBills = cloudData.bills || [];
        const cloudLimits = cloudData.budgetLimits || [];
        const cloudLists = cloudData.shoppingLists || [];
        const cloudItems = cloudData.shoppingItems || [];
        const cloudNotifs = cloudData.notifications || [];
        const cloudMortgages = cloudData.mortgages;
        const cloudDebts = cloudData.debts;

        // Wykryj powiadomienia dodane przez INNYCH domowników podczas gdy aplikacja jest otwarta:
        if (!isInitialFirestoreLoad.current && cloudNotifs.length > 0) {
          const currentUserId = currentUser?.id;
          const currentUserName = currentUser?.name;
          const newFromOthers = cloudNotifs.filter(
            (n: AppNotification) =>
              !knownNotificationIds.current.has(n.id) &&
              !n.read &&
              ((n.authorId && currentUserId && n.authorId !== currentUserId) ||
                (n.authorName && currentUserName && n.authorName !== currentUserName))
          );

          if (newFromOthers.length > 0) {
            const latest = newFromOthers[0];
            setBannerNotification(latest);
            sendBrowserPushNotification(latest.title, {
              body: latest.message,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
            });
          }
        }

        cloudNotifs.forEach((n: AppNotification) => knownNotificationIds.current.add(n.id));
        isInitialFirestoreLoad.current = false;

        setTransactions(cloudTxs);
        saveTransactions(cloudTxs);

        setBills(cloudBills);
        saveBills(cloudBills);

        setBudgetLimits(cloudLimits);
        saveBudgetLimits(cloudLimits);

        setShoppingLists(cloudLists);
        saveShoppingLists(cloudLists);

        setShoppingItems(cloudItems);
        saveShoppingItems(cloudItems);

        setNotifications(cloudNotifs);
        saveNotifications(cloudNotifs);

        if (cloudMortgages && Array.isArray(cloudMortgages)) {
          setMortgages(cloudMortgages);
          saveMortgages(cloudMortgages);
        }

        if (cloudDebts && Array.isArray(cloudDebts)) {
          setDebts(cloudDebts);
          saveDebts(cloudDebts);
        }

        if (cloudData.members && Array.isArray(cloudData.members)) {
          setHousehold((prev) =>
            prev
              ? {
                  ...prev,
                  name: cloudData.name || prev.name,
                  members: cloudData.members,
                  inviteCode: cloudData.inviteCode || prev.inviteCode,
                  pushSubscriptions: cloudData.pushSubscriptions || prev.pushSubscriptions,
                }
              : null
          );
        }

        setSyncStatus('synced');
        setLastSyncedAt(new Date());

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      },
      (error) => {
        console.warn('Firestore subscription status:', error?.message);
        setSyncStatus('error');
        setSyncErrorMessage(error?.message || 'Błąd subskrypcji Firestore');
      }
    );

    return () => unsubscribe();
  }, [household?.id]);

  // 3. Auto sync changes to Firestore (debounced)
  useEffect(() => {
    if (isIncomingFirestoreUpdate.current) return;
    if (!hasUnsavedLocalChanges.current) return;
    if (!household?.id || !isFirebaseConfigured()) return;

    const timer = setTimeout(async () => {
      // Guard against race conditions
      if (isIncomingFirestoreUpdate.current || !hasUnsavedLocalChanges.current) return;

      setIsSyncing(true);
      setSyncStatus('saving');
      try {
        const current = stateRef.current;
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          mortgages: current.mortgages,
          debts: current.debts,
          pushSubscriptions: household.pushSubscriptions || [],
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        setSyncErrorMessage(null);
      } catch (err: any) {
        console.warn('Błąd synchronizacji z Firestore:', err);
        setSyncStatus('error');
        setSyncErrorMessage(err?.message || 'Błąd zapisu do Firestore');
      } finally {
        setIsSyncing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [transactions, bills, budgetLimits, shoppingLists, shoppingItems, notifications, mortgages, debts, household?.id, currentUser]);

  // 4. Persistence to LocalStorage fallback
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveBills(bills);
  }, [bills]);

  useEffect(() => {
    saveBudgetLimits(budgetLimits);
  }, [budgetLimits]);

  useEffect(() => {
    saveShoppingLists(shoppingLists);
  }, [shoppingLists]);

  useEffect(() => {
    saveShoppingItems(shoppingItems);
  }, [shoppingItems]);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveMortgages(mortgages);
  }, [mortgages]);

  useEffect(() => {
    saveDebts(debts);
  }, [debts]);

  useEffect(() => {
    savePushSetting(pushEnabled);
  }, [pushEnabled]);

  useEffect(() => {
    saveHousehold(household);
  }, [household]);

  useEffect(() => {
    saveUserProfile(currentUser);
  }, [currentUser]);

  // 5. Check background bill notifications
  useEffect(() => {
    if (bills.length > 0 && pushEnabled) {
      checkAndTriggerBillNotifications(bills);
    }
  }, [bills, pushEnabled]);

  // Handlers for Transactions
  const handleAddTransaction = (
    transactionData: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
  ) => {
    let finalPrincipalAmount = transactionData.principalAmount;
    let finalInterestAmount = transactionData.interestAmount;

    // Automatyczne wyliczenie części kapitałowej i odsetkowej jeśli transakcja jest powiązana ze zobowiązaniem z oprocentowaniem
    if (transactionData.debtId) {
      const foundDebt = debts.find((d) => d.id === transactionData.debtId);
      if (foundDebt && isInterestBearingDebt(foundDebt)) {
        if (finalPrincipalAmount === undefined) {
          const split = calculateSuggestedLoanSplit({
            debt: foundDebt,
            paymentAmount: transactionData.amount,
            paymentDate: transactionData.date,
            paymentType: 'regular',
          });
          finalPrincipalAmount = split.suggestedPrincipal;
          if (finalInterestAmount === undefined) {
            finalInterestAmount = split.suggestedInterest;
          }
        }
      }
    }

    const newTx: Transaction = {
      ...transactionData,
      id: transactionData.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      principalAmount: finalPrincipalAmount,
      interestAmount: finalInterestAmount,
      createdAt: new Date().toISOString(),
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      saveTransactions(updated);
      return updated;
    });

    // Zapisz użycie do inteligentnych propozycji (30-dniowe okno)
    recordTransactionUsage(
      transactionData.title,
      transactionData.category,
      transactionData.type,
      transactionData.amount
    );

    // Powiadomienie o nowej transakcji
    const typeLabel = transactionData.type === 'income' ? 'Wpłata' : 'Wydatek';
    recordActivity({
      action: 'create',
      entityType: 'transaction',
      entityId: newTx.id,
      title: `${typeLabel}: ${newTx.title}`,
      description: `${newTx.amount.toFixed(2)} PLN (${newTx.category})`,
      snapshot: newTx,
      targetTab: 'transactions',
    });

    // Automatyczna synchronizacja zobowiązania (spłata długu / odzyskanie pożyczonych środków)
    if (newTx.debtId) {
      setDebts((prevDebts) => {
        const found = prevDebts.find((d) => d.id === newTx.debtId);
        if (!found) return prevDebts;

        // Jeśli to jest transakcja utworzenia/zaciągnięcia długu ('borrow' lub 'lend'), nie pomniejszamy salda
        if (newTx.debtAction === 'borrow' || newTx.debtAction === 'lend') {
          return prevDebts;
        }

        const isRepayment =
          (found.type === 'borrowed' && newTx.type === 'expense') ||
          (found.type === 'lent' && newTx.type === 'income') ||
          newTx.debtAction === 'repay_borrowed' ||
          newTx.debtAction === 'receive_lent';

        if (isRepayment) {
          // Jeśli podano dedykowaną kwotę spłaty kapitału (np. z rachunku ze split-em kapitał/odsetki lub auto kalkulacji), używamy jej
          let principalRepaid: number;
          if (typeof newTx.principalAmount === 'number') {
            principalRepaid = newTx.principalAmount;
          } else if (isInterestBearingDebt(found)) {
            const split = calculateSuggestedLoanSplit({
              debt: found,
              paymentAmount: newTx.amount,
              paymentDate: newTx.date,
              paymentType: 'regular',
            });
            principalRepaid = split.suggestedPrincipal;
          } else {
            principalRepaid = newTx.amount;
          }

          const newPaid = Math.round((found.paidAmount + principalRepaid) * 100) / 100;
          const newRemaining = Math.max(0, Math.round((found.initialAmount - newPaid) * 100) / 100);
          const isNowSettled = newRemaining <= 0.01;

          const updatedDebt: DebtItem = {
            ...found,
            paidAmount: newPaid,
            currentRemaining: newRemaining,
            status: isNowSettled ? 'settled' : 'active',
            paymentsHistory: [
              ...(found.paymentsHistory || []),
              {
                id: `payment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                date: newTx.date,
                amount: newTx.amount,
                principalAmount: principalRepaid,
                interestAmount: newTx.interestAmount !== undefined ? newTx.interestAmount : Math.max(0, Math.round((newTx.amount - principalRepaid) * 100) / 100),
                type: 'regular',
                remainingAfter: newRemaining,
                notes: newTx.comment || newTx.title,
                transactionId: newTx.id,
              },
            ],
          };

          // Jeśli zobowiązanie zostało w całości spłacone, a istnieje powiązany cykliczny rachunek, oznaczamy rachunek jako zakończony / opłacony
          if (isNowSettled) {
            setBills((prevBills) => {
              const updatedBills = prevBills.map((b) => {
                if (b.debtId === found.id) {
                  return {
                    ...b,
                    status: 'paid' as const,
                  };
                }
                return b;
              });
              saveBills(updatedBills);
              return updatedBills;
            });
          }

          const next = prevDebts.map((d) => (d.id === found.id ? updatedDebt : d));
          saveDebts(next);
          return next;
        }
        return prevDebts;
      });
    }

    return newTx.id;
  };

  const handleQuickAddTransaction = (
    transactionData: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
  ) => {
    const newId = handleAddTransaction(transactionData);
    setToastFeedback({
      id: `toast-${Date.now()}`,
      title: transactionData.title,
      amount: transactionData.amount,
      type: transactionData.type,
      onUndo: () => handleDeleteTransaction(newId),
    });
  };

  const handleDeleteTransaction = (id: string, skipBillRevert = false) => {
    const deletedTx = transactions.find((t) => t.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTransactions(updated);
      return updated;
    });
    if (deletedTx) {
      recordActivity({
        action: 'delete',
        entityType: 'transaction',
        entityId: deletedTx.id,
        title: `Usunięto transakcję: ${deletedTx.title}`,
        description: `Wartość: ${deletedTx.amount.toFixed(2)} PLN (${deletedTx.category})`,
        snapshot: deletedTx,
        targetTab: 'transactions',
      });

      // Jeśli usunięta transakcja była powiązana z opłaconym rachunkiem,
      // i operacja nie została już obsłużona przez cofnięcie w BillsManager (skipBillRevert === false),
      // usuń transakcję z historii uregulowanych cykli rachunku i przywróć do oczekujących
      if (!skipBillRevert) {
        const targetBillId = deletedTx.billId;
        const cleanTitleName = deletedTx.title.replace(/^Rachunek:\s*/i, '').trim().toLowerCase();

        setBills((prevBills) => {
          let billModified = false;
          const updatedBills = prevBills.map((b) => {
            const isDirectMatch = !!(targetBillId && b.id === targetBillId);
            const isNameMatch =
              !targetBillId &&
              (deletedTx.category === 'Rachunki i media' || deletedTx.category === 'Rachunki') &&
              (b.name.toLowerCase() === cleanTitleName ||
                cleanTitleName.includes(b.name.toLowerCase()) ||
                b.name.toLowerCase().includes(cleanTitleName) ||
                (deletedTx.comment && deletedTx.comment.toLowerCase().includes(b.name.toLowerCase())));

            if (isDirectMatch || isNameMatch) {
              const history = b.paymentHistory || [];
              let removedItemIndex = -1;

              // 1. Bezpośrednie powiązanie po ID wpisu historii lub ID transakcji
              if (deletedTx.billPaymentHistoryId) {
                removedItemIndex = history.findIndex((h) => h.id === deletedTx.billPaymentHistoryId);
              }
              if (removedItemIndex === -1 && deletedTx.id) {
                removedItemIndex = history.findIndex((h) => h.transactionId === deletedTx.id);
              }

              // 2. Dopasowanie po dokładnym terminie okresu rozliczeniowego
              if (removedItemIndex === -1 && deletedTx.billPeriodDueDate) {
                removedItemIndex = history.findIndex((h) => h.periodDueDate === deletedTx.billPeriodDueDate);
              }

              // 3. Dopasowanie po dacie transakcji i kwocie
              if (removedItemIndex === -1) {
                removedItemIndex = history.findIndex(
                  (h) =>
                    !h.isRollover &&
                    (h.paidDate === deletedTx.date || h.paidDate.slice(0, 7) === deletedTx.date.slice(0, 7)) &&
                    Math.abs(h.amount - deletedTx.amount) < 0.05
                );
              }

              // 4. Dopasowanie po miesiącu transakcji
              if (removedItemIndex === -1) {
                removedItemIndex = history.findIndex(
                  (h) => !h.isRollover && h.paidDate.slice(0, 7) === deletedTx.date.slice(0, 7)
                );
              }

              // Jeśli nie ma jednoznacznego dopasowania, NIE usuwamy losowych wpisów z historii!
              if (removedItemIndex === -1) {
                return b;
              }

              billModified = true;
              const targetHistoryItem = history[removedItemIndex];
              const cyclesToRevert = targetHistoryItem?.cycleCount || 1;

              const updatedHistory = history.filter((_, idx) => idx !== removedItemIndex);

              // Przywróć termin okresu (jeśli zapamiętany w historii) lub poprzedni termin
              const restoredDueDate =
                targetHistoryItem.periodDueDate ||
                b.previousDueDate ||
                calculatePreviousDueDate(b.dueDate, b.billingCycle, cyclesToRevert);

              return {
                ...b,
                status: 'pending' as const,
                dueDate: restoredDueDate,
                previousDueDate: undefined,
                paymentDate: undefined,
                paymentHistory: updatedHistory,
                lastPaidAmount: updatedHistory[0]?.amount,
              };
            }
            return b;
          });

          if (billModified) {
            saveBills(updatedBills);
            logActivity(
              'Przywrócono rachunek do opłacenia',
              `Po usunięciu transakcji powiązany rachunek powrócił do statusu "Do zapłaty", a wpis usunięto z historii cykli`
            );
            return updatedBills;
          }
          return prevBills;
        });
      }

      // Jeśli usunięta transakcja była powiązana ze spłatą zadłużenia, cofnij spłatę w zobowiązaniu
      if (deletedTx.debtId) {
        setDebts((prevDebts) => {
          const found = prevDebts.find((d) => d.id === deletedTx.debtId);
          if (!found) return prevDebts;

          const remainingHistory = found.paymentsHistory.filter((p) => p.transactionId !== deletedTx.id);
          const principalToRevert = typeof deletedTx.principalAmount === 'number'
            ? deletedTx.principalAmount
            : (isInterestBearingDebt(found)
                ? calculateSuggestedLoanSplit({
                    debt: found,
                    paymentAmount: deletedTx.amount,
                    paymentDate: deletedTx.date,
                    paymentType: 'regular',
                  }).suggestedPrincipal
                : deletedTx.amount);

          const newPaid = Math.max(0, Math.round((found.paidAmount - principalToRevert) * 100) / 100);
          const newRemaining = Math.max(0, Math.round((found.initialAmount - newPaid) * 100) / 100);

          const updatedDebt: DebtItem = {
            ...found,
            paidAmount: newPaid,
            currentRemaining: newRemaining,
            status: newRemaining <= 0.01 ? 'settled' : 'active',
            paymentsHistory: remainingHistory,
          };
          const next = prevDebts.map((d) => (d.id === found.id ? updatedDebt : d));
          saveDebts(next);
          return next;
        });
      }
    }
  };

  const handleUpdateTransaction = (id: string, updates: Partial<Transaction>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    let updatedTitle = '';
    const origTx = transactions.find((t) => t.id === id);

    setTransactions((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          updatedTitle = updates.title || t.title;
          return { ...t, ...updates };
        }
        return t;
      });
      saveTransactions(updated);
      return updated;
    });

    // Synchronizacja zobowiązań przy edycji transakcji powiązanej
    if (origTx && (origTx.debtId || updates.debtId)) {
      setDebts((prevDebts) => {
        const nextDebts = prevDebts.map((debt) => {
          const hasPayment = debt.paymentsHistory?.some((p) => p.transactionId === id);
          const finalDebtId = updates.debtId !== undefined ? updates.debtId : origTx.debtId;
          const isTargetDebt = debt.id === finalDebtId;

          if (!hasPayment && !isTargetDebt) return debt;

          let payments = (debt.paymentsHistory || []).filter((p) => p.transactionId !== id);

          if (isTargetDebt && finalDebtId) {
            const finalAmount = updates.amount !== undefined ? updates.amount : origTx.amount;
            const finalDate = updates.date !== undefined ? updates.date : origTx.date;
            const finalNotes = updates.title || updates.comment || origTx.title;

            payments.push({
              id: `payment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              date: finalDate,
              amount: finalAmount,
              type: 'regular',
              remainingAfter: 0,
              notes: finalNotes,
              transactionId: id,
            });
          }

          const newPaid = payments.reduce((sum, p) => sum + p.amount, 0);
          const newRemaining = Math.max(0, debt.initialAmount - newPaid);

          // Update remainingAfter
          payments = payments.map((p) => (p.transactionId === id ? { ...p, remainingAfter: newRemaining } : p));

          return {
            ...debt,
            paidAmount: newPaid,
            currentRemaining: newRemaining,
            status: newRemaining <= 0.01 ? ('settled' as const) : ('active' as const),
            paymentsHistory: payments,
          };
        });
        saveDebts(nextDebts);
        return nextDebts;
      });
    }

    recordActivity({
      action: 'update',
      entityType: 'transaction',
      entityId: id,
      title: 'Zaktualizowano transakcję',
      description: `Szczegóły: ${updatedTitle || 'transakcja'}`,
      targetTab: 'transactions',
    });
  };

  const handleScannedReceipt = (extracted: {
    title: string;
    amount: number;
    category: any;
    date: string;
    items?: { name: string; price: number; quantity: number }[];
  }) => {
    handleAddTransaction({
      title: extracted.title,
      amount: extracted.amount,
      type: 'expense',
      category: extracted.category,
      date: extracted.date,
      receiptItems: extracted.items?.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: extracted.category,
      })),
    });
    recordActivity({
      action: 'create',
      entityType: 'transaction',
      entityId: `receipt-${Date.now()}`,
      title: 'Zeskanowano paragon',
      description: `${extracted.title} (${extracted.amount.toFixed(2)} PLN)`,
      targetTab: 'transactions',
    });
    setActiveTab('transactions');
  };

  // Handlers for Shopping Lists & Items
  const handleAddShoppingList = (listData: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const normName = listData.name.trim().toLowerCase();
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    let createdOrUpdatedList: ShoppingList | null = null;
    setShoppingLists((prev) => {
      const existing = prev.find((l) => (l.name || '').trim().toLowerCase() === normName);
      if (existing) {
        createdOrUpdatedList = { ...existing, ...listData };
        const updated = prev.map((l) => (l.id === existing.id ? { ...l, ...listData } : l));
        saveShoppingLists(updated);
        return updated;
      }
      const newList: ShoppingList = {
        ...listData,
        id: `list-${Date.now()}`,
        priority: listData.priority || 0,
        isHidden: listData.isHidden || false,
        createdAt: new Date().toISOString(),
      };
      createdOrUpdatedList = newList;
      const updated = [...prev, newList];
      saveShoppingLists(updated);
      return updated;
    });
    if (createdOrUpdatedList) {
      recordActivity({
        action: 'create',
        entityType: 'shopping_list',
        entityId: (createdOrUpdatedList as ShoppingList).id,
        title: `Nowa lista zakupów: ${listData.name}`,
        description: `Kategoria: ${listData.category}`,
        snapshot: createdOrUpdatedList,
        targetTab: 'shopping',
      });
    }
  };

  const handleUpdateShoppingList = (id: string, updates: Partial<ShoppingList>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingLists((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates } : l));
      saveShoppingLists(updated);
      return updated;
    });
  };

  const handleDeleteShoppingList = (id: string) => {
    const listToDelete = shoppingLists.find((l) => l.id === id);
    const itemsToDelete = shoppingItems.filter((i) => i.listId === id);
    itemsToDelete.forEach((item) => {
      unrecordShoppingItemUsage(item.name);
    });
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingLists((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveShoppingLists(updated);
      return updated;
    });
    setShoppingItems((prev) => {
      const updated = prev.filter((i) => i.listId !== id);
      saveShoppingItems(updated);
      return updated;
    });
    if (listToDelete) {
      recordActivity({
        action: 'delete',
        entityType: 'shopping_list',
        entityId: listToDelete.id,
        title: `Usunięto listę zakupów: ${listToDelete.name}`,
        description: `Kategoria: ${listToDelete.category}`,
        snapshot: listToDelete,
        targetTab: 'shopping',
      });
    }
  };

  const handleAddShoppingItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const categoryName = itemData.category || 'Spożywcze';
    const normCategory = categoryName.trim().toLowerCase();

    // Ensure corresponding shopping list exists (deduplicated)
    let targetListId = itemData.listId;

    setShoppingLists((prev) => {
      const matchingList = prev.find(
        (l) =>
          (l.name || '').trim().toLowerCase() === normCategory ||
          (l.category || '').trim().toLowerCase() === normCategory
      );

      if (matchingList) {
        targetListId = matchingList.id;
        return prev;
      }

      const newListId = itemData.listId || `list-${Date.now()}`;
      targetListId = newListId;
      const newList: ShoppingList = {
        id: newListId,
        name: categoryName,
        category: categoryName,
        icon: 'ShoppingCart',
        color: '#10b981',
        description: `Kategoria ${categoryName}`,
        priority: 0,
        isHidden: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [...prev, newList];
      saveShoppingLists(updated);
      return updated;
    });

    const newItem: ShoppingItem = {
      ...itemData,
      listId: targetListId || `list-${Date.now()}`,
      category: categoryName,
      id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      assignedTo: itemData.assignedTo || currentUser.name || 'Wszyscy',
    };

    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = [...prev, newItem];
      saveShoppingItems(updated);
      return updated;
    });

    // Save item frequency for smart dynamic suggestions
    recordShoppingItemUsage(newItem.name, categoryName, newItem.unit);

    recordActivity({
      action: 'create',
      entityType: 'shopping_item',
      entityId: newItem.id,
      title: `Dodano do listy: ${newItem.name}`,
      description: `${newItem.quantity} ${newItem.unit || 'szt.'} (${categoryName})`,
      snapshot: newItem,
      targetTab: 'shopping',
    });
  };

  const handleToggleShoppingItem = (id: string) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const isCompleted = !item.isCompleted;
          if (isCompleted) {
            recordActivity({
              action: 'update',
              entityType: 'shopping_item',
              entityId: item.id,
              title: `Kupiono: ${item.name}`,
              description: `Oznaczono jako kupione (${item.quantity} ${item.unit || 'szt.'} • ${item.category})`,
              targetTab: 'shopping',
              snapshot: item,
            });
          } else {
            // Po odznaczeniu (powrót do kupienia), wycofaj powiadomienie o kupieniu tego artykułu
            setNotifications((nPrev) => {
              const filtered = nPrev.filter((n) => !(n.relatedId === id && n.type === 'item_bought'));
              saveNotifications(filtered);
              return filtered;
            });
            setBannerNotification((curr) => (curr?.relatedId === id && curr?.type === 'item_bought' ? null : curr));
          }
          return {
            ...item,
            isCompleted,
            completedAt: isCompleted ? (item.completedAt || new Date().toISOString()) : undefined,
          };
        }
        return item;
      });
      saveShoppingItems(updated);
      return updated;
    });
  };

  const handleDeleteShoppingItem = (id: string) => {
    const itemToDelete = shoppingItems.find((i) => i.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveShoppingItems(updated);
      return updated;
    });
    if (itemToDelete) {
      unrecordShoppingItemUsage(itemToDelete.name);
      recordActivity({
        action: 'delete',
        entityType: 'shopping_item',
        entityId: itemToDelete.id,
        title: `Usunięto artykuł: ${itemToDelete.name}`,
        description: `Kategoria: ${itemToDelete.category}`,
        snapshot: itemToDelete,
        targetTab: 'shopping',
      });
    }
  };

  const handleUpdateShoppingItem = (id: string, updates: Partial<ShoppingItem>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      saveShoppingItems(updated);
      return updated;
    });
  };

  // Handlers for Bills
  const handleAddBill = (billData: Omit<Bill, 'id' | 'createdAt'> & { id?: string }) => {
    const newBill: Bill = {
      ...billData,
      id: billData.id || `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = [...prev, newBill];
      saveBills(updated);
      return updated;
    });
    recordActivity({
      action: 'create',
      entityType: 'bill',
      entityId: newBill.id,
      title: `Nowy rachunek: ${newBill.name}`,
      description: `${newBill.amount.toFixed(2)} PLN, termin: ${newBill.dueDate}`,
      snapshot: newBill,
      targetTab: 'bills',
    });
  };

  const handleUpdateBill = (id: string, updates: Partial<Bill>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = prev.map((b) => {
        if (b.id === id) {
          const u = { ...b, ...updates };
          if (updates.status === 'paid' && b.status !== 'paid') {
            recordActivity({
              action: 'update',
              entityType: 'bill',
              entityId: b.id,
              title: `Opłacono rachunek: ${b.name}`,
              description: `Kwota ${b.amount.toFixed(2)} PLN oznaczona jako uregulowana`,
              targetTab: 'bills',
            });
          } else if (updates.amount !== undefined && updates.amount !== b.amount) {
            recordActivity({
              action: 'update',
              entityType: 'bill',
              entityId: b.id,
              title: `Zaktualizowano rachunek: ${b.name}`,
              description: `Nowa kwota: ${updates.amount.toFixed(2)} PLN`,
              targetTab: 'bills',
            });
          }
          return u;
        }
        return b;
      });
      saveBills(updated);
      return updated;
    });
  };

  const handleDeleteBill = (id: string) => {
    const billToDelete = bills.find((b) => b.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveBills(updated);
      return updated;
    });
    if (billToDelete) {
      recordActivity({
        action: 'delete',
        entityType: 'bill',
        entityId: billToDelete.id,
        title: `Usunięto rachunek: ${billToDelete.name}`,
        description: `Wartość: ${billToDelete.amount.toFixed(2)} PLN`,
        snapshot: billToDelete,
        targetTab: 'bills',
      });
    }
  };

  // Handlers for Budget Limits
  const handleAddBudgetLimit = (limitData: Omit<BudgetLimit, 'id'>) => {
    const newLimit: BudgetLimit = {
      ...limitData,
      id: `limit-${Date.now()}`,
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = [...prev, newLimit];
      saveBudgetLimits(updated);
      return updated;
    });
    recordActivity({
      action: 'create',
      entityType: 'budget_limit',
      entityId: newLimit.id,
      title: `Ustalono limit: ${newLimit.category}`,
      description: `Miesięczny limit: ${newLimit.monthlyLimit.toFixed(2)} PLN`,
      snapshot: newLimit,
      targetTab: 'limits',
    });
  };

  const handleUpdateBudgetLimit = (id: string, limit: number) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = prev.map((l) => {
        if (l.id === id) {
          recordActivity({
            action: 'update',
            entityType: 'budget_limit',
            entityId: l.id,
            title: `Zmieniono limit: ${l.category}`,
            description: `Nowy limit: ${limit.toFixed(2)} PLN`,
            targetTab: 'limits',
          });
          return { ...l, monthlyLimit: limit };
        }
        return l;
      });
      saveBudgetLimits(updated);
      return updated;
    });
  };

  const handleDeleteBudgetLimit = (id: string) => {
    const limitToDelete = budgetLimits.find((l) => l.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveBudgetLimits(updated);
      return updated;
    });
    if (limitToDelete) {
      recordActivity({
        action: 'delete',
        entityType: 'budget_limit',
        entityId: limitToDelete.id,
        title: `Usunięto limit: ${limitToDelete.category}`,
        description: `Miesięczny limit: ${limitToDelete.monthlyLimit.toFixed(2)} PLN`,
        snapshot: limitToDelete,
        targetTab: 'limits',
      });
    }
  };

  // Handlers for Mortgage
  const handleUpdateMortgage = (updated: MortgageLoan) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setMortgages((prev) => {
      const exists = prev.some((m) => m.id === updated.id);
      const next = exists ? prev.map((m) => (m.id === updated.id ? updated : m)) : [...prev, updated];
      saveMortgages(next);
      return next;
    });
    logActivity('Zaktualizowano kredyt hipoteczny', `Zapisano parametry kredytu "${updated.name}"`);
  };

  // Handlers for Debts & Loans
  const handleAddDebt = (debtData: Omit<DebtItem, 'id' | 'createdAt'> & { id?: string }) => {
    const newDebt: DebtItem = {
      ...debtData,
      id: debtData.id || `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setDebts((prev) => {
      const updated = [newDebt, ...prev];
      saveDebts(updated);
      return updated;
    });

    const typeDesc = newDebt.type === 'borrowed' ? 'Zobowiązanie / pożyczka do spłaty' : 'Udzielona pożyczka';
    recordActivity({
      action: 'create',
      entityType: 'debt' as any,
      entityId: newDebt.id,
      title: `Nowe zobowiązanie: ${newDebt.name}`,
      description: `${(newDebt.initialAmount || 0).toFixed(2)} PLN (${typeDesc})`,
      targetTab: 'debts',
      snapshot: newDebt,
    });
  };

  const handleUpdateDebt = (updatedDebt: DebtItem) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setDebts((prev) => {
      const exists = prev.some((d) => d.id === updatedDebt.id);
      const updated = exists ? prev.map((d) => (d.id === updatedDebt.id ? updatedDebt : d)) : [updatedDebt, ...prev];
      saveDebts(updated);
      return updated;
    });
    // Synchronizuj powiązany kredyt w mortgages, jeśli to kredyt bankowy
    if (updatedDebt.isBankLoan) {
      setMortgages((prev) => {
        const next = prev.map((m) =>
          m.id === updatedDebt.id
            ? {
                ...m,
                name: updatedDebt.name,
                bankName: updatedDebt.bankName || updatedDebt.counterparty,
                loanAmount: updatedDebt.initialAmount,
                remainingPrincipal: updatedDebt.currentRemaining,
                monthlyPayment: updatedDebt.monthlyPayment || m.monthlyPayment,
                interestRate: updatedDebt.interestRate || m.interestRate,
              }
            : m
        );
        saveMortgages(next);
        return next;
      });
    }
  };

  const handleDeleteDebt = (id: string) => {
    const debtToDelete = debts.find((d) => d.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;

    // 1. Znajdź powiązane rachunki do usunięcia
    const billsToDelete = bills.filter((b) => b.debtId === id || b.id === id);
    const deletedBillIds = new Set(billsToDelete.map((b) => b.id));

    // Zgromadź ID wszystkich transakcji powiązanych z tym zadłużeniem oraz jego wpisami spłat/rachunkami
    const linkedTxIds = new Set<string>();
    if (debtToDelete?.paymentsHistory) {
      debtToDelete.paymentsHistory.forEach((p) => {
        if (p.transactionId) linkedTxIds.add(p.transactionId);
      });
    }
    billsToDelete.forEach((b) => {
      if (b.autoExpenseId) linkedTxIds.add(b.autoExpenseId);
      if (b.paymentHistory) {
        b.paymentHistory.forEach((p) => {
          if (p.transactionId) linkedTxIds.add(p.transactionId);
        });
      }
    });

    // 2. Usuń zadłużenie z rejestru debts
    setDebts((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveDebts(updated);
      return updated;
    });

    // 3. Usuń powiązany kredyt z mortgages
    setMortgages((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveMortgages(updated);
      return updated;
    });

    // 4. Usuń powiązane rachunki z rejestru bills
    setBills((prev) => {
      const updated = prev.filter((b) => b.debtId !== id && b.id !== id);
      if (updated.length !== prev.length) {
        saveBills(updated);
      }
      return updated;
    });

    // 5. Usuń powiązane transakcje i wpisy płatności w budżecie
    setTransactions((prev) => {
      const updated = prev.filter((t) => {
        if (t.debtId === id) return false;
        if (t.billId && deletedBillIds.has(t.billId)) return false;
        if (linkedTxIds.has(t.id)) return false;
        return true;
      });
      if (updated.length !== prev.length) {
        saveTransactions(updated);
      }
      return updated;
    });

    // 6. Usuń powiadomienia powiązane z tym zadłużeniem lub usuniętymi rachunkami
    setNotifications((prev) => {
      const updated = prev.filter((n) => {
        if (n.relatedId === id) return false;
        if (n.relatedId && deletedBillIds.has(n.relatedId)) return false;
        if (n.relatedId && linkedTxIds.has(n.relatedId)) return false;
        return true;
      });
      if (updated.length !== prev.length) {
        saveNotifications(updated);
      }
      return updated;
    });

    if (debtToDelete) {
      recordActivity({
        action: 'delete',
        entityType: 'debt',
        entityId: debtToDelete.id,
        title: `Usunięto zobowiązanie: ${debtToDelete.name}`,
        description: `Usunięto zadłużenie (${(debtToDelete.initialAmount || 0).toFixed(2)} PLN), powiązany rachunek oraz historię płatności.`,
        snapshot: debtToDelete,
        targetTab: 'debts',
      });
    }
  };

  // Selective Data Deletion
  const handleDeleteSelectedData = async (selection: DeleteSelection) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;

    // Bezpieczeństwo: utwórz migawkę kopii zapasowej przed usunięciem danych
    saveBackupSnapshot('Migawka bezpieczeństwa przed selektywnym usunięciem danych', {
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
      debts,
      mortgages,
    });

    let newTransactions = transactions;
    let newBills = bills;
    let newLimits = budgetLimits;
    let newShoppingLists = shoppingLists;
    let newShoppingItems = shoppingItems;
    let newDebts = debts;
    let newMortgages = mortgages;
    let newNotifications = notifications;
    let newHousehold = household;

    if (selection.transactions) {
      newTransactions = [];
      setTransactions([]);
      saveTransactions([]);
    }

    if (selection.bills) {
      newBills = [];
      setBills([]);
      saveBills([]);
    }

    if (selection.budgetLimits) {
      newLimits = [];
      setBudgetLimits([]);
      saveBudgetLimits([]);
    }

    if (selection.shopping) {
      newShoppingLists = [];
      newShoppingItems = [];
      setShoppingLists([]);
      setShoppingItems([]);
      saveShoppingLists([]);
      saveShoppingItems([]);
    }

    if (selection.debts) {
      newDebts = [];
      setDebts([]);
      saveDebts([]);
      // Wyczyszczenie zobowiązań usuwa również pozycje z mortgages
      newMortgages = [];
      setMortgages([]);
      saveMortgages([]);
    } else if (selection.mortgages) {
      newMortgages = [];
      setMortgages([]);
      saveMortgages([]);
    }

    if (selection.notifications) {
      newNotifications = [];
      setNotifications([]);
      saveNotifications([]);
    }

    if (selection.activities) {
      setActivities([]);
      saveActivities([]);
    }

    if (selection.household) {
      newHousehold = null;
      setHousehold(null);
      saveHousehold(null);
      if (currentUser.id && isFirebaseConfigured()) {
        try {
          await saveUserProfileToFirestore(currentUser, '');
        } catch (e) {
          console.warn('Błąd odłączania domu w Firestore:', e);
        }
      }
    }

    // Synchronize to Firestore if connected to a household
    if (newHousehold?.id && isFirebaseConfigured()) {
      try {
        await saveHouseholdToFirestore(newHousehold.id, {
          id: newHousehold.id,
          name: newHousehold.name,
          inviteCode: newHousehold.inviteCode,
          createdAt: newHousehold.createdAt,
          createdBy: newHousehold.createdBy,
          members: newHousehold.members,
          transactions: newTransactions,
          bills: newBills,
          budgetLimits: newLimits,
          shoppingLists: newShoppingLists,
          shoppingItems: newShoppingItems,
          notifications: newNotifications,
          debts: newDebts,
          mortgages: newMortgages,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
      } catch (err) {
        console.warn('Błąd aktualizacji Firestore po usunięciu danych:', err);
      }
    }

    if (!selection.activities) {
      recordActivity({
        action: 'delete',
        entityType: 'system',
        entityId: 'bulk-delete',
        title: 'Selektywne czyszczenie bazy',
        description: 'Wyczyszczono wybrane kategorie danych',
        targetTab: 'dashboard',
      });
    }
  };

  // User Profile & Household Handlers
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    saveUserProfile(user);

    if (isFirebaseConfigured() && user.id) {
      try {
        const profile = await getUserProfileFromFirestore(user.id);
        if (profile?.activeHouseholdId) {
          const cloudH = await getHouseholdFromFirestore(profile.activeHouseholdId);
          if (cloudH) {
            setHousehold({
              id: cloudH.id,
              name: cloudH.name,
              inviteCode: cloudH.inviteCode,
              createdAt: cloudH.createdAt,
              createdBy: cloudH.createdBy,
              members: cloudH.members || [],
              syncStatus: 'synced',
              cloudProvider: 'firebase',
            });
            const cloudTxs = cloudH.transactions || [];
            const cloudBills = cloudH.bills || [];
            const cloudLimits = cloudH.budgetLimits || [];
            const cloudLists = cloudH.shoppingLists || [];
            const cloudItems = cloudH.shoppingItems || [];
            const cloudNotifs = cloudH.notifications || [];

            setTransactions(cloudTxs);
            saveTransactions(cloudTxs);

            setBills(cloudBills);
            saveBills(cloudBills);

            setBudgetLimits(cloudLimits);
            saveBudgetLimits(cloudLimits);

            setShoppingLists(cloudLists);
            saveShoppingLists(cloudLists);

            setShoppingItems(cloudItems);
            saveShoppingItems(cloudItems);

            setNotifications(cloudNotifs);
            saveNotifications(cloudNotifs);

            hasUnsavedLocalChanges.current = false;
          }
        }
      } catch (err) {
        console.warn('Błąd ładowania danych po logowaniu:', err);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFromFirebase();
    } catch (e) {
      console.warn('Logout warning:', e);
    }
    setCurrentUser({
      id: '',
      name: 'Gość',
      email: '',
      isLoggedIn: false,
    });
    setHousehold(null);
    setIsGuestMode(false);

    // Reset local data to isolate accounts completely
    setTransactions([]);
    saveTransactions([]);
    setBills([]);
    saveBills([]);
    setBudgetLimits([]);
    saveBudgetLimits([]);
    setShoppingLists([]);
    saveShoppingLists([]);
    setShoppingItems([]);
    saveShoppingItems([]);
    setNotifications([]);
    saveNotifications([]);
    setMortgages([]);
    saveMortgages([]);
    hasUnsavedLocalChanges.current = false;
  };

  const handleCreateHousehold = async (name: string) => {
    const inviteCode = `DOM-${Math.floor(1000 + Math.random() * 9000)}-PL`;
    const newHouseholdObj: Household = {
      id: `hh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      inviteCode,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email || currentUser.name || 'Właściciel',
      members: [
        {
          id: currentUser.id || `member-${Date.now()}`,
          email: currentUser.email || 'gospodarz@dom.pl',
          name: currentUser.name || 'Gospodarz',
          avatarUrl: currentUser.avatarUrl,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
      syncStatus: isFirebaseConfigured() ? 'synced' : 'offline',
      cloudProvider: 'firebase',
    };

    setHousehold(newHouseholdObj);
    hasUnsavedLocalChanges.current = true;
    logActivity('Utworzono gospodarstwo domowe', `Utworzono dom „${name}” z kodem zaproszenia ${inviteCode}`);

    if (isFirebaseConfigured()) {
      try {
        await saveHouseholdToFirestore(newHouseholdObj.id, {
          id: newHouseholdObj.id,
          name: newHouseholdObj.name,
          inviteCode: newHouseholdObj.inviteCode,
          createdAt: newHouseholdObj.createdAt,
          createdBy: newHouseholdObj.createdBy,
          members: newHouseholdObj.members,
          transactions,
          bills,
          budgetLimits,
          shoppingLists,
          shoppingItems,
          notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;

        if (currentUser.id) {
          await saveUserProfileToFirestore(currentUser, newHouseholdObj.id);
        }
      } catch (e) {
        console.error('Błąd zapisu nowego gospodarstwa w Firestore:', e);
      }
    }
  };

  const handleJoinHousehold = async (code: string): Promise<{ success: boolean; message?: string }> => {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Aby dołączyć do domu przez kod, skonfiguruj najpierw połączenie z Firebase w zakładce [Konfiguracja].',
      };
    }

    try {
      const cleanCode = code.trim().toUpperCase();
      const cloudHousehold = await findHouseholdByInviteCode(cleanCode);
      if (!cloudHousehold) {
        return {
          success: false,
          message: `Nie znaleziono gospodarstwa o kodzie: ${cleanCode}. Upewnij się, że kod został podany bezbłędnie (np. ${cleanCode}).`,
        };
      }

      const existingMembers = cloudHousehold.members || [];
      const myEmail = (currentUser.email || '').trim().toLowerCase();
      const myId = currentUser.id;

      // Sprawdź czy użytkownik jest już na liście członków (po ID lub emailu)
      const existingIndex = existingMembers.findIndex(
        (m: any) =>
          (myId && m.id === myId) ||
          (myEmail && m.email && m.email.trim().toLowerCase() === myEmail)
      );

      let updatedMembers = [...existingMembers];
      if (existingIndex >= 0) {
        updatedMembers[existingIndex] = {
          ...updatedMembers[existingIndex],
          id: myId || updatedMembers[existingIndex].id,
          name: currentUser.name || updatedMembers[existingIndex].name,
          email: currentUser.email || updatedMembers[existingIndex].email,
          avatarUrl: currentUser.avatarUrl || updatedMembers[existingIndex].avatarUrl,
        };
      } else {
        const newMember = {
          id: myId || `member-${Date.now()}`,
          email: currentUser.email || 'domownik@dom.pl',
          name: currentUser.name || 'Domownik',
          avatarUrl: currentUser.avatarUrl,
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
        };
        updatedMembers.push(newMember);
      }

      const joinNotif = createActivityNotification(
        'Nowy domownik',
        `${currentUser.name || 'Nowy użytkownik'} dołączył(a) do wspólnego gospodarstwa domowego`,
        currentUser.name || 'Domownik',
        'activity'
      );

      const combinedNotifications = [
        joinNotif,
        ...(cloudHousehold.notifications || []),
      ].slice(0, 50);

      const joinedHousehold: Household = {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
        syncStatus: 'synced',
        cloudProvider: 'firebase',
      };

      setHousehold(joinedHousehold);
      saveHousehold(joinedHousehold);

      const cloudTxs = cloudHousehold.transactions || [];
      const cloudBills = cloudHousehold.bills || [];
      const cloudLimits = cloudHousehold.budgetLimits || [];
      const cloudLists = cloudHousehold.shoppingLists || [];
      const cloudItems = cloudHousehold.shoppingItems || [];

      setTransactions(cloudTxs);
      saveTransactions(cloudTxs);

      setBills(cloudBills);
      saveBills(cloudBills);

      setBudgetLimits(cloudLimits);
      saveBudgetLimits(cloudLimits);

      setShoppingLists(cloudLists);
      saveShoppingLists(cloudLists);

      setShoppingItems(cloudItems);
      saveShoppingItems(cloudItems);

      setNotifications(combinedNotifications);
      saveNotifications(combinedNotifications);

      await saveHouseholdToFirestore(cloudHousehold.id, {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
        transactions: cloudTxs,
        bills: cloudBills,
        budgetLimits: cloudLimits,
        shoppingLists: cloudLists,
        shoppingItems: cloudItems,
        notifications: combinedNotifications,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });

      hasUnsavedLocalChanges.current = false;

      if (currentUser.id) {
        await saveUserProfileToFirestore(currentUser, cloudHousehold.id);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Błąd dołączania do domu:', err);
      return {
        success: false,
        message: err?.message || 'Wystąpił błąd podczas dołączania do gospodarstwa domowego.',
      };
    }
  };

  const handleLeaveHousehold = async () => {
    if (currentUser.id && isFirebaseConfigured()) {
      await saveUserProfileToFirestore(currentUser, '');
    }
    setHousehold(null);
    saveHousehold(null);
  };

  const handleInviteMember = async (email: string, name: string) => {
    if (!household) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    // Sprawdź czy już nie jest zaproszony
    const alreadyExists = (household.members || []).some(
      (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
    );
    if (alreadyExists) return;

    const newMember = {
      id: `invited-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      name: cleanName,
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    };

    const updatedMembers = [...(household.members || []), newMember];
    const inviteNotif = createActivityNotification(
      'Zaproszono domownika',
      `Wysłano zaproszenie dla ${cleanName} (${cleanEmail}) do wspólnego gospodarstwa`,
      currentUser.name || 'Gospodarz',
      'activity'
    );
    const updatedNotifs = [inviteNotif, ...notifications].slice(0, 50);

    const updated = {
      ...household,
      members: updatedMembers,
    };
    setHousehold(updated);
    setNotifications(updatedNotifs);

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...household,
          members: updatedMembers,
          notifications: updatedNotifs,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.error('Błąd zapisu zaproszonego członka do Firestore:', err);
      }
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!household) return;
    const removedMember = (household.members || []).find((m) => m.id === memberId);
    const updatedMembers = (household.members || []).filter((m) => m.id !== memberId);
    const updated = {
      ...household,
      members: updatedMembers,
    };
    setHousehold(updated);

    if (removedMember) {
      logActivity('Usunięto domownika', `Usunięto ${removedMember.name} z gospodarstwa domowego`);
    }

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...household,
          members: updatedMembers,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.error('Błąd usunięcia członka z Firestore:', err);
      }
    }
  };

  const handleForceSync = async (): Promise<boolean> => {
    if (!household?.id || !isFirebaseConfigured()) {
      setSyncErrorMessage('Brak aktywnego gospodarstwa domowego lub konfiguracji Firebase.');
      return false;
    }
    setIsSyncing(true);
    setSyncStatus('saving');
    try {
      const current = stateRef.current;

      // 1. If this client has unsaved local edits, push them to Firestore first
      if (hasUnsavedLocalChanges.current) {
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
      }

      // 2. Fetch the latest canonical data directly from Cloud Firestore
      const cloudHousehold = await getHouseholdFromFirestore(household.id);
      if (cloudHousehold) {
        isIncomingFirestoreUpdate.current = true;
        hasUnsavedLocalChanges.current = false;

        const cloudTxs = cloudHousehold.transactions || [];
        const cloudBills = cloudHousehold.bills || [];
        const cloudLimits = cloudHousehold.budgetLimits || [];
        const cloudLists = cloudHousehold.shoppingLists || [];
        const cloudItems = cloudHousehold.shoppingItems || [];
        const cloudNotifs = cloudHousehold.notifications || [];

        setTransactions(cloudTxs);
        saveTransactions(cloudTxs);

        setBills(cloudBills);
        saveBills(cloudBills);

        setBudgetLimits(cloudLimits);
        saveBudgetLimits(cloudLimits);

        setShoppingLists(cloudLists);
        saveShoppingLists(cloudLists);

        setShoppingItems(cloudItems);
        saveShoppingItems(cloudItems);

        setNotifications(cloudNotifs);
        saveNotifications(cloudNotifs);

        if (cloudHousehold.members && Array.isArray(cloudHousehold.members)) {
          setHousehold((prev) =>
            prev
              ? {
                  ...prev,
                  name: cloudHousehold.name || prev.name,
                  members: cloudHousehold.members,
                  inviteCode: cloudHousehold.inviteCode || prev.inviteCode,
                }
              : null
          );
        }

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      } else {
        // Document didn't exist yet in Firestore - initialize it with current state
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      }

      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncErrorMessage(null);
      return true;
    } catch (e: any) {
      console.warn('Manual sync failed:', e);
      setSyncStatus('error');
      setSyncErrorMessage(e?.message || 'Błąd synchronizacji z bazą Firestore');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerManualSync = async () => {
    await handleForceSync();
  };

  const handleRestoreData = (data: {
    transactions?: Transaction[];
    bills?: Bill[];
    budgetLimits?: BudgetLimit[];
    shoppingLists?: ShoppingList[];
    shoppingItems?: ShoppingItem[];
  }) => {
    lastLocalMutationTime.current = Date.now();
    if (data.transactions) {
      setTransactions(data.transactions);
      saveTransactions(data.transactions);
    }
    if (data.bills) {
      setBills(data.bills);
      saveBills(data.bills);
    }
    if (data.budgetLimits) {
      setBudgetLimits(data.budgetLimits);
      saveBudgetLimits(data.budgetLimits);
    }
    if (data.shoppingLists) {
      setShoppingLists(data.shoppingLists);
      saveShoppingLists(data.shoppingLists);
    }
    if (data.shoppingItems) {
      setShoppingItems(data.shoppingItems);
      saveShoppingItems(data.shoppingItems);
    }
    logActivity('Przywrócono kopię danych', 'Dane zostały przywrócone z bezpiecznej kopii zapasowej');
  };

  const handleClearNotifications = () => {
    setNotifications((prev) => {
      // Keep budget warnings and exceeded alerts even after clearing notifications
      const persistentBudgetNotifs = prev.filter(
        (n) => n.type === 'budget_warning' || n.type === 'budget_exceeded'
      );
      saveNotifications(persistentBudgetNotifs);
      return persistentBudgetNotifs;
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === id);
      let updated: AppNotification[];
      if (exists) {
        updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      } else {
        updated = [
          ...prev,
          {
            id,
            title: '',
            message: '',
            type: id.includes('exceeded')
              ? 'budget_exceeded'
              : id.includes('warning')
              ? 'budget_warning'
              : 'bill_due',
            date: new Date().toISOString(),
            read: true,
          } as AppNotification,
        ];
      }
      saveNotifications(updated);
      return updated;
    });
  };

  // IF NOT LOGGED IN AND NOT IN GUEST MODE: Show dedicated Login Screen directly
  if (!currentUser.isLoggedIn && !isGuestMode) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onContinueAsGuest={() => setIsGuestMode(true)}
          onOpenFirebaseConfig={() => {
            setHouseholdModalTab('firebase_config');
            setIsHouseholdModalOpen(true);
          }}
        />

        {/* Firebase Config Modal accessible from Login Screen */}
        <HouseholdModal
          isOpen={isHouseholdModalOpen}
          onClose={() => setIsHouseholdModalOpen(false)}
          currentUser={currentUser}
          household={household}
          initialTab={householdModalTab}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
          onCreateHousehold={handleCreateHousehold}
          onJoinHousehold={handleJoinHousehold}
          onLeaveHousehold={handleLeaveHousehold}
          onInviteMember={handleInviteMember}
          onRemoveMember={handleRemoveMember}
          onApproveJoinRequest={handleApproveJoinRequest}
          onRejectJoinRequest={handleRejectJoinRequest}
          onTriggerSync={handleTriggerManualSync}
          isSyncing={isSyncing}
          transactions={transactions}
          bills={bills}
          budgetLimits={budgetLimits}
          shoppingLists={shoppingLists}
          shoppingItems={shoppingItems}
          onDeleteSelectedData={handleDeleteSelectedData}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col antialiased selection:bg-indigo-600 selection:text-white font-sans">
      {/* Real-time In-App Notification Banner (Mobile & Desktop) */}
      <InAppNotificationBanner
        notification={bannerNotification}
        onDismiss={() => setBannerNotification(null)}
        onMarkRead={handleMarkNotificationRead}
        onNavigate={(tab, options) => {
          setBannerNotification(null);
          handleDashboardNavigate(tab, options);
        }}
      />

      {/* Mobile Privacy Quick Launcher (Overlay on Phones on App Launch) */}
      <MobileQuickLauncher
        isOpen={isMobileLauncherOpen}
        onClose={handleCloseMobileLauncher}
        onNavigate={(tab, options) => {
          handleCloseMobileLauncher();
          handleDashboardNavigate(tab, options);
        }}
        onOpenQuickAdd={() => {
          handleCloseMobileLauncher();
          setIsQuickAddOpen(true);
        }}
        pendingShoppingCount={shoppingItems.filter((i) => !i.isCompleted).length}
        unpaidBillsCount={bills.filter((b) => b.status !== 'paid').length}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        userName={currentUser.name}
        householdName={household?.name}
      />

      {/* Top Main Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        bills={bills}
        budgetLimits={budgetLimits}
        transactions={transactions}
        notifications={notifications}
        household={household}
        currentUser={currentUser}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onTriggerSync={handleTriggerManualSync}
        isSyncing={isSyncing}
        onOpenHouseholdModal={() => {
          setHouseholdModalTab('household');
          setIsHouseholdModalOpen(true);
        }}
        onOpenSettings={(tab) => {
          setSettingsModalTab(tab || 'activity');
          setIsSettingsModalOpen(true);
        }}
        onOpenDeleteDataModal={() => setIsDeleteModalOpen(true)}
        onOpenDataSafetyModal={() => setIsDataSafetyModalOpen(true)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenVersionInfo={() => setIsVersionModalOpen(true)}
        onClearNotifications={handleClearNotifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onLogout={handleLogout}
        onOpenMobileLauncher={() => setIsMobileLauncherOpen(true)}
        onNavigate={handleDashboardNavigate}
      />

      {/* Settings, Activity Logs, Sync & Security Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsModalTab}
        activities={activities}
        onRestoreActivityItem={handleRestoreActivityItem}
        household={household}
        currentUser={currentUser}
        isHouseholdAdmin={isHouseholdAdmin}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        syncErrorMessage={syncErrorMessage}
        onForceSync={handleForceSync}
        onRestoreData={handleRestoreData}
        onOpenDeleteDataModal={() => {
          setIsSettingsModalOpen(false);
          setIsDeleteModalOpen(true);
        }}
        onNavigate={(tab, options) => {
          setIsSettingsModalOpen(false);
          handleDashboardNavigate(tab, options);
        }}
      />

      {/* Household & Family Cloud Sync / Settings Modal */}
      <HouseholdModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        currentUser={currentUser}
        household={household}
        initialTab={householdModalTab}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onCreateHousehold={handleCreateHousehold}
        onJoinHousehold={handleJoinHousehold}
        onLeaveHousehold={handleLeaveHousehold}
        onInviteMember={handleInviteMember}
        onRemoveMember={handleRemoveMember}
        onApproveJoinRequest={handleApproveJoinRequest}
        onRejectJoinRequest={handleRejectJoinRequest}
        onTriggerSync={handleTriggerManualSync}
        isSyncing={isSyncing}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        onDeleteSelectedData={handleDeleteSelectedData}
      />

      {/* Standalone Selective Delete Data Modal */}
      <DeleteDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        debts={debts}
        mortgages={mortgages}
        notifications={notifications}
        activities={activities}
        household={household}
        onConfirmDelete={handleDeleteSelectedData}
      />

      {/* Data Safety & Backups Modal */}
      <DataSafetyModal
        isOpen={isDataSafetyModalOpen}
        onClose={() => setIsDataSafetyModalOpen(false)}
        household={household}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        syncErrorMessage={syncErrorMessage}
        onForceSync={handleForceSync}
        onRestoreData={handleRestoreData}
      />

      {/* Dynamic Views Viewport */}
      <main className="flex-1 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            bills={bills}
            budgetLimits={budgetLimits}
            shoppingLists={shoppingLists}
            shoppingItems={shoppingItems}
            mortgages={mortgages}
            debts={debts}
            selectedMonth={selectedMonth}
            onNavigate={handleDashboardNavigate}
            onQuickAddTransaction={() => {
              setIsQuickAddOpen(true);
            }}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onMonthChange={setSelectedMonth}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsManager
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onAddDebt={handleAddDebt}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            initialFilterType={navTxFilter}
            initialSearchQuery={navTxSearch}
            initialSelectedTransactionId={navTxSelectedId}
            onClearInitialState={() => {
              setNavTxFilter(null);
              setNavTxSearch('');
              setNavTxSelectedId(null);
            }}
            debts={debts}
          />
        )}

        {activeTab === 'scanner' && (
          <ReceiptScanner
            onAddTransaction={handleAddTransaction}
            onReceiptScanned={handleScannedReceipt}
            shoppingItems={shoppingItems}
            onNavigateToTransactions={() => setActiveTab('transactions')}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingLists
            shoppingLists={shoppingLists}
            shoppingItems={shoppingItems}
            onAddList={handleAddShoppingList}
            onUpdateList={handleUpdateShoppingList}
            onDeleteList={handleDeleteShoppingList}
            onAddItem={handleAddShoppingItem}
            onToggleItem={handleToggleShoppingItem}
            onDeleteItem={handleDeleteShoppingItem}
            onUpdateItem={handleUpdateShoppingItem}
            onAddTransaction={handleAddTransaction}
            initialCategoryFilter={navShoppingCategory}
            onClearInitialCategoryFilter={() => setNavShoppingCategory(null)}
            initialTab={navShoppingTab}
            onClearInitialTab={() => setNavShoppingTab(null)}
          />
        )}

        {activeTab === 'bills' && (
          <BillsManager
            bills={bills}
            onAddBill={handleAddBill}
            onUpdateBill={handleUpdateBill}
            onDeleteBill={handleDeleteBill}
            onAddTransaction={handleAddTransaction}
            pushEnabled={pushEnabled}
            onTogglePush={setPushEnabled}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            initialPayBillId={navPayBillId}
            onClearInitialPayBillId={() => setNavPayBillId(null)}
            debts={debts}
          />
        )}

        {activeTab === 'limits' && (
          <BudgetLimits
            budgetLimits={budgetLimits}
            transactions={transactions}
            onUpdateLimit={handleUpdateBudgetLimit}
            onAddLimit={handleAddBudgetLimit}
            onDeleteLimit={handleDeleteBudgetLimit}
            selectedMonth={selectedMonth}
            initialLimitCategory={navLimitCategory}
            onClearInitialLimitCategory={() => setNavLimitCategory(null)}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            transactions={transactions}
            bills={bills}
            budgetLimits={budgetLimits}
            selectedMonth={selectedMonth}
          />
        )}

        {(activeTab === 'debts' || activeTab === 'mortgage') && (
          <DebtManager
            debts={debts}
            onAddDebt={handleAddDebt}
            onUpdateDebt={handleUpdateDebt}
            onDeleteDebt={handleDeleteDebt}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onAddBill={handleAddBill}
            transactions={transactions}
            onSuccessFeedback={(title, amount, type, onUndo, subtitle) => {
              setToastFeedback({
                id: `toast-${Date.now()}`,
                title,
                amount,
                type,
                onUndo,
                subtitle,
              });
            }}
          />
        )}
      </main>

      {/* Modern UX Footer with Author bobEKam and Version Info */}
      <AppFooter
        onOpenVersionInfo={() => setIsVersionModalOpen(true)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Floating Action Button (FAB) for Quick Transaction Entry */}
      <QuickAddFAB
        onClick={() => setIsQuickAddOpen(true)}
        isOpen={
          isQuickAddOpen ||
          isHouseholdModalOpen ||
          isDataSafetyModalOpen ||
          isDeleteModalOpen ||
          isVersionModalOpen
        }
      />

      {/* Intuitive Quick Add Transaction & Shopping Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddTransaction={handleQuickAddTransaction}
        onAddShoppingItem={handleAddShoppingItem}
        onAddDebt={handleAddDebt}
        transactions={transactions}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        debts={debts}
        onOpenScanner={() => {
          setIsQuickAddOpen(false);
          setActiveTab('scanner');
        }}
        onSuccessFeedback={(title, amount, type, onUndo, subtitle) => {
          setToastFeedback({
            id: `toast-${Date.now()}`,
            title,
            amount,
            type,
            onUndo,
            subtitle,
          });
        }}
      />

      {/* Version & UX Design Philosophy Modal (Author: bobEKam) */}
      <VersionInfoModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
      />

      {/* Feedback Toast Notification with Undo */}
      <FeedbackToast
        toast={toastFeedback}
        onClose={() => setToastFeedback(null)}
      />
    </div>
  );
}
